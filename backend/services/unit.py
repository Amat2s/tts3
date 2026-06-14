from sqlalchemy.orm import Session

from api.errors import AppError
from models.lecturer import Lecturer
from models.session import Session as TimetableSession
from models.student import Student
from models.unit import Unit
from schemas.unit import UnitCreate, UnitUpdate
from services.session_allocation import rebalance_unit_session_allocations
from services.year_level import parse_unit_year_level


def _require_lecturers(db: Session, lecturer_ids: list[str]) -> list[Lecturer]:
    """Validate every lecturer id exists, returning the deduplicated team.

    Order of first appearance is preserved so the persisted team is stable.
    """
    lecturers: list[Lecturer] = []
    seen: set[str] = set()
    for lid in lecturer_ids:
        if lid in seen:
            continue
        seen.add(lid)
        lecturer = db.query(Lecturer).filter(Lecturer.id == lid).first()
        if lecturer is None:
            raise AppError(
                "lecturer_not_found",
                f"Lecturer '{lid}' not found.",
                status_code=422,
            )
        lecturers.append(lecturer)
    return lecturers


def _require_students(db: Session, student_ids: list[str]) -> list[Student]:
    students = []
    for sid in student_ids:
        student = db.query(Student).filter(Student.id == sid).first()
        if student is None:
            raise AppError(
                "student_not_found",
                f"Student '{sid}' not found.",
                status_code=422,
            )
        students.append(student)
    return students


def _check_code_unique(db: Session, code: str, exclude_id: str | None = None) -> None:
    q = db.query(Unit).filter(Unit.code == code)
    if exclude_id is not None:
        q = q.filter(Unit.id != exclude_id)
    if q.first() is not None:
        raise AppError(
            "unit_code_conflict",
            f"Unit code '{code}' already exists.",
            status_code=409,
        )


def list_units(db: Session) -> list[Unit]:
    return db.query(Unit).order_by(Unit.code).all()


def get_unit(db: Session, unit_id: str) -> Unit:
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if unit is None:
        raise AppError("unit_not_found", "Unit not found.", status_code=404)
    return unit


def create_unit(db: Session, data: UnitCreate) -> Unit:
    _check_code_unique(db, data.code)
    lecturers = _require_lecturers(db, data.lecturer_ids)
    year_level = parse_unit_year_level(data.code)

    if data.student_ids is None:
        # No explicit list supplied: default to all students in the derived year.
        students = (
            db.query(Student).filter(Student.year_level == year_level).all()
        )
    else:
        # Explicit list (including empty) is respected exactly.
        students = _require_students(db, data.student_ids)

    unit = Unit(
        code=data.code,
        name=data.name,
        year_level=year_level,
        lecturers=lecturers,
        students=students,
    )
    db.add(unit)
    # Flush so the unit and its enrolment rows are queryable, then build the
    # hidden session-student allocations in the same transaction.
    db.flush()
    rebalance_unit_session_allocations(db, unit.id)
    db.commit()
    db.refresh(unit)
    return unit


def update_unit(db: Session, unit_id: str, data: UnitUpdate) -> Unit:
    unit = get_unit(db, unit_id)

    if data.code is not None:
        _check_code_unique(db, data.code, exclude_id=unit_id)
        unit.code = data.code
        # Recompute the derived year level when the code changes. This does NOT
        # touch the student list — enrolment is only changed via student_ids.
        unit.year_level = parse_unit_year_level(data.code)

    if data.name is not None:
        unit.name = data.name

    if data.lecturer_ids is not None:
        new_team = _require_lecturers(db, data.lecturer_ids)
        new_team_ids = {lec.id for lec in new_team}
        # Reject removing a lecturer who is still assigned to one or more
        # sessions of this unit. The fix is an explicit session reassignment
        # first; we never silently unset session lecturers.
        removed_ids = {lec.id for lec in unit.lecturers} - new_team_ids
        if removed_ids:
            orphaned = (
                db.query(TimetableSession)
                .filter(
                    TimetableSession.unit_id == unit_id,
                    TimetableSession.lecturer_id.in_(removed_ids),
                )
                .all()
            )
            if orphaned:
                orphaned_ids = ", ".join(sorted(s.id for s in orphaned))
                raise AppError(
                    "lecturer_still_assigned",
                    (
                        "Cannot remove a lecturer who is still assigned to "
                        f"{len(orphaned)} session(s) of this unit "
                        f"({orphaned_ids}). Reassign those sessions to another "
                        "teaching-team lecturer first."
                    ),
                    status_code=422,
                )
        unit.lecturers = new_team

    enrolment_changed = data.student_ids is not None
    if enrolment_changed:
        unit.students = _require_students(db, data.student_ids)

    # Enrolment changes alter who attends each lecture/tutorial, so refresh the
    # hidden allocations atomically with the update.
    if enrolment_changed:
        db.flush()
        rebalance_unit_session_allocations(db, unit.id)

    db.commit()
    db.refresh(unit)
    return unit


def delete_unit(db: Session, unit_id: str) -> None:
    unit = get_unit(db, unit_id)
    db.delete(unit)
    db.commit()
