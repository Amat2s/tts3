"""Solver result application service for Unit 43.

Safely applies a :class:`SolverRunResult` (produced by the Unit 42 CP-SAT
module) to the saved timetable assignment state persisted by Unit 31.

Behaviour contract:

- Locked saved assignments (the rows already in ``timetable_assignments``)
  are the authoritative locked solver inputs and are preserved unchanged.
- Newly generated placements, for previously unscheduled sessions only, are
  persisted through backend-controlled assignment logic.
- Sessions the solver could not place stay unscheduled (no row is created).
- A failed/invalid/unapplicable solver result leaves the saved timetable
  untouched, rolls back the transaction, and raises a structured failure.
- Partial success is valid and is represented explicitly in the returned
  metadata.

This service is intentionally *not* wired to any request handler or job yet.
"""

from dataclasses import dataclass
from enum import Enum

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session as DBSession, selectinload

from models.assignment import TimetableAssignment
from models.lecturer import AvailabilityDay, AvailabilitySlot
from models.room import Room
from models.session import Session
from models.session_allocation import SessionStudentAllocation
from solver.types import (
    AM_PM_BOUNDARY_INDEX,
    ORDERED_DAYS,
    ORDERED_SLOTS,
    GeneratedAssignment,
    SolverRunResult,
    SolverStatus,
)

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Public result + error types — structured for future job/API status surfacing.
# ---------------------------------------------------------------------------


class ApplicationStatus(str, Enum):
    """Outcome of applying a solver result to the saved timetable state."""

    # Everything the solver could schedule was persisted and nothing remains
    # unscheduled.
    APPLIED = "applied"
    # Generated placements were persisted but some sessions remain unscheduled.
    PARTIAL = "partial"
    # The solver result was not applicable; the saved timetable is unchanged.
    FAILED = "failed"


@dataclass
class SolverResultApplication:
    """Structured outcome of a solver result application.

    Carries the metadata a later solver status endpoint / frontend UI needs to
    report what happened without re-reading the database.
    """

    status: ApplicationStatus
    scheduled_count: int
    unscheduled_count: int
    is_partial: bool
    newly_scheduled_session_ids: list[str]
    remaining_unscheduled_session_ids: list[str]
    preserved_locked_count: int
    message: str


