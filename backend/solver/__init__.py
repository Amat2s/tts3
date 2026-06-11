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
]
