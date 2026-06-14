from sqlalchemy.orm import Session

from api.errors import AppError
from models.student import Student
from models.unit import Unit
from schemas.student import StudentCreate, StudentUpdate


def list_students(db: Session) -> list[Student]:
    return db.query(Student).order_by(Student.last_name, Student.first_name).all()


def get_student(db: Session, student_id: str) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise AppError("student_not_found", "Student not found.", status_code=404)
    return student


def create_student(db: Session, data: StudentCreate) -> Student:
    # Auto-enrol the new student into every existing unit whose derived
    # year_level matches, in the same transaction as student creation.
    matching_units = (
        db.query(Unit).filter(Unit.year_level == data.year_level).all()
    )
    student = Student(
        title=data.title,
        first_name=data.first_name,
        last_name=data.last_name,
        year_level=data.year_level,
        units=matching_units,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def update_student(db: Session, student_id: str, data: StudentUpdate) -> Student:
    student = get_student(db, student_id)
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
    db.delete(student)
    db.commit()
