from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession, selectinload

from api.errors import AppError
from models.assignment import AssignmentDay, AssignmentSlot, TimetableAssignment
from models.room import Room
from models.session import Session
from models.unit import Unit
from schemas.assignment import (
    AssignmentCreate,
    AssignmentMove,
    AssignmentResponse,
    AssignmentRoomSummary,
    AssignmentSessionSummary,
    AssignmentUnitSummary,
)


DAY_ORDER = {
    AssignmentDay.MONDAY: 0,
    AssignmentDay.TUESDAY: 1,
    AssignmentDay.WEDNESDAY: 2,
    AssignmentDay.THURSDAY: 3,
    AssignmentDay.FRIDAY: 4,
}

SLOT_ORDER = {
    AssignmentSlot.S1: 0,
    AssignmentSlot.S2: 1,
    AssignmentSlot.S3: 2,
    AssignmentSlot.S4: 3,
    AssignmentSlot.S5: 4,
    AssignmentSlot.S6: 5,
    AssignmentSlot.S7: 6,
}


def _assignment_query(db: DBSession):
    return db.query(TimetableAssignment).options(
        selectinload(TimetableAssignment.room),
        selectinload(TimetableAssignment.session)
        .selectinload(Session.unit)
        .selectinload(Unit.lecturer),
        selectinload(TimetableAssignment.session)
        .selectinload(Session.unit)
        .selectinload(Unit.students),
    )


def _assignment_sort_key(assignment: TimetableAssignment) -> tuple[int, str, int]:
    room_name = assignment.room.name if assignment.room is not None else ""
    return (
        DAY_ORDER[assignment.day],
        room_name,
        SLOT_ORDER[assignment.start_slot],
    )


def _require_session(db: DBSession, session_id: str) -> Session:
    session = db.query(Session).filter(Session.id == session_id).first()
    if session is None:
        raise AppError("session_not_found", "Session not found.", status_code=404)
    return session


def _require_room(db: DBSession, room_id: str) -> Room:
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise AppError("room_not_found", "Room not found.", status_code=404)
    return room


def _require_assignment(db: DBSession, assignment_id: str) -> TimetableAssignment:
    assignment = (
        _assignment_query(db).filter(TimetableAssignment.id == assignment_id).first()
    )
    if assignment is None:
        raise AppError(
            "assignment_not_found", "Assignment not found.", status_code=404
        )
    return assignment


def _to_response(assignment: TimetableAssignment) -> AssignmentResponse:
    session = assignment.session
    unit = session.unit
    lecturer = unit.lecturer
    return AssignmentResponse(
        id=assignment.id,
        session_id=assignment.session_id,
        room_id=assignment.room_id,
        day=assignment.day,
        start_slot=assignment.start_slot,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
        session=AssignmentSessionSummary(
            id=session.id,
            unit_id=unit.id,
            session_type=session.session_type,
            duration=session.duration,
            lecturer_id=lecturer.id,
            lecturer_display_name=(
                f"{lecturer.title.value} {lecturer.first_name} {lecturer.last_name}"
            ),
            student_count=len(unit.students),
        ),
        unit=AssignmentUnitSummary(
            id=unit.id,
            code=unit.code,
            name=unit.name,
        ),
        room=AssignmentRoomSummary(
            id=assignment.room.id,
            name=assignment.room.name,
        ),
    )


def list_assignments(db: DBSession) -> list[AssignmentResponse]:
    assignments = _assignment_query(db).all()
    return [_to_response(assignment) for assignment in sorted(assignments, key=_assignment_sort_key)]


def schedule_session(db: DBSession, data: AssignmentCreate) -> AssignmentResponse:
    session = _require_session(db, data.session_id)
    _require_room(db, data.room_id)
    if session.assignment is not None:
        raise AppError(
            "session_already_scheduled",
            "Session already has an assignment.",
            status_code=409,
        )

    assignment = TimetableAssignment(
        session_id=data.session_id,
        room_id=data.room_id,
        day=data.day,
        start_slot=data.start_slot,
    )
    db.add(assignment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            "session_already_scheduled",
            "Session already has an assignment.",
            status_code=409,
        )
    return _to_response(_require_assignment(db, assignment.id))


def move_assignment(
    db: DBSession, assignment_id: str, data: AssignmentMove
) -> AssignmentResponse:
    assignment = _require_assignment(db, assignment_id)
    _require_room(db, data.room_id)
    assignment.room_id = data.room_id
    assignment.day = data.day
    assignment.start_slot = data.start_slot
    db.commit()
    return _to_response(_require_assignment(db, assignment_id))


def unschedule_assignment(db: DBSession, assignment_id: str) -> None:
    assignment = _require_assignment(db, assignment_id)
    db.delete(assignment)
    db.commit()
