from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.errors import AppError
from models.student import Student
from models.unit import Unit
from schemas.student import StudentCreate, StudentUpdate
from services.session_allocation import rebalance_unit_session_allocations


def _check_student_number_unique(
    db: Session, student_number: str, exclude_id: str | None = None
) -> None:
    """Reject a duplicate student number, excluding the student's own row on update."""
    q = db.query(Student).filter(Student.student_number == student_number)
    if exclude_id is not None:
        q = q.filter(Student.id != exclude_id)
    if q.first() is not None:
        raise AppError(
            "student_number_conflict",
            f"Student number '{student_number}' already exists.",
            status_code=409,
        )


def list_students(db: Session) -> list[Student]:
    return db.query(Student).order_by(Student.last_name, Student.first_name).all()


def get_student(db: Session, student_id: str) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise AppError("student_not_found", "Student not found.", status_code=404)
    return student


def create_student(db: Session, data: StudentCreate) -> Student:
    # The student number is already trimmed/validated (exactly 8 digits) by the
    # schema; reject a duplicate before persisting.
    _check_student_number_unique(db, data.student_number)
    # Auto-enrol the new student into every existing unit whose derived
    # year_level matches, in the same transaction as student creation.
    matching_units = (
        db.query(Unit).filter(Unit.year_level == data.year_level).all()
    )
    student = Student(
        student_number=data.student_number,
        first_name=data.first_name,
        last_name=data.last_name,
        year_level=data.year_level,
        units=matching_units,
    )
    db.add(student)
    # Refresh allocations for every unit the student was auto-enrolled into so
    # the new student joins each lecture and one tutorial group, atomically.
    db.flush()
    for unit in matching_units:
        rebalance_unit_session_allocations(db, unit.id)
    db.commit()
    db.refresh(student)
    return student


def update_student(db: Session, student_id: str, data: StudentUpdate) -> Student:
    student = get_student(db, student_id)
    # When a new student number is supplied it is already trimmed/validated by
    # the schema; reject a duplicate that belongs to a different student.
    if data.student_number is not None:
        _check_student_number_unique(db, data.student_number, exclude_id=student_id)
    # Only scalar fields are updated here. Enrolments are preserved: changing
    # year_level does NOT silently add or remove unit memberships. Enrolment
    # changes happen through unit updates (and a later student-side endpoint).
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student


def delete_student(db: Session, student_id: str) -> None:
    student = get_student(db, student_id)
    # Capture affected units before deletion. The student's allocation rows are
    # removed by cascade; remaining tutorial groups are then rebalanced so the
    # removed student's slot is redistributed.
    affected_unit_ids = [unit.id for unit in student.units]
    db.delete(student)
    try:
        db.flush()
        for unit_id in affected_unit_ids:
            rebalance_unit_session_allocations(db, unit_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            "student_delete_blocked",
            "Can't delete this student yet — they're still referenced elsewhere.",
            status_code=409,
        )


def delete_all_students(db: Session) -> int:
    """Delete every student, atomically. Returns the number of students deleted."""
    students = db.query(Student).all()
    affected_unit_ids = {unit.id for student in students for unit in student.units}
    count = len(students)
    for student in students:
        db.delete(student)
    try:
        db.flush()
        for unit_id in affected_unit_ids:
            rebalance_unit_session_allocations(db, unit_id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            "student_delete_blocked",
            "Can't delete all students yet — some are still referenced elsewhere.",
            status_code=409,
        )
    return count