class SolverResultApplicationError(Exception):
    """Raised when a solver result cannot be safely applied.

    The transaction is always rolled back before this is raised, so the saved
    timetable assignment state is guaranteed unchanged.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# Placement geometry helpers (mirror Unit 31 / Unit 41 rules).
# ---------------------------------------------------------------------------


def _slot_index(slot: str) -> int:
    return ORDERED_SLOTS.index(slot)


def _occupied_slot_indices(start_slot: str, duration: int) -> range:
    idx = _slot_index(start_slot)
    return range(idx, idx + duration)


def _crosses_lunch(start_slot: str, duration: int) -> bool:
    idx = _slot_index(start_slot)
    return idx < AM_PM_BOUNDARY_INDEX and idx + duration > AM_PM_BOUNDARY_INDEX


def _off_timetable(start_slot: str, duration: int) -> bool:
    return _slot_index(start_slot) + duration > len(ORDERED_SLOTS)


# ---------------------------------------------------------------------------
# Existing (locked) saved-assignment loading.
# ---------------------------------------------------------------------------


def _load_locked_state(
    db: DBSession,
) -> tuple[set[str], dict[tuple[str, str, int], str]]:
    """Return the set of locked session ids and the room cells they occupy.

    The rows already present in ``timetable_assignments`` *are* the locked
    saved assignments — they are the authoritative locked solver inputs and the
    things this service must never mutate or overwrite.
    """
    existing = (
        db.query(TimetableAssignment)
        .options(selectinload(TimetableAssignment.session))
        .all()
    )

    locked_session_ids: set[str] = set()
    locked_room_cells: dict[tuple[str, str, int], str] = {}
    for a in existing:
        locked_session_ids.add(a.session_id)
        # Session may be missing only if the DB is inconsistent; guard anyway.
        duration = a.session.duration if a.session is not None else 1
        day = a.day.value
        start_slot = a.start_slot.value
        for t in _occupied_slot_indices(start_slot, duration):
            locked_room_cells[(day, a.room_id, t)] = a.session_id

    return locked_session_ids, locked_room_cells


# ---------------------------------------------------------------------------
# Defensive validation of generated placements.
# ---------------------------------------------------------------------------


def _validate_generated(
    db: DBSession,
    generated: list[GeneratedAssignment],
    locked_session_ids: set[str],
    locked_room_cells: dict[tuple[str, str, int], str],
) -> None:
    """Backend-safety validation run before any commit.

    Raises :class:`SolverResultApplicationError` on the first violation. This
    is defensive integrity protection, not user-facing validation.
    """
    # No duplicate session placements within the generated set.
    seen: set[str] = set()
    for g in generated:
        if g.session_id in seen:
            raise SolverResultApplicationError(
                "duplicate_generated_session",
                f"Solver produced more than one placement for session {g.session_id!r}.",
            )
        seen.add(g.session_id)

    if not generated:
        return

    gen_session_ids = {g.session_id for g in generated}
    gen_room_ids = {g.room_id for g in generated}

    sessions_map: dict[str, Session] = {
        s.id: s
        for s in db.query(Session)
        .filter(Session.id.in_(gen_session_ids))
        .all()
    }
    rooms_map: dict[str, Room] = {
        r.id: r for r in db.query(Room).filter(Room.id.in_(gen_room_ids)).all()
    }

    # Unit 68: capacity is checked against allocation-derived student count,
    # not total unit enrollment.
    alloc_counts: dict[str, int] = {sid: 0 for sid in gen_session_ids}
    alloc_rows = (
        db.query(SessionStudentAllocation.session_id)
        .filter(SessionStudentAllocation.session_id.in_(gen_session_ids))
        .all()
    )
    for (session_id,) in alloc_rows:
        alloc_counts[session_id] = alloc_counts.get(session_id, 0) + 1

    for g in generated:
        # Generated session must not overwrite a locked saved assignment.
        if g.session_id in locked_session_ids:
            raise SolverResultApplicationError(
                "would_overwrite_locked",
                (
                    f"Generated placement for session {g.session_id!r} would overwrite "
                    "a locked saved assignment."
                ),
            )

        session = sessions_map.get(g.session_id)
        if session is None:
            raise SolverResultApplicationError(
                "session_not_found",
                f"Generated placement references unknown session {g.session_id!r}.",
            )

        room = rooms_map.get(g.room_id)
        if room is None:
            raise SolverResultApplicationError(
                "room_not_found",
                f"Generated placement references unknown room {g.room_id!r}.",
            )

        if g.start_slot not in ORDERED_SLOTS:
            raise SolverResultApplicationError(
                "invalid_slot",
                f"Generated placement for session {g.session_id!r} has invalid slot {g.start_slot!r}.",
            )

        if g.day not in ORDERED_DAYS:
            raise SolverResultApplicationError(
                "invalid_day",
                f"Generated placement for session {g.session_id!r} has invalid day {g.day!r}.",
            )

        duration = session.duration
        if _crosses_lunch(g.start_slot, duration):
            raise SolverResultApplicationError(
                "blocking_integrity_violation",
                (
                    f"Generated placement for session {g.session_id!r} "
                    f"(start {g.start_slot}, duration {duration}) crosses the lunch break."
                ),
            )
        if _off_timetable(g.start_slot, duration):
            raise SolverResultApplicationError(
                "blocking_integrity_violation",
                (
                    f"Generated placement for session {g.session_id!r} "
                    f"(start {g.start_slot}, duration {duration}) runs past the timetable end."
                ),
            )

        student_count = alloc_counts.get(g.session_id, 0)
        if room.capacity < student_count:
            raise SolverResultApplicationError(
                "blocking_integrity_violation",
                (
                    f"Generated placement for session {g.session_id!r} uses room "
                    f"{room.name!r} (capacity {room.capacity}) smaller than the "
                    f"allocation count ({student_count})."
                ),
            )

    # Room no-overlap: generated placements must not collide with locked cells
    # or with each other.
    occupied: dict[tuple[str, str, int], str] = dict(locked_room_cells)
    for g in generated:
        duration = sessions_map[g.session_id].duration
        for t in _occupied_slot_indices(g.start_slot, duration):
            key = (g.day, g.room_id, t)
            owner = occupied.get(key)
            if owner is not None:
                kind = "a locked saved assignment" if owner in locked_session_ids else (
                    f"generated session {owner!r}"
                )
                raise SolverResultApplicationError(
                    "blocking_integrity_violation",
                    (
                        f"Generated placement for session {g.session_id!r} double-books room "
                        f"{g.room_id!r} on {g.day} slot {ORDERED_SLOTS[t]!r} already held by {kind}."
                    ),
                )
            occupied[key] = g.session_id


# ---------------------------------------------------------------------------
# Service entry point.
# ---------------------------------------------------------------------------


def apply_solver_result(
    db: DBSession, result: SolverRunResult
) -> SolverResultApplication:
    """Apply a solver run result to the saved timetable assignment state.

    On a successful or partially successful result, generated placements for
    previously unscheduled sessions are persisted in a single transaction while
    locked saved assignments are left untouched. On any failure the transaction
    is rolled back and :class:`SolverResultApplicationError` is raised.
    """
    log = logger.bind(
        solver_status=getattr(getattr(result, "status", None), "value", None),
    )

    # --- Failure safety: never mutate the saved timetable for a bad result. ---
    if result is None or not isinstance(result, SolverRunResult):
        db.rollback()
        log.warning("solver_result_apply_rejected", reason="invalid_result_object")
        raise SolverResultApplicationError(
            "invalid_result",
            "Solver result is missing or not a SolverRunResult.",
        )

    if result.status not in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE):
        db.rollback()
        log.warning(
            "solver_result_apply_rejected",
            reason="solver_failed",
            unscheduled=len(result.unscheduled_session_ids),
        )
        raise SolverResultApplicationError(
            "solver_failed",
            (
                f"Solver result status {result.status.value!r} is not applicable; "
                "saved timetable left unchanged."
            ),
        )

    generated = list(result.generated_assignments)

    # Defensive validation runs before any write. A failure here must not leave
    # partial state, so roll back before re-raising.
    locked_session_ids, locked_room_cells = _load_locked_state(db)
    try:
        _validate_generated(db, generated, locked_session_ids, locked_room_cells)
    except SolverResultApplicationError as exc:
        db.rollback()
        log.warning(
            "solver_result_apply_rejected",
            reason="defensive_validation_failed",
            code=exc.code,
            detail=exc.message,
        )
        raise

    # --- Persist generated placements within one transaction. ---
    try:
        for g in generated:
            db.add(
                TimetableAssignment(
                    session_id=g.session_id,
                    day=AvailabilityDay(g.day),
                    start_slot=AvailabilitySlot(g.start_slot),
                    room_id=g.room_id,
                )
            )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        log.error("solver_result_apply_failed", reason="persistence_error", error=str(exc))
        raise SolverResultApplicationError(
            "persistence_failed",
            f"Failed to persist generated assignments: {exc}",
        ) from exc

    # --- Build structured result metadata. ---
    newly_scheduled = sorted(g.session_id for g in generated)
    remaining_unscheduled = sorted(result.unscheduled_session_ids)
    scheduled_count = len(newly_scheduled)
    unscheduled_count = len(remaining_unscheduled)
    preserved_locked_count = len(locked_session_ids)
    is_partial = unscheduled_count > 0
    status = ApplicationStatus.PARTIAL if is_partial else ApplicationStatus.APPLIED

    message = (
        f"Applied {scheduled_count} generated assignment(s); "
        f"{unscheduled_count} session(s) remain unscheduled; "
        f"{preserved_locked_count} locked assignment(s) preserved."
    )

    log.info(
        "solver_result_applied",
        status=status.value,
        scheduled=scheduled_count,
        unscheduled=unscheduled_count,
        preserved_locked=preserved_locked_count,
    )

    return SolverResultApplication(
        status=status,
        scheduled_count=scheduled_count,
        unscheduled_count=unscheduled_count,
        is_partial=is_partial,
        newly_scheduled_session_ids=newly_scheduled,
        remaining_unscheduled_session_ids=remaining_unscheduled,
        preserved_locked_count=preserved_locked_count,
        message=message,
    )
