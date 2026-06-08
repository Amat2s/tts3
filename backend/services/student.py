from sqlalchemy.orm import Session

from api.errors import AppError
from models.student import Student
from schemas.student import StudentCreate, StudentUpdate


def list_students(db: Session) -> list[Student]:
    return db.query(Student).order_by(Student.last_name, Student.first_name).all()


def get_student(db: Session, student_id: str) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise AppError("student_not_found", "Student not found.", status_code=404)
    return student


def create_student(db: Session, data: StudentCreate) -> Student:
    student = Student(
        title=data.title,
        first_name=data.first_name,
        last_name=data.last_name,
        year_level=data.year_level,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def update_student(db: Session, student_id: str, data: StudentUpdate) -> Student:
    student = get_student(db, student_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student


def delete_student(db: Session, student_id: str) -> None:
    student = get_student(db, student_id)
    db.delete(student)
    db.commit()
