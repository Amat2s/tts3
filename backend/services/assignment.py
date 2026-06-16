import structlog
from sqlalchemy.orm import Session as DBSession, selectinload

from api.errors import AppError
from models.assignment import TimetableAssignment
from models.room import Room
from models.session import Session
from models.unit import Unit
from schemas.assignment import AssignmentItem, AssignmentResponse, AssignmentSaveRequest
from services.session_allocation import allocated_student_ids, allocation_counts

logger = structlog.get_logger(__name__)

# Ordered slot IDs matching the frontend timetable (s1–s7, no lunch slot).
ORDERED_SLOTS: list[str] = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]

# AM block: s1, s2, s3 (indices 0–2). PM block: s4–s7 (indices 3–6).
_AM_SLOT_COUNT = 3


def _reject_save(code: str, message: str, *, status_code: int = 422, **fields: object) -> None:
    """Log a defensive save rejection then raise the structured API error.

    Observability only: this records *that* a blocked-placement invariant was
    violated using IDs and counts (never student payloads), and re-raises the
    same ``AppError`` the caller already returned. It does not change behavior.
    """
    logger.warning("assignment_save_rejected", code=code, **fields)
    raise AppError(code, message, status_code=status_code)


def _slot_index(slot: str) -> int:
    return ORDERED_SLOTS.index(slot)


def _crosses_lunch(start_slot: str, duration: int) -> bool:
    """True if an AM-starting session would spill into the PM block."""
    idx = _slot_index(start_slot)
    if idx >= _AM_SLOT_COUNT:
        return False
    return idx + duration > _AM_SLOT_COUNT


def _off_timetable(start_slot: str, duration: int) -> bool:
    """True if the session extends past the last timetable slot (s7)."""
    return _slot_index(start_slot) + duration > len(ORDERED_SLOTS)


def _build_response(
    assignment: TimetableAssignment,
    counts: dict[str, int],
    allocated: dict[str, list[str]],
) -> AssignmentResponse:
    session = assignment.session
    unit = session.unit
    # Unit 59: lecturer display comes from the session-level lecturer.
    lecturer = session.lecturer
    lecturer_display_name = (
        f"{lecturer.title.value} {lecturer.first_name} {lecturer.last_name}"
        if lecturer is not None
        else "Unassigned"
    )
    return AssignmentResponse(
        assignment_id=assignment.id,
        session_id=session.id,
        unit_id=unit.id,
        unit_code=unit.code,
        unit_name=unit.name,
        session_type=session.session_type,
        duration=session.duration,
        lecturer_id=session.lecturer_id,
        lecturer_display_name=lecturer_display_name,
        # Unit 60: student count is the allocated group size for this session.
        student_count=counts.get(session.id, 0),
        allocated_student_ids=allocated.get(session.id, []),
        day=assignment.day,
        start_slot=assignment.start_slot,
        room_id=assignment.room_id,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    )


def _assignment_query(db: DBSession):
    return db.query(TimetableAssignment).options(
        selectinload(TimetableAssignment.session).selectinload(Session.lecturer),
        selectinload(TimetableAssignment.session)
        .selectinload(Session.unit)
        .selectinload(Unit.students),
        selectinload(TimetableAssignment.room),
    )


def _allocation_maps(
    db: DBSession, assignments: list[TimetableAssignment]
) -> tuple[dict[str, int], dict[str, list[str]]]:
    session_ids = [a.session_id for a in assignments]
    return allocation_counts(db, session_ids), allocated_student_ids(db, session_ids)


def list_assignments(db: DBSession) -> list[AssignmentResponse]:
    assignments = _assignment_query(db).all()
    counts, allocated = _allocation_maps(db, assignments)
    return [_build_response(a, counts, allocated) for a in assignments]


