from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from api.errors import AppError
from models.session import Session
from models.unit import Unit
from schemas.session import SchedulableSessionResponse, SessionCreate, SessionUpdate
from services.session_allocation import (
    allocated_student_ids,
    allocation_counts,
    rebalance_unit_session_allocations,
)


def _require_unit(db: DBSession, unit_id: str) -> Unit:
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if unit is None:
        raise AppError("unit_not_found", "Unit not found.", status_code=404)
    return unit


def _require_session(db: DBSession, session_id: str) -> Session:
    session = db.query(Session).filter(Session.id == session_id).first()
    if session is None:
        raise AppError("session_not_found", "Session not found.", status_code=404)
    return session


def _team_ids(unit: Unit) -> set[str]:
    return {lec.id for lec in unit.lecturers}


def _resolve_create_lecturer(unit: Unit, lecturer_id: str | None) -> str:
    """Resolve the lecturer for a new session against the unit's teaching team.

    - explicit id: must belong to the team;
    - omitted with exactly one teaching lecturer: default to that lecturer;
    - omitted with multiple (or zero) teaching lecturers: reject — the UI must
      supply a lecturer (Unit 63), and we never create an unschedulable session
      silently here.
    """
    team = _team_ids(unit)
    if lecturer_id is not None:
        if lecturer_id not in team:
            raise AppError(
                "lecturer_not_in_team",
                "The selected lecturer is not part of this unit's teaching team.",
                status_code=422,
            )
        return lecturer_id
    if len(team) == 1:
        return next(iter(team))
    raise AppError(
        "lecturer_required",
        (
            "This unit has multiple teaching lecturers; a session lecturer must "
            "be specified."
        ),
        status_code=422,
    )


def list_sessions_for_unit(db: DBSession, unit_id: str) -> list[Session]:
    _require_unit(db, unit_id)
    return db.query(Session).filter(Session.unit_id == unit_id).all()


def create_session(db: DBSession, unit_id: str, data: SessionCreate) -> Session:
    unit = _require_unit(db, unit_id)
    lecturer_id = _resolve_create_lecturer(unit, data.lecturer_id)
    session = Session(
        unit_id=unit_id,
        session_type=data.session_type,
        duration=data.duration,
        lecturer_id=lecturer_id,
    )
    db.add(session)
    # Refresh hidden allocations: a new lecture gets every enrolled student; a
    # new tutorial triggers an even rebalance across tutorial sessions.
    db.flush()
    rebalance_unit_session_allocations(db, unit_id)
    db.commit()
    db.refresh(session)
    return session


def update_session(db: DBSession, session_id: str, data: SessionUpdate) -> Session:
    session = _require_session(db, session_id)
    type_changed = (
        data.session_type is not None and data.session_type != session.session_type
    )
    if data.session_type is not None:
        session.session_type = data.session_type
    if data.duration is not None:
        session.duration = data.duration
    if data.lecturer_id is not None:
        # The new lecturer must belong to the parent unit's teaching team.
        if data.lecturer_id not in _team_ids(session.unit):
            raise AppError(
                "lecturer_not_in_team",
                "The selected lecturer is not part of this unit's teaching team.",
                status_code=422,
            )
        session.lecturer_id = data.lecturer_id
    # Switching lecture<->tutorial changes which allocation rule applies, so
    # refresh the unit's allocations atomically.
    if type_changed:
        db.flush()
        rebalance_unit_session_allocations(db, session.unit_id)
    db.commit()
    db.refresh(session)
    return session


def delete_session(db: DBSession, session_id: str) -> None:
    session = _require_session(db, session_id)
    unit_id = session.unit_id
    db.delete(session)
    # Narrowly convert only a delete/flush integrity failure into a 409: a
    # session still referenced elsewhere (no cascade) surfaces here. Rebalance
    # and commit stay outside so their failures propagate as themselves rather
    # than being mislabelled a dependency block.
    try:
        db.flush()
    except IntegrityError as err:
        db.rollback()
        raise AppError(
            "session_delete_blocked",
            "Can't delete this session yet — it's still referenced elsewhere.",
            status_code=409,
        ) from err
    # The deleted session's allocation rows cascade away; rebalance so a removed
    # tutorial's students are redistributed across the remaining tutorials.
    rebalance_unit_session_allocations(db, unit_id)
    db.commit()


def list_schedulable_sessions(db: DBSession) -> list[SchedulableSessionResponse]:
    # Unit 59: schedulability is driven by the session-level lecturer. Sessions
    # without an assigned lecturer are excluded until one is assigned.
    sessions = (
        db.query(Session)
        .join(Unit, Session.unit_id == Unit.id)
        .filter(Session.lecturer_id.isnot(None))
        .all()
    )
    # Unit 60: per-session student membership comes from the hidden allocation
    # rows, not from assuming every unit student attends every session.
    session_ids = [s.id for s in sessions]
    counts = allocation_counts(db, session_ids)
    allocated = allocated_student_ids(db, session_ids)

    results = []
    for s in sessions:
        unit = s.unit
        lecturer = s.lecturer
        if lecturer is None:
            # Defensive: lecturer_id is set but the row is missing — not schedulable.
            continue
        results.append(
            SchedulableSessionResponse(
                session_id=s.id,
                unit_id=unit.id,
                unit_code=unit.code,
                unit_name=unit.name,
                session_type=s.session_type,
                duration=s.duration,
                lecturer_id=lecturer.id,
                lecturer_display_name=f"{lecturer.title.value} {lecturer.first_name} {lecturer.last_name}",
                student_count=counts.get(s.id, 0),
                allocated_student_ids=allocated.get(s.id, []),
            )
        )
    return results
