"""Solver input snapshot builder for Unit 41.

Compiles canonical persisted timetable data into a deterministic
SolverInputSnapshot that the CP-SAT model unit can consume without
querying the database.
"""

from constraints.graph import build_conflict_graph
from constraints.graph import ORDERED_SLOTS as CONSTRAINT_SLOTS
from constraints.types import (
    ConstraintType,
    SessionInput as ConstraintSessionInput,
)

from solver.types import (
    AM_PM_BOUNDARY_INDEX,
    ORDERED_DAYS,
    ORDERED_SLOTS,
    SESSION_TYPE_ORDER,
    TIMETABLE_CONSTANTS,
    AvailabilitySnapshot,
    BlockedCellSnapshot,
    LockedAssignment,
    RoomSnapshot,
    SessionSnapshot,
    SolverInputSnapshot,
)


class SnapshotIntegrityError(Exception):
    """Raised when persisted assignments violate blocking integrity rules."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _slot_index(slot: str) -> int:
    return ORDERED_SLOTS.index(slot)


def _occupied_slots(start_slot: str, duration: int) -> list[str]:
    idx = _slot_index(start_slot)
    return ORDERED_SLOTS[idx: idx + duration]


def _crosses_lunch(start_slot: str, duration: int) -> bool:
    idx = _slot_index(start_slot)
    return idx < AM_PM_BOUNDARY_INDEX and idx + duration > AM_PM_BOUNDARY_INDEX


def _off_timetable(start_slot: str, duration: int) -> bool:
    return _slot_index(start_slot) + duration > len(ORDERED_SLOTS)


def _session_sort_key(s: SessionSnapshot) -> tuple[str, int, str]:
    return (s.unit_code, SESSION_TYPE_ORDER.get(s.session_type, 99), s.session_id)


def _day_index(day: str) -> int:
    try:
        return ORDERED_DAYS.index(day)
    except ValueError:
        return 99


# ---------------------------------------------------------------------------
# Defensive integrity validation
# ---------------------------------------------------------------------------


def _validate_saved_assignments(
    assignments: list[LockedAssignment],
    session_map: dict[str, SessionSnapshot],
    room_map: dict[str, RoomSnapshot],
    blocked_cell_keys: set[tuple[str, str, str]],
) -> None:
    """Raise SnapshotIntegrityError for any impossible saved assignment shape.

    Unit 87: a saved locked assignment overlapping a timetable block must never
    be valid solver input — it fails integrity safely here so the solver-start
    path rejects the run rather than scheduling around a stale block.
    ``blocked_cell_keys`` are normalized ``(day, slot, room_id)`` tuples.
    """
    for a in assignments:
        if a.session_id not in session_map:
            raise SnapshotIntegrityError(
                f"Assignment references missing session: {a.session_id!r}"
            )
        if a.room_id not in room_map:
            raise SnapshotIntegrityError(
                f"Assignment references missing room: {a.room_id!r}"
            )
        if a.start_slot not in ORDERED_SLOTS:
            raise SnapshotIntegrityError(
                f"Assignment for session {a.session_id!r} has invalid start slot: {a.start_slot!r}"
            )
        if _crosses_lunch(a.start_slot, a.duration):
            raise SnapshotIntegrityError(
                f"Assignment for session {a.session_id!r} crosses the lunch boundary "
                f"(start_slot={a.start_slot!r}, duration={a.duration})"
            )
        if _off_timetable(a.start_slot, a.duration):
            raise SnapshotIntegrityError(
                f"Assignment for session {a.session_id!r} runs beyond the last timetable slot "
                f"(start_slot={a.start_slot!r}, duration={a.duration})"
            )
        session = session_map[a.session_id]
        room = room_map[a.room_id]
        if room.capacity < session.student_count:
            raise SnapshotIntegrityError(
                f"Assignment for session {a.session_id!r} in room {a.room_id!r}: "
                f"room capacity {room.capacity} < student count {session.student_count}"
            )
        if blocked_cell_keys:
            for slot in _occupied_slots(a.start_slot, a.duration):
                if (a.day, slot, a.room_id) in blocked_cell_keys:
                    raise SnapshotIntegrityError(
                        f"Assignment for session {a.session_id!r} overlaps a timetable "
                        f"block at room {a.room_id!r} on {a.day} slot {slot!r}"
                    )

    # Check room double-booking: no two assignments may occupy the same
    # (day, room, slot) cell.
    occupied: dict[tuple[str, str, str], str] = {}
    for a in assignments:
        for slot in _occupied_slots(a.start_slot, a.duration):
            key = (a.day, a.room_id, slot)
            if key in occupied:
                raise SnapshotIntegrityError(
                    f"Room double-booking: room {a.room_id!r} on {a.day} slot {slot!r} "
                    f"is occupied by sessions {occupied[key]!r} and {a.session_id!r}"
                )
            occupied[key] = a.session_id


# ---------------------------------------------------------------------------
# Conflict pair extraction
# ---------------------------------------------------------------------------


def _extract_conflict_pairs(
    conflict_graph,
) -> tuple[list[tuple[str, str]], list[tuple[str, str]], list[tuple[str, str]]]:
    """Split conflict graph edges into typed, deterministically sorted pair lists.

    A pair may appear in multiple categories when sessions conflict on more than
    one constraint type (e.g., same unit AND same lecturer). Deduplication is
    applied per category, not globally.
    """
    lecturer_seen: set[frozenset[str]] = set()
    student_seen: set[frozenset[str]] = set()
    unit_seen: set[frozenset[str]] = set()

    lecturer_pairs: list[tuple[str, str]] = []
    student_pairs: list[tuple[str, str]] = []
    unit_pairs: list[tuple[str, str]] = []

    for edge in conflict_graph.edges:
        key: frozenset[str] = frozenset([edge.session_a, edge.session_b])
        pair: tuple[str, str] = (
            min(edge.session_a, edge.session_b),
            max(edge.session_a, edge.session_b),
        )
        if edge.constraint_type == ConstraintType.LECTURER_OVERLAP:
            if key not in lecturer_seen:
                lecturer_seen.add(key)
                lecturer_pairs.append(pair)
        elif edge.constraint_type == ConstraintType.STUDENT_OVERLAP:
            if key not in student_seen:
                student_seen.add(key)
                student_pairs.append(pair)
        elif edge.constraint_type == ConstraintType.UNIT_SESSION_OVERLAP:
            if key not in unit_seen:
                unit_seen.add(key)
                unit_pairs.append(pair)

    return sorted(lecturer_pairs), sorted(student_pairs), sorted(unit_pairs)


# ---------------------------------------------------------------------------
# Core builder — pure function, no DB access
# ---------------------------------------------------------------------------


def build_snapshot_from_data(
    rooms: list[RoomSnapshot],
    sessions: list[SessionSnapshot],
    availability: list[AvailabilitySnapshot],
    saved_assignments: list[LockedAssignment],
    blocked_cells: list[BlockedCellSnapshot] | None = None,
) -> SolverInputSnapshot:
    """Build a deterministic solver input snapshot from ORM-detached input data.

    Raises SnapshotIntegrityError if any saved assignment violates blocking
    integrity rules (including overlapping a timetable block). Does not create
    or modify assignments.
    """
    room_map = {r.room_id: r for r in rooms}
    session_map = {s.session_id: s for s in sessions}

    blocked_cells = blocked_cells or []
    blocked_cell_keys = {(b.day, b.slot, b.room_id) for b in blocked_cells}

    _validate_saved_assignments(
        saved_assignments, session_map, room_map, blocked_cell_keys
    )

    # Build conflict graph using Unit 40 structural derivation.
    constraint_sessions = [
        ConstraintSessionInput(
            session_id=s.session_id,
            unit_id=s.unit_id,
            duration=s.duration,
            lecturer_id=s.lecturer_id,
            student_ids=s.student_ids,
        )
        for s in sessions
    ]
    conflict_graph = build_conflict_graph(constraint_sessions)
    lecturer_pairs, student_pairs, unit_pairs = _extract_conflict_pairs(conflict_graph)

    # Partition sessions into locked and unscheduled.
    assigned_ids = {a.session_id for a in saved_assignments}
    unscheduled_ids = sorted(
        s.session_id for s in sessions if s.session_id not in assigned_ids
    )

    # Deterministic ordering for all collections.
    sorted_rooms = sorted(rooms, key=lambda r: (r.name, r.room_id))
    sorted_sessions = sorted(sessions, key=_session_sort_key)
    sorted_availability = sorted(availability, key=lambda a: a.lecturer_id)
    sorted_assignments = sorted(
        saved_assignments,
        key=lambda a: (
            _day_index(a.day),
            a.room_id,
            _slot_index(a.start_slot),
            a.session_id,
        ),
    )
    sorted_blocked_cells = sorted(
        blocked_cells,
        key=lambda b: (_day_index(b.day), b.room_id, _slot_index(b.slot)),
    )

    return SolverInputSnapshot(
        rooms=sorted_rooms,
        sessions=sorted_sessions,
        availability=sorted_availability,
        locked_assignments=sorted_assignments,
        unscheduled_session_ids=unscheduled_ids,
        lecturer_conflict_pairs=lecturer_pairs,
        student_conflict_pairs=student_pairs,
        unit_session_conflict_pairs=unit_pairs,
        timetable_constants=TIMETABLE_CONSTANTS,
        blocked_cells=sorted_blocked_cells,
    )


# ---------------------------------------------------------------------------
# DB loader — reads from SQLAlchemy session, produces flat input for builder
# ---------------------------------------------------------------------------


def build_solver_input_snapshot(db) -> SolverInputSnapshot:
    """Load canonical persisted data and compile a solver input snapshot.

    `db` is a SQLAlchemy Session. All ORM objects are consumed here; the
    returned SolverInputSnapshot is fully detached from the database.

    Unit 68: session-level lecturer_id is authoritative. Per-session student
    membership comes from session_student_allocations (not unit.students), so
    lectures and tutorials each carry only their allocated students.
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from models.room import Room
    from models.lecturer import Lecturer
    from models.session import Session
    from models.session_allocation import SessionStudentAllocation
    from models.assignment import TimetableAssignment
    from models.timetable_block import TimetableBlockCell

    # --- rooms ---
    rooms_orm = db.execute(select(Room)).scalars().all()
    rooms = [
        RoomSnapshot(
            room_id=r.id,
            name=r.name,
            capacity=r.capacity,
            room_type=r.room_type.value if r.room_type else None,
        )
        for r in rooms_orm
    ]

    # --- lecturer availability ---
    lecturers_orm = (
        db.execute(
            select(Lecturer).options(selectinload(Lecturer.unavailable_slots))
        )
        .scalars()
        .all()
    )
    availability = [
        AvailabilitySnapshot(
            lecturer_id=lec.id,
            unavailable=frozenset(
                (slot.day.value, slot.slot.value)
                for slot in lec.unavailable_slots
            ),
        )
        for lec in lecturers_orm
    ]

    # --- sessions: load with unit context, filter to schedulable only ---
    # Sessions without a session-level lecturer_id are not schedulable and are
    # excluded, mirroring services.session.list_schedulable_sessions.
    sessions_orm = (
        db.execute(
            select(Session).options(selectinload(Session.unit))
        )
        .scalars()
        .all()
    )
    schedulable = [s for s in sessions_orm if s.lecturer_id is not None]
    schedulable_ids = [s.id for s in schedulable]

    # Load per-session allocation data in one query. Allocation rows are the
    # authoritative student membership for each session (lecture = all enrolled,
    # tutorial = allocated group). unit.students is intentionally not used.
    alloc_by_session: dict[str, set[str]] = {sid: set() for sid in schedulable_ids}
    if schedulable_ids:
        alloc_rows = db.execute(
            select(
                SessionStudentAllocation.session_id,
                SessionStudentAllocation.student_id,
            ).where(SessionStudentAllocation.session_id.in_(schedulable_ids))
        ).all()
        for session_id, student_id in alloc_rows:
            alloc_by_session[session_id].add(student_id)

    sessions: list[SessionSnapshot] = []
    for sess in schedulable:
        student_ids = frozenset(alloc_by_session[sess.id])
        sessions.append(
            SessionSnapshot(
                session_id=sess.id,
                unit_id=sess.unit_id,
                unit_code=sess.unit.code,
                unit_name=sess.unit.name,
                session_type=sess.session_type.value,
                duration=sess.duration,
                lecturer_id=sess.lecturer_id,
                student_ids=student_ids,
                student_count=len(student_ids),
            )
        )

    # --- saved assignments ---
    session_duration_map = {s.session_id: s.duration for s in sessions}
    assignments_orm = (
        db.execute(
            select(TimetableAssignment).options(
                selectinload(TimetableAssignment.session),
            )
        )
        .scalars()
        .all()
    )
    saved_assignments: list[LockedAssignment] = []
    for a in assignments_orm:
        duration = session_duration_map.get(a.session_id)
        if duration is None and a.session is not None:
            duration = a.session.duration
        if duration is None:
            raise ValueError(
                f"Cannot determine duration for assignment {a.id}: "
                f"session_id={a.session_id!r} not found among loaded sessions"
            )
        saved_assignments.append(
            LockedAssignment(
                session_id=a.session_id,
                day=a.day.value,
                start_slot=a.start_slot.value,
                room_id=a.room_id,
                duration=duration,
            )
        )

    # --- blocked cells: load all block cells with owning group names ---
    block_cells_orm = (
        db.execute(
            select(TimetableBlockCell).options(
                selectinload(TimetableBlockCell.block_group)
            )
        )
        .scalars()
        .all()
    )
    blocked_cells = [
        BlockedCellSnapshot(
            day=c.day.value,
            slot=c.slot.value,
            room_id=c.room_id,
            block_group_id=c.block_group_id,
            block_name=c.block_group.name if c.block_group is not None else None,
        )
        for c in block_cells_orm
    ]

    return build_snapshot_from_data(
        rooms, sessions, availability, saved_assignments, blocked_cells
    )
