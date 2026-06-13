from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy.orm import Session as DBSession

from api.errors import AppError
from models.room import Room
from models.solver_run import SolverRun, SolverRunStatus
from schemas.solver import SolverRunStatusResponse
from services.trigger_client import TriggerClientError, trigger_solver_job
from solver.snapshot import SnapshotIntegrityError, build_solver_input_snapshot

logger = structlog.get_logger(__name__)

ACTIVE_STATUSES = (SolverRunStatus.PENDING, SolverRunStatus.RUNNING)

# An active run older than this is considered orphaned (the job died without
# reporting back — the task itself is capped at 120s) and is expired so it can
# never block solver starts permanently.
STALE_RUN_CUTOFF = timedelta(minutes=10)


def start_solver_run(db: DBSession, *, admin_user_id: str) -> SolverRunStatusResponse:
    logger.info("solver_start_requested", admin_user_id=admin_user_id)
    _reject_active_run(db)

    try:
        snapshot = build_solver_input_snapshot(db)
    except SnapshotIntegrityError as exc:
        logger.warning(
            "solver_start_rejected",
            reason="saved_state_not_solver_ready",
            code="solver_integrity_failed",
            detail=exc.message,
        )
        raise AppError(
            "solver_integrity_failed",
            f"Saved timetable state failed solver integrity checks: {exc.message}",
            status_code=422,
        ) from exc

    if not snapshot.sessions:
        run = _create_solver_run(
            db,
            status=SolverRunStatus.SUCCEEDED,
            admin_user_id=admin_user_id,
            scheduled_count=0,
            unscheduled_count=0,
        )
        logger.info("solver_start_no_work", solver_run_id=run.id, reason="no_sessions")
        return _to_status_response(run)

    if db.query(Room).count() == 0:
        logger.warning(
            "solver_start_rejected",
            reason="saved_state_not_solver_ready",
            code="solver_no_rooms",
        )
        raise AppError(
            "solver_no_rooms",
            "At least one room must exist before starting the solver.",
            status_code=422,
        )

    if not snapshot.unscheduled_session_ids:
        run = _create_solver_run(
            db,
            status=SolverRunStatus.SUCCEEDED,
            admin_user_id=admin_user_id,
            scheduled_count=0,
            unscheduled_count=0,
        )
        logger.info(
            "solver_start_no_work", solver_run_id=run.id, reason="all_scheduled"
        )
        return _to_status_response(run)

    run = _create_solver_run(
        db,
        status=SolverRunStatus.PENDING,
        admin_user_id=admin_user_id,
    )

    payload = {
        "solverRunId": run.id,
        "correlationId": run.correlation_id,
        "adminWorkspaceId": admin_user_id,
        "snapshotId": None,
    }

    try:
        handle = trigger_solver_job(payload)
    except TriggerClientError as exc:
        run.status = SolverRunStatus.FAILED
        run.failure_code = "trigger_failed"
        run.failure_message = "Solver job could not be queued."
        db.commit()
        db.refresh(run)
        logger.warning(
            "solver_start_trigger_failed",
            solver_run_id=run.id,
            correlation_id=run.correlation_id,
            detail=exc.message,
        )
        raise AppError(
            "solver_job_trigger_failed",
            f"Solver job could not be queued: {exc.message}",
            status_code=502,
        ) from exc

    run.trigger_job_id = handle.id
    db.commit()
    db.refresh(run)
    logger.info(
        "solver_run_queued",
        solver_run_id=run.id,
        correlation_id=run.correlation_id,
        job_id=run.trigger_job_id,
        sessions_attempted=len(snapshot.unscheduled_session_ids),
    )
    return _to_status_response(run)


