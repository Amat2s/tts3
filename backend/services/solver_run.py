from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session as DBSession

from api.errors import AppError
from models.room import Room
from models.solver_run import SolverRun, SolverRunStatus
from schemas.solver import SolverRunStatusResponse
from services.trigger_client import TriggerClientError, trigger_solver_job
from solver.snapshot import SnapshotIntegrityError, build_solver_input_snapshot

ACTIVE_STATUSES = (SolverRunStatus.PENDING, SolverRunStatus.RUNNING)

# An active run older than this is considered orphaned (the job died without
# reporting back — the task itself is capped at 120s) and is expired so it can
# never block solver starts permanently.
STALE_RUN_CUTOFF = timedelta(minutes=10)


def start_solver_run(db: DBSession, *, admin_user_id: str) -> SolverRunStatusResponse:
    _reject_active_run(db)

    try:
        snapshot = build_solver_input_snapshot(db)
    except SnapshotIntegrityError as exc:
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
        return _to_status_response(run)

    if db.query(Room).count() == 0:
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
        raise AppError(
            "solver_job_trigger_failed",
            f"Solver job could not be queued: {exc.message}",
            status_code=502,
        ) from exc

    run.trigger_job_id = handle.id
    db.commit()
    db.refresh(run)
    return _to_status_response(run)


def get_solver_run_status(
    db: DBSession, solver_run_id: str
) -> SolverRunStatusResponse:
    run = db.get(SolverRun, solver_run_id)
    if run is None:
        raise AppError(
            "solver_run_not_found",
            f"Solver run {solver_run_id} not found.",
            status_code=404,
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
            expired_any = True
        else:
            still_active = True
    if expired_any:
        db.commit()
    if still_active:
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

