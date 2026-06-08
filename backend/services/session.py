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


def list_sessions_for_unit(db: DBSession, unit_id: str) -> list[Session]:
    _require_unit(db, unit_id)
    return db.query(Session).filter(Session.unit_id == unit_id).all()


def create_session(db: DBSession, unit_id: str, data: SessionCreate) -> Session:
    _require_unit(db, unit_id)
    session = Session(
        unit_id=unit_id,
        session_type=data.session_type,
        duration=data.duration,
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
    db.commit()
    db.refresh(session)
    return session


def delete_session(db: DBSession, session_id: str) -> None:
    session = _require_session(db, session_id)
    db.delete(session)
    db.commit()


def list_schedulable_sessions(db: DBSession) -> list[SchedulableSessionResponse]:
    sessions = (
        db.query(Session)
        .join(Unit, Session.unit_id == Unit.id)
        .filter(Unit.lecturer_id.isnot(None))
        .all()
    )
    results = []
    for s in sessions:
        unit = s.unit
        lecturer = unit.lecturer
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
