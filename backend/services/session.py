from sqlalchemy.orm import Session as DBSession

from api.errors import AppError
from models.session import Session
from models.unit import Unit
from schemas.session import SchedulableSessionResponse, SessionCreate, SessionUpdate


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
    db.commit()
    db.refresh(session)
    return session


def update_session(db: DBSession, session_id: str, data: SessionUpdate) -> Session:
    session = _require_session(db, session_id)
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
    db.commit()
    db.refresh(session)
    return session


def delete_session(db: DBSession, session_id: str) -> None:
    session = _require_session(db, session_id)
    db.delete(session)
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
                student_count=len(unit.students),
            )
        )
    return results
