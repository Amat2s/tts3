from dataclasses import dataclass, field
from enum import Enum

# ---------------------------------------------------------------------------
# Timetable constants
# ---------------------------------------------------------------------------

ORDERED_DAYS: list[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
ORDERED_SLOTS: list[str] = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]
AM_SLOTS: list[str] = ["s1", "s2", "s3"]
PM_SLOTS: list[str] = ["s4", "s5", "s6", "s7"]
# Index of the first PM slot — sessions spanning across this boundary cross lunch.
AM_PM_BOUNDARY_INDEX: int = 3

# Session type sort order for deterministic collection ordering.
SESSION_TYPE_ORDER: dict[str, int] = {
    "lecture": 0,
    "tutorial": 1,
    "lab": 2,
    "workshop": 3,
}


# ---------------------------------------------------------------------------
# Solver input DTOs
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RoomSnapshot:
    room_id: str
    name: str
    capacity: int
    room_type: str | None = None


@dataclass(frozen=True)
class SessionSnapshot:
    session_id: str
    unit_id: str
    unit_code: str
    unit_name: str
    session_type: str
    duration: int
    lecturer_id: str
    student_ids: frozenset[str]
    student_count: int


@dataclass(frozen=True)
class AvailabilitySnapshot:
    lecturer_id: str
    # Set of (day, slot) pairs where the lecturer is unavailable.
    unavailable: frozenset[tuple[str, str]]


@dataclass(frozen=True)
class LockedAssignment:
    session_id: str
    day: str
    start_slot: str
    room_id: str
    duration: int


@dataclass(frozen=True)
class TimetableConstants:
    days: tuple[str, ...]
    slots: tuple[str, ...]
    am_slots: tuple[str, ...]
    pm_slots: tuple[str, ...]
    am_pm_boundary_index: int
    # Lunch gap separates AM and PM blocks; sessions must not cross it.
    lunch_gap: bool


TIMETABLE_CONSTANTS = TimetableConstants(
    days=tuple(ORDERED_DAYS),
    slots=tuple(ORDERED_SLOTS),
    am_slots=tuple(AM_SLOTS),
    pm_slots=tuple(PM_SLOTS),
    am_pm_boundary_index=AM_PM_BOUNDARY_INDEX,
    lunch_gap=True,
)


# ---------------------------------------------------------------------------
# Solver input snapshot — the complete compiled input for the CP-SAT model.
# ---------------------------------------------------------------------------


@dataclass
class SolverInputSnapshot:
    rooms: list[RoomSnapshot]
    sessions: list[SessionSnapshot]
    availability: list[AvailabilitySnapshot]
    locked_assignments: list[LockedAssignment]
    unscheduled_session_ids: list[str]
    lecturer_conflict_pairs: list[tuple[str, str]]
    student_conflict_pairs: list[tuple[str, str]]
    unit_session_conflict_pairs: list[tuple[str, str]]
    timetable_constants: TimetableConstants


# ---------------------------------------------------------------------------
# Solver output DTOs — consumed by the result-application service and the
# frontend solver status UI in later units.
# ---------------------------------------------------------------------------


class SolverStatus(str, Enum):
    # Proven-best placement of unscheduled sessions was found.
    OPTIMAL = "optimal"
    # A valid (possibly partial) placement was found but not proven optimal.
    FEASIBLE = "feasible"
    # The model itself is contradictory; should not occur with optional
    # placement variables, kept for defensive completeness.
    INFEASIBLE = "infeasible"
    # The solver stopped without finding any solution (e.g., timeout before
    # the first feasible placement).
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class GeneratedAssignment:
    """A placement produced by the solver for a previously unscheduled session."""

    session_id: str
    day: str
    start_slot: str
    room_id: str
    duration: int


@dataclass
class SolverRunResult:
    status: SolverStatus
    # Placements generated for previously unscheduled sessions only.
    generated_assignments: list[GeneratedAssignment]
    # Locked saved assignments preserved unchanged from the input snapshot.
    locked_assignments: list[LockedAssignment]
    # Session ids that remain unscheduled after the solve (partial results).
    unscheduled_session_ids: list[str]
    scheduled_count: int
    unscheduled_count: int
    timed_out: bool
    message: str