def execute_solver_run(
    db: DBSession,
    *,
    solver_run_id: str,
    correlation_id: str,
    admin_workspace_id: str | None = None,
    snapshot_id: str | None = None,
) -> dict:
    """Run the full solver pipeline synchronously for the deployed job worker.

    The production Trigger.dev worker (a Node container) cannot run the Python
    solver itself, so it calls this from the internal execute endpoint. All
    business logic and result application stays in the backend: this delegates
    to :func:`run_solver_job`, which marks the run RUNNING, applies the result
    safely (saved assignments are left unchanged on failure), records the final
    status, and never raises. The structured result dict is returned verbatim so
    the worker can log and surface the outcome — identical to the local CLI
    bridge contract.
    """
    # Imported lazily to avoid a circular import: solver.job imports this module.
    from solver.job import SolverJobPayload, run_solver_job

    payload = SolverJobPayload(
        solver_run_id=solver_run_id,
        correlation_id=correlation_id,
        admin_workspace_id=admin_workspace_id,
        snapshot_id=snapshot_id,
    )
    logger.info(
        "solver_execute_invoked",
        solver_run_id=solver_run_id,
        correlation_id=correlation_id,
    )
    result = run_solver_job(db, payload)
    return result.to_dict()


def get_solver_run_status(
    db: DBSession, solver_run_id: str
) -> SolverRunStatusResponse:
    run = db.get(SolverRun, solver_run_id)
    if run is None:
        logger.info(
            "solver_status_lookup", solver_run_id=solver_run_id, found=False
        )
        raise AppError(
            "solver_run_not_found",
            f"Solver run {solver_run_id} not found.",
            status_code=404,
        )
    logger.info(
        "solver_status_lookup",
        solver_run_id=solver_run_id,
        found=True,
        status=run.status.value,
    )
    return _to_status_response(run)


def mark_solver_run_running(db: DBSession, solver_run_id: str) -> None:
    run = db.get(SolverRun, solver_run_id)
    if run is None or run.status not in ACTIVE_STATUSES:
        return
    run.status = SolverRunStatus.RUNNING
    db.commit()


def finish_solver_run_from_job_result(db: DBSession, result) -> None:
    run = db.get(SolverRun, result.solver_run_id)
    if run is None:
        return

    result_status = getattr(result.status, "value", result.status)
    if result_status == "failed":
        run.status = SolverRunStatus.FAILED
        run.failure_message = _public_failure_message(result.message)
        run.failure_code = result.failure_code
    else:
        run.status = SolverRunStatus.SUCCEEDED
        run.failure_message = None
        run.failure_code = None

    run.scheduled_count = result.sessions_scheduled
    run.unscheduled_count = result.sessions_unscheduled
    run.partial_success = bool(result.is_partial)
    db.commit()


def _reject_active_run(db: DBSession) -> None:
    active_runs = (
        db.query(SolverRun).filter(SolverRun.status.in_(ACTIVE_STATUSES)).all()
    )
    now = datetime.now(timezone.utc)
    expired_any = False
    still_active = False
    for run in active_runs:
        created_at = (
            run.created_at
            if run.created_at.tzinfo is not None
            else run.created_at.replace(tzinfo=timezone.utc)
        )
        if now - created_at >= STALE_RUN_CUTOFF:
            run.status = SolverRunStatus.FAILED
            run.failure_code = "stale_run"
            run.failure_message = (
                "Solver run never reported a result and was marked failed."
            )
            logger.warning("solver_run_expired_stale", solver_run_id=run.id)
            expired_any = True
        else:
            still_active = True
    if expired_any:
        db.commit()
    if still_active:
        logger.warning(
            "solver_start_rejected", reason="run_already_active", code="solver_run_active"
        )
        raise AppError(
            "solver_run_active",
            "A solver run is already active. Wait for it to finish before starting another.",
            status_code=409,
        )


def _create_solver_run(
    db: DBSession,
    *,
    status: SolverRunStatus,
    admin_user_id: str,
    scheduled_count: int | None = None,
    unscheduled_count: int | None = None,
) -> SolverRun:
    run = SolverRun(
        id=str(uuid.uuid4()),
        status=status,
        correlation_id=str(uuid.uuid4()),
        requested_by_admin_id=admin_user_id,
        scheduled_count=scheduled_count,
        unscheduled_count=unscheduled_count,
        partial_success=False,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _to_status_response(run: SolverRun) -> SolverRunStatusResponse:
    return SolverRunStatusResponse(
        solver_run_id=run.id,
        status=run.status,
        job_id=run.trigger_job_id,
        created_at=run.created_at,
        updated_at=run.updated_at,
        scheduled_count=run.scheduled_count,
        unscheduled_count=run.unscheduled_count,
        partial_success=run.partial_success,
        failure_message=run.failure_message,
    )


def _public_failure_message(message: str) -> str:
    return (message or "Solver run failed.").strip()[:500]

