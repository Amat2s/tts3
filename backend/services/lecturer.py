from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from api.errors import AppError
from models.lecturer import Lecturer, LecturerAvailability
from models.session import Session as TimetableSession
from models.unit import Unit
from schemas.lecturer import (
    AvailabilityEntry,
    LecturerAvailabilitySet,
    LecturerCreate,
    LecturerUpdate,
)

# Cap the number of unit codes enumerated in a delete-blocked message.
_MAX_LISTED_UNITS = 5


def list_lecturers(db: Session) -> list[Lecturer]:
    return (
        db.query(Lecturer)
        .options(selectinload(Lecturer.unavailable_slots))
        .order_by(Lecturer.last_name, Lecturer.first_name)
        .all()
    )


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


def _blocking_unit_codes(db: Session, lecturer_id: str) -> list[str]:
    """Unit codes of sessions still taught by this lecturer (``Session.lecturer_id``).

    Unlike ``unit_lecturers`` team membership (which cascades away on delete),
    ``Session.lecturer_id`` has no cascade, so a session still assigned to this
    lecturer would otherwise fail with a raw ``IntegrityError``.
    """
    codes = (
        db.query(Unit.code)
        .join(TimetableSession, TimetableSession.unit_id == Unit.id)
        .filter(TimetableSession.lecturer_id == lecturer_id)
        .distinct()
        .order_by(Unit.code)
        .all()
    )
    return [c[0] for c in codes]


def _format_unit_list(codes: list[str]) -> str:
    shown = codes[:_MAX_LISTED_UNITS]
    remaining = len(codes) - len(shown)
    text = ", ".join(shown)
    if remaining > 0:
        text += f", and {remaining} more"
    return text


def delete_lecturer(db: Session, lecturer_id: str) -> None:
    lecturer = get_lecturer(db, lecturer_id)

    blocking_codes = _blocking_unit_codes(db, lecturer_id)
    if blocking_codes:
        raise AppError(
            "lecturer_delete_blocked",
            (
                "Can't delete this lecturer yet — they're on the teaching "
                f"team of {_format_unit_list(blocking_codes)}. Reassign or "
                "remove their sessions in those units first."
            ),
            status_code=409,
        )

    db.delete(lecturer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            "lecturer_delete_blocked",
            "Can't delete this lecturer yet — they're still referenced elsewhere.",
            status_code=409,
        )


def set_availability(
    db: Session, lecturer_id: str, data: LecturerAvailabilitySet
) -> Lecturer:
    # This endpoint replaces the lecturer's full set of unavailable slots.
    # We use a delete/flush/reinsert transaction instead of relationship
    # assignment: incremental ORM mutation was leaving stale rows and tripping
    # the (lecturer_id, day, slot) unique constraint on repeated saves.
    lecturer = get_lecturer(db, lecturer_id)

    # Deduplicate identical day/slot pairs in the request so duplicate entries
    # never produce duplicate rows (and never trip the unique constraint). The
    # day/slot values themselves are already validated as enums by Pydantic at
    # the request boundary, which returns a structured 422 on invalid values.
    seen: set[tuple[str, str]] = set()
    deduped: list[AvailabilityEntry] = []
    for entry in data.unavailable:
        key = (entry.day.value, entry.slot.value)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)

    try:
        # Delete every existing unavailable row for this lecturer, flush the
        # delete so it lands before the inserts, then insert the new set.
        db.execute(
            delete(LecturerAvailability).where(
                LecturerAvailability.lecturer_id == lecturer_id
            )
        )
        db.flush()
        for entry in deduped:
            db.add(
                LecturerAvailability(
                    lecturer_id=lecturer_id,
                    day=entry.day,
                    slot=entry.slot,
                )
            )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise AppError(
            "availability_save_failed",
            "Could not save lecturer availability.",
            status_code=500,
        ) from exc

    # Reload the relationship from the database so the response reflects the
    # final saved state rather than any stale in-memory collection.
    db.refresh(lecturer, attribute_names=["unavailable_slots"])
    return lecturer
