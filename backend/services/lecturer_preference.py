"""Lecturer preference persistence service (Unit 98).

Owns the list/upsert/delete logic for room-specific lecturer scheduling
preferences. A preference cell is ``lecturer_id + day + slot + room_id`` with
exactly one ``level`` (``preferred`` | ``avoid``); no row means neutral and
neutral is never stored.

Preferences are soft constraints only. This service persists submitted cells
as-is and performs no cross-validation against lecturer availability, timetable
blocks, or existing sessions — it only checks that the referenced lecturer and
room exist and that ``level`` is one of the two allowed values. Solver
integration is a later unit.
"""
import structlog
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from api.errors import AppError
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer
from models.lecturer_preference import LecturerPreference, PreferenceLevel
from models.room import Room
from schemas.lecturer_preference import (
    LecturerPreferenceDelete,
    LecturerPreferenceResponse,
    LecturerPreferenceUpsert,
)

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _require_lecturer(db: DBSession, lecturer_id: str) -> None:
    if db.get(Lecturer, lecturer_id) is None:
        raise AppError(
            "lecturer_not_found",
            f"Lecturer {lecturer_id} not found.",
            status_code=422,
        )


def _require_room(db: DBSession, room_id: str) -> None:
    if db.get(Room, room_id) is None:
        raise AppError(
            "room_not_found",
            f"Room {room_id} not found.",
            status_code=422,
        )


def _parse_level(level: str) -> PreferenceLevel:
    try:
        return PreferenceLevel(level)
    except ValueError:
        allowed = ", ".join(e.value for e in PreferenceLevel)
        raise AppError(
            "invalid_preference_level",
            f"Preference level must be one of: {allowed}.",
            status_code=422,
        )


def _get_cell(
    db: DBSession,
    lecturer_id: str,
    day: AvailabilityDay,
    slot: AvailabilitySlot,
    room_id: str,
) -> LecturerPreference | None:
    return (
        db.query(LecturerPreference)
        .filter(
            LecturerPreference.lecturer_id == lecturer_id,
            LecturerPreference.day == day,
            LecturerPreference.slot == slot,
            LecturerPreference.room_id == room_id,
        )
        .first()
    )


# ---------------------------------------------------------------------------
# Public service operations
# ---------------------------------------------------------------------------


def list_lecturer_preferences(
    db: DBSession, lecturer_id: str
) -> list[LecturerPreferenceResponse]:
    """Return all preference cells for one lecturer."""
    _require_lecturer(db, lecturer_id)
    rows = (
        db.query(LecturerPreference)
        .filter(LecturerPreference.lecturer_id == lecturer_id)
        .order_by(LecturerPreference.created_at)
        .all()
    )
    return [LecturerPreferenceResponse.model_validate(r) for r in rows]


def upsert_lecturer_preference(
    db: DBSession, data: LecturerPreferenceUpsert
) -> LecturerPreferenceResponse:
    """Create the cell if absent, or overwrite its ``level`` if present.

    Keyed by ``(lecturer_id, day, slot, room_id)``.
    """
    _require_lecturer(db, data.lecturer_id)
    _require_room(db, data.room_id)
    level = _parse_level(data.level)

    cell = _get_cell(db, data.lecturer_id, data.day, data.slot, data.room_id)
    if cell is None:
        cell = LecturerPreference(
            lecturer_id=data.lecturer_id,
            day=data.day,
            slot=data.slot,
            room_id=data.room_id,
            level=level,
        )
        db.add(cell)
    else:
        cell.level = level

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            "preference_cell_conflict",
            "Unable to save preference due to a database constraint violation.",
            status_code=409,
        )
    db.refresh(cell)
    logger.info(
        "lecturer_preference_upserted",
        lecturer_id=data.lecturer_id,
        level=level.value,
    )
    return LecturerPreferenceResponse.model_validate(cell)


def delete_lecturer_preference(
    db: DBSession, data: LecturerPreferenceDelete
) -> None:
    """Remove the cell entirely, returning it to neutral.

    Deleting an already-neutral cell is a no-op.
    """
    _require_lecturer(db, data.lecturer_id)
    _require_room(db, data.room_id)

    cell = _get_cell(db, data.lecturer_id, data.day, data.slot, data.room_id)
    if cell is None:
        return
    db.delete(cell)
    db.commit()
    logger.info(
        "lecturer_preference_deleted",
        lecturer_id=data.lecturer_id,
    )
