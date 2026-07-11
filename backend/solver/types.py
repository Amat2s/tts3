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

# Session type sort order for deterministic collection ordering. Session types
# were reduced to lecture/tutorial in Unit 60, then gained seminar in Unit 115
# (a pure ordering tie-break with no feasibility meaning); unknown types sort
# last via the caller's `.get(..., 99)` fallback.
SESSION_TYPE_ORDER: dict[str, int] = {
    "lecture": 0,
    "tutorial": 1,
    "seminar": 2,
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
class BlockedCellSnapshot:
    """A single room-specific reserved (blocked) cell mirrored into the solver.

    Unit 87: timetable blocks are a hard constraint. A blocked ``day + slot +
    room_id`` cell may never be occupied by a generated or locked assignment.
    ``block_name`` is the owning group's name (``None`` for an unnamed block) and
    is carried for diagnostics only.
    """

    day: str
    slot: str
    room_id: str
    block_group_id: str
    block_name: str | None = None


@dataclass(frozen=True)
class PreferenceSnapshot:
    """A single room-specific lecturer scheduling preference mirrored into the solver.

    Unit 101: preferences are the first soft constraint. A preference cell is
    ``lecturer_id + day + slot + room_id`` with exactly one ``level``
    (``preferred`` | ``avoid``). Preferences carry no feasibility meaning — they
    never block, restrict, or remove a candidate assignment; they only bias the
    secondary objective term among equally-maximal scheduling outcomes.
    """

    lecturer_id: str
    day: str
    slot: str
    room_id: str
    level: str


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
    # Unit 87: room-specific cells reserved by timetable blocks. The CP-SAT
    # model never creates a candidate occupying one of these cells.
    blocked_cells: list[BlockedCellSnapshot] = field(default_factory=list)
    # Unit 101: room-specific lecturer scheduling preferences. These are soft
    # constraints — they only bias the secondary objective term and never affect
    # candidate feasibility.
    preferences: list[PreferenceSnapshot] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Solver output DTOs — consumed by the result-application service and the
# frontend solver status UI.
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
