"""Async solver job runner for Unit 45.

This is the backend-side execution of the asynchronous solver job. The
Trigger.dev task in ``jobs/`` is a thin orchestration wrapper that invokes
this runner (see ``solver.job_cli``); all solver *business logic* stays here
inside the backend solver services.

The runner performs the full solver pipeline from *saved* timetable state:

1. Build the solver input snapshot from the database (Unit 41).
2. Run the CP-SAT solver (Unit 42).
3. Apply the result through the result application service (Unit 43).

It never receives or touches frontend draft assignment state — it is driven
only by a stable :class:`SolverJobPayload` reference and reads saved data.

Failure safety: the Unit 43 application service rolls back and leaves the
saved timetable unchanged on any bad/inapplicable result. This runner adds a
defensive rollback around the whole pipeline so a snapshot/solve failure can
never leave partial state, and always returns a structured
:class:`SolverJobResult` describing the outcome (never raises to the caller).
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import structlog
from sqlalchemy.orm import Session as DBSession

from solver.apply import SolverResultApplicationError, apply_solver_result
from solver.model import DEFAULT_TIME_LIMIT_SECONDS, solve_timetable
from solver.snapshot import SnapshotIntegrityError, build_solver_input_snapshot

logger = structlog.get_logger(__name__)


def _mark_solver_run_running(db: DBSession, solver_run_id: str, log) -> None:
    try:
        from services.solver_run import mark_solver_run_running

        mark_solver_run_running(db, solver_run_id)
    except Exception as exc:
        db.rollback()
        log.warning("solver_run_status_update_failed", phase="running", error=str(exc))


def _record_solver_run_result(db: DBSession, result: "SolverJobResult", log) -> None:
    try:
        from services.solver_run import finish_solver_run_from_job_result

        finish_solver_run_from_job_result(db, result)
    except Exception as exc:
        db.rollback()
        log.warning("solver_run_status_update_failed", phase="finished", error=str(exc))


# ---------------------------------------------------------------------------
# Job input / output types — stable references only, never draft state.
# ---------------------------------------------------------------------------


class SolverJobStatus(str, Enum):
    """Outcome of an async solver job run."""

    # Everything schedulable was placed and nothing remains unscheduled.
    COMPLETED = "completed"
    # Generated placements were applied but some sessions remain unscheduled.
    PARTIAL = "partial"
    # The job did not apply any result; saved timetable left unchanged.
    FAILED = "failed"


@dataclass(frozen=True)
class SolverJobPayload:
    """Stable reference the job runs from — not mutable frontend draft state.

    ``solver_run_id`` and ``correlation_id`` are opaque references used to
    correlate logs/results across systems. ``admin_workspace_id`` and
    ``snapshot_id`` are accepted for forward-compatibility with later units
    (multi-workspace, persisted snapshots); they are not required in v1 and
    the runner builds its input from current saved database state.
    """

    solver_run_id: str
    correlation_id: str
    admin_workspace_id: Optional[str] = None
    snapshot_id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> "SolverJobPayload":
        if not isinstance(data, dict):
            raise ValueError("Solver job payload must be a JSON object.")
        try:
            solver_run_id = str(data["solver_run_id"])
            correlation_id = str(data["correlation_id"])
        except KeyError as exc:
            raise ValueError(f"Solver job payload missing required field: {exc}") from exc
        admin = data.get("admin_workspace_id")
        snapshot = data.get("snapshot_id")
        return cls(
            solver_run_id=solver_run_id,
            correlation_id=correlation_id,
            admin_workspace_id=str(admin) if admin is not None else None,
            snapshot_id=str(snapshot) if snapshot is not None else None,
        )


@dataclass
class SolverJobResult:
    """Structured result metadata suitable for the later solver status API.

    Carries everything a status endpoint / progress UI needs to report the
    outcome of a run without re-reading the database.
    """

    status: SolverJobStatus
    solver_run_id: str
    correlation_id: str
    # Mirror of the underlying CP-SAT status ("optimal"/"feasible"/...), or
    # None when the job failed before/at the solve step.
    solver_status: Optional[str]
    sessions_attempted: int
    sessions_scheduled: int
    sessions_unscheduled: int
    is_partial: bool
    timed_out: bool
    duration_seconds: float
    started_at: str
    completed_at: str
    message: str
    # Concise failure code on a failed run (e.g. "solver_failed"); None on
    # success/partial.
    failure_code: Optional[str] = None
    newly_scheduled_session_ids: list[str] = field(default_factory=list)
    remaining_unscheduled_session_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["status"] = self.status.value
        return data


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_solver_job(
    db: DBSession,
    payload: SolverJobPayload,
    *,
    time_limit_seconds: float = DEFAULT_TIME_LIMIT_SECONDS,
) -> SolverJobResult:
    """Run the full async solver pipeline from saved timetable state.

    Returns a structured :class:`SolverJobResult` for every outcome — success,
    partial, or failure — and never raises. On failure the saved timetable
    assignment state is guaranteed unchanged.
    """
    log = logger.bind(
        solver_run_id=payload.solver_run_id,
        correlation_id=payload.correlation_id,
    )
    started_at = datetime.now(timezone.utc)
    start_perf = time.perf_counter()
    log.info("solver_job_started", started_at=started_at.isoformat())
    _mark_solver_run_running(db, payload.solver_run_id, log)

    def _finish(
        *,
        status: SolverJobStatus,
        solver_status: Optional[str],
        sessions_attempted: int,
        sessions_scheduled: int,
        sessions_unscheduled: int,
        is_partial: bool,
        timed_out: bool,
        message: str,
        failure_code: Optional[str] = None,
        newly_scheduled: Optional[list[str]] = None,
        remaining_unscheduled: Optional[list[str]] = None,
    ) -> SolverJobResult:
        duration = time.perf_counter() - start_perf
        completed_at = datetime.now(timezone.utc)
        result = SolverJobResult(
            status=status,
            solver_run_id=payload.solver_run_id,
            correlation_id=payload.correlation_id,
            solver_status=solver_status,
            sessions_attempted=sessions_attempted,
            sessions_scheduled=sessions_scheduled,
            sessions_unscheduled=sessions_unscheduled,
            is_partial=is_partial,
            timed_out=timed_out,
            duration_seconds=round(duration, 4),
            started_at=started_at.isoformat(),
            completed_at=completed_at.isoformat(),
            message=message,
            failure_code=failure_code,
            newly_scheduled_session_ids=newly_scheduled or [],
            remaining_unscheduled_session_ids=remaining_unscheduled or [],
        )
        _record_solver_run_result(db, result, log)
        return result

    # --- 1. Build snapshot from saved data. ---
    try:
        snapshot = build_solver_input_snapshot(db)
    except SnapshotIntegrityError as exc:
        db.rollback()
        log.warning("solver_job_failed", step="build_snapshot", failure_code="snapshot_integrity", detail=exc.message)
        return _finish(
            status=SolverJobStatus.FAILED,
            solver_status=None,
            sessions_attempted=0,
            sessions_scheduled=0,
            sessions_unscheduled=0,
            is_partial=False,
            timed_out=False,
            message=f"Failed to build solver input: {exc.message}",
            failure_code="snapshot_integrity",
        )
    except Exception as exc:  # defensive: never leave a half-open transaction
        db.rollback()
        log.error("solver_job_failed", step="build_snapshot", failure_code="snapshot_error", error=str(exc))
        return _finish(
            status=SolverJobStatus.FAILED,
            solver_status=None,
            sessions_attempted=0,
            sessions_scheduled=0,
            sessions_unscheduled=0,
            is_partial=False,
            timed_out=False,
            message=f"Unexpected error building solver input: {exc}",
            failure_code="snapshot_error",
        )

    sessions_attempted = len(snapshot.unscheduled_session_ids)

    # --- 2. Run CP-SAT solver. ---
    try:
        result = solve_timetable(snapshot, time_limit_seconds=time_limit_seconds)
    except Exception as exc:  # defensive: solver must not corrupt saved state
        db.rollback()
        log.error("solver_job_failed", step="solve", failure_code="solver_error", error=str(exc))
        return _finish(
            status=SolverJobStatus.FAILED,
            solver_status=None,
            sessions_attempted=sessions_attempted,
            sessions_scheduled=0,
            sessions_unscheduled=sessions_attempted,
            is_partial=False,
            timed_out=False,
            message=f"Solver run failed: {exc}",
            failure_code="solver_error",
        )

    solver_status_value = result.status.value

    # --- 3. Apply result through the backend application service. ---
    try:
        application = apply_solver_result(db, result)
    except SolverResultApplicationError as exc:
        # apply_solver_result has already rolled back; saved state is unchanged.
        log.warning(
            "solver_job_failed",
            step="apply",
            solver_status=solver_status_value,
            failure_code=exc.code,
            detail=exc.message,
        )
        return _finish(
            status=SolverJobStatus.FAILED,
            solver_status=solver_status_value,
            sessions_attempted=sessions_attempted,
            sessions_scheduled=0,
            sessions_unscheduled=sessions_attempted,
            is_partial=False,
            timed_out=result.timed_out,
            message=exc.message,
            failure_code=exc.code,
        )
    except Exception as exc:  # defensive
        db.rollback()
        log.error("solver_job_failed", step="apply", failure_code="apply_error", error=str(exc))
        return _finish(
            status=SolverJobStatus.FAILED,
            solver_status=solver_status_value,
            sessions_attempted=sessions_attempted,
            sessions_scheduled=0,
            sessions_unscheduled=sessions_attempted,
            is_partial=False,
            timed_out=result.timed_out,
            message=f"Unexpected error applying solver result: {exc}",
            failure_code="apply_error",
        )

    # --- Success / partial. ---
    status = (
        SolverJobStatus.PARTIAL if application.is_partial else SolverJobStatus.COMPLETED
    )
    job_result = _finish(
        status=status,
        solver_status=solver_status_value,
        sessions_attempted=sessions_attempted,
        sessions_scheduled=application.scheduled_count,
        sessions_unscheduled=application.unscheduled_count,
        is_partial=application.is_partial,
        timed_out=result.timed_out,
        message=application.message,
        newly_scheduled=application.newly_scheduled_session_ids,
        remaining_unscheduled=application.remaining_unscheduled_session_ids,
    )

    log.info(
        "solver_job_completed",
        status=status.value,
        solver_status=solver_status_value,
        duration_seconds=job_result.duration_seconds,
        sessions_attempted=sessions_attempted,
        sessions_scheduled=application.scheduled_count,
        sessions_unscheduled=application.unscheduled_count,
        is_partial=application.is_partial,
        timed_out=result.timed_out,
    )
    return job_result
