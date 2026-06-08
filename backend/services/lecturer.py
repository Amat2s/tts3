from sqlalchemy.orm import Session

from api.errors import AppError
from models.lecturer import Lecturer, LecturerAvailability
from schemas.lecturer import LecturerAvailabilitySet, LecturerCreate, LecturerUpdate


def list_lecturers(db: Session) -> list[Lecturer]:
    return db.query(Lecturer).order_by(Lecturer.last_name, Lecturer.first_name).all()


def get_lecturer(db: Session, lecturer_id: str) -> Lecturer:
    lecturer = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
    if lecturer is None:
        raise AppError("lecturer_not_found", "Lecturer not found.", status_code=404)
    return lecturer


def create_lecturer(db: Session, data: LecturerCreate) -> Lecturer:
    lecturer = Lecturer(
        title=data.title,
        first_name=data.first_name,
        last_name=data.last_name,
    )
    db.add(lecturer)
    db.commit()
    db.refresh(lecturer)
    return lecturer


def update_lecturer(db: Session, lecturer_id: str, data: LecturerUpdate) -> Lecturer:
    lecturer = get_lecturer(db, lecturer_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lecturer, key, value)
    db.commit()
    db.refresh(lecturer)
    return lecturer


def delete_lecturer(db: Session, lecturer_id: str) -> None:
    lecturer = get_lecturer(db, lecturer_id)
    db.delete(lecturer)
    db.commit()


def set_availability(
    db: Session, lecturer_id: str, data: LecturerAvailabilitySet
) -> Lecturer:
    lecturer = get_lecturer(db, lecturer_id)
    lecturer.unavailable_slots.clear()
    for entry in data.unavailable:
        lecturer.unavailable_slots.append(
            LecturerAvailability(
                lecturer_id=lecturer_id,
                day=entry.day,
                slot=entry.slot,
            )
        )
    db.commit()
    db.refresh(lecturer)
    return lecturer
