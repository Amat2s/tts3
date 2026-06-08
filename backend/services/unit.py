from sqlalchemy.orm import Session

from api.errors import AppError
from models.lecturer import Lecturer
from models.student import Student
from models.unit import Unit
from schemas.unit import UnitCreate, UnitUpdate


def _require_lecturer(db: Session, lecturer_id: str) -> Lecturer:
    lecturer = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
    if lecturer is None:
        raise AppError(
            "lecturer_not_found",
            f"Lecturer '{lecturer_id}' not found.",
            status_code=422,
        )
    return lecturer


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
    _require_lecturer(db, data.lecturer_id)
    students = _require_students(db, data.student_ids)

    unit = Unit(
        code=data.code,
        name=data.name,
        lecturer_id=data.lecturer_id,
        students=students,
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


def update_unit(db: Session, unit_id: str, data: UnitUpdate) -> Unit:
    unit = get_unit(db, unit_id)

    if data.code is not None:
        _check_code_unique(db, data.code, exclude_id=unit_id)
        unit.code = data.code

    if data.name is not None:
        unit.name = data.name

    if data.lecturer_id is not None:
        _require_lecturer(db, data.lecturer_id)
        unit.lecturer_id = data.lecturer_id

    if data.student_ids is not None:
        unit.students = _require_students(db, data.student_ids)

    db.commit()
    db.refresh(unit)
    return unit


def delete_unit(db: Session, unit_id: str) -> None:
    unit = get_unit(db, unit_id)
    db.delete(unit)
    db.commit()
