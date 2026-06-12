from solver.apply import (
    ApplicationStatus,
    SolverResultApplication,
    SolverResultApplicationError,
    apply_solver_result,
)
from solver.job import (
    SolverJobPayload,
    SolverJobResult,
    SolverJobStatus,
    run_solver_job,
)
from solver.model import DEFAULT_TIME_LIMIT_SECONDS, solve_timetable
from solver.snapshot import SnapshotIntegrityError, build_snapshot_from_data, build_solver_input_snapshot
from solver.types import (
    ORDERED_DAYS,
    ORDERED_SLOTS,
    AM_SLOTS,
    PM_SLOTS,
    AM_PM_BOUNDARY_INDEX,
    SESSION_TYPE_ORDER,
    TIMETABLE_CONSTANTS,
    AvailabilitySnapshot,
    GeneratedAssignment,
    LockedAssignment,
    RoomSnapshot,
    SessionSnapshot,
    SolverInputSnapshot,
    SolverRunResult,
    SolverStatus,
    TimetableConstants,
)

__all__ = [
    # constants
    "ORDERED_DAYS",
    "ORDERED_SLOTS",
    "AM_SLOTS",
    "PM_SLOTS",
    "AM_PM_BOUNDARY_INDEX",
    "SESSION_TYPE_ORDER",
    "TIMETABLE_CONSTANTS",
    "DEFAULT_TIME_LIMIT_SECONDS",
    # DTOs
    "RoomSnapshot",
    "SessionSnapshot",
    "AvailabilitySnapshot",
    "LockedAssignment",
    "TimetableConstants",
    "SolverInputSnapshot",
    "GeneratedAssignment",
    "SolverRunResult",
    "SolverStatus",
    # builder
    "build_snapshot_from_data",
    "build_solver_input_snapshot",
    "SnapshotIntegrityError",
    # solver
    "solve_timetable",
    # result application
    "apply_solver_result",
    "ApplicationStatus",
    "SolverResultApplication",
    "SolverResultApplicationError",
    # async solver job runner
    "run_solver_job",
    "SolverJobPayload",
    "SolverJobResult",
    "SolverJobStatus",
]