def save_assignments(
    db: DBSession, data: AssignmentSaveRequest
) -> list[AssignmentResponse]:
    items = data.assignments

    logger.info("assignment_save_requested", assignment_count=len(items))

    if not items:
        db.query(TimetableAssignment).delete()
        db.commit()
        logger.info("assignment_save_succeeded", saved_count=0)
        return []

    # Deduplicate input: reject duplicate session_ids in the request.
    seen_session_ids: set[str] = set()
    for item in items:
        if item.session_id in seen_session_ids:
            _reject_save(
                "duplicate_session_in_request",
                f"Session {item.session_id} appears more than once in the assignment list.",
                session_id=item.session_id,
            )
        seen_session_ids.add(item.session_id)

    # Fetch all referenced sessions (with unit + lecturer + students) and rooms.
    session_ids = {item.session_id for item in items}
    room_ids = {item.room_id for item in items}

    sessions_map: dict[str, Session] = {
        s.id: s
        for s in db.query(Session)
        .options(
            selectinload(Session.unit).selectinload(Unit.students),
        )
        .filter(Session.id.in_(session_ids))
        .all()
    }
    rooms_map: dict[str, Room] = {
        r.id: r
        for r in db.query(Room).filter(Room.id.in_(room_ids)).all()
    }

    # Unit 60: per-session student counts come from the hidden allocation rows,
    # not from total unit enrolment. For a lecture this equals the enrolled unit
    # student count; for a tutorial it is the allocated group size.
    save_counts = allocation_counts(db, list(session_ids))

    # Verify all referenced sessions and rooms exist.
    for item in items:
        if item.session_id not in sessions_map:
            _reject_save(
                "session_not_found",
                f"Session {item.session_id} not found.",
                session_id=item.session_id,
            )
        if item.room_id not in rooms_map:
            _reject_save(
                "room_not_found",
                f"Room {item.room_id} not found.",
                session_id=item.session_id,
                room_id=item.room_id,
            )

    # Per-item defensive checks.
    for item in items:
        session = sessions_map[item.session_id]
        room = rooms_map[item.room_id]
        duration = session.duration
        student_count = save_counts.get(item.session_id, 0)
        start_slot = item.start_slot.value

        if room.capacity < student_count:
            _reject_save(
                "room_capacity_too_small",
                (
                    f"Room '{room.name}' capacity ({room.capacity}) is smaller than "
                    f"the session's student count ({student_count})."
                ),
                session_id=item.session_id,
                room_id=item.room_id,
                room_capacity=room.capacity,
                student_count=student_count,
            )

        if _crosses_lunch(start_slot, duration):
            _reject_save(
                "session_crosses_lunch",
                (
                    f"Session starting at {start_slot} with duration {duration} "
                    "would cross the lunch break."
                ),
                session_id=item.session_id,
                start_slot=start_slot,
                duration=duration,
            )

        if _off_timetable(start_slot, duration):
            _reject_save(
                "session_off_timetable",
                (
                    f"Session starting at {start_slot} with duration {duration} "
                    "extends past the end of the timetable."
                ),
                session_id=item.session_id,
                start_slot=start_slot,
                duration=duration,
            )

    # Cross-item: room double-booking (checks multi-slot overlaps, not just same start slot).
    occupied: dict[tuple[str, str, str], str] = {}
    for item in items:
        session = sessions_map[item.session_id]
        duration = session.duration
        start_index = _slot_index(item.start_slot.value)
        slots_used = ORDERED_SLOTS[start_index : start_index + duration]
        for slot in slots_used:
            key = (item.day.value, item.room_id, slot)
            if key in occupied:
                room = rooms_map[item.room_id]
                _reject_save(
                    "room_double_booking",
                    (
                        f"Room '{room.name}' is already occupied on "
                        f"{item.day.value} at slot {slot}."
                    ),
                    session_id=item.session_id,
                    conflicting_session_id=occupied[key],
                    room_id=item.room_id,
                    day=item.day.value,
                    slot=slot,
                )
            occupied[key] = item.session_id

    # All checks passed — replace assignments in one transaction.
    db.query(TimetableAssignment).delete()

    new_records: list[TimetableAssignment] = []
    for item in items:
        record = TimetableAssignment(
            session_id=item.session_id,
            day=item.day,
            start_slot=item.start_slot,
            room_id=item.room_id,
        )
        db.add(record)
        new_records.append(record)

    db.commit()
    for record in new_records:
        db.refresh(record)

    logger.info("assignment_save_succeeded", saved_count=len(new_records))

    # Re-query with full eager loading so responses include all joined display data.
    saved_ids = [r.id for r in new_records]
    saved = _assignment_query(db).filter(TimetableAssignment.id.in_(saved_ids)).all()
    counts, allocated = _allocation_maps(db, saved)
    return [_build_response(a, counts, allocated) for a in saved]


def clear_assignments(db: DBSession) -> None:
    db.query(TimetableAssignment).delete()
    db.commit()
    logger.info("assignments_cleared")
