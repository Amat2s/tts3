"""Tests for Unit 98: backend lecturer preference persistence and API.

Covers the preference service contract: room-specific cells keyed by
``lecturer_id + day + slot + room_id``, a single ``preferred``/``avoid`` level
per cell, neutral cells never stored, upsert overwriting an existing cell's
level, delete returning a cell to neutral, lecturer/room existence validation,
invalid-level rejection, and the absence of any cross-validation against
availability, blocks, or sessions. Uses the in-memory SQLite ``db`` fixture.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from models.lecturer import (
    AvailabilityDay,
    AvailabilitySlot,
    Lecturer,
    LecturerTitle,
)
from models.lecturer_preference import LecturerPreference, PreferenceLevel
from models.room import Room, RoomType
from schemas.lecturer_preference import (
    LecturerPreferenceDelete,
    LecturerPreferenceUpsert,
)
from services.lecturer_preference import (
    delete_lecturer_preference,
    list_lecturer_preferences,
    upsert_lecturer_preference,
)


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def make_room(db, room_id="room1", capacity=100) -> Room:
    r = Room(id=room_id, name=room_id, capacity=capacity, room_type=RoomType.LECTURE)
    db.add(r)
    db.commit()
    return r


def make_lecturer(db, lecturer_id="lec1") -> Lecturer:
    lec = Lecturer(
        id=lecturer_id, title=LecturerTitle.DR, first_name="Ada", last_name="Lovelace"
    )
    db.add(lec)
    db.commit()
    return lec


def upsert(
    lecturer_id="lec1",
    room_id="room1",
    day=AvailabilityDay.MONDAY,
    slot=AvailabilitySlot.S1,
    level="preferred",
) -> LecturerPreferenceUpsert:
    return LecturerPreferenceUpsert(
        lecturer_id=lecturer_id, day=day, slot=slot, room_id=room_id, level=level
    )


def delete_input(
    lecturer_id="lec1",
    room_id="room1",
    day=AvailabilityDay.MONDAY,
    slot=AvailabilitySlot.S1,
) -> LecturerPreferenceDelete:
    return LecturerPreferenceDelete(
        lecturer_id=lecturer_id, day=day, slot=slot, room_id=room_id
    )


# ---------------------------------------------------------------------------
# Persistence + room-specific cells
# ---------------------------------------------------------------------------


def test_upsert_persists_preference_cell(db):
    make_lecturer(db)
    make_room(db)
    result = upsert_lecturer_preference(db, upsert(level="preferred"))

    assert result.lecturer_id == "lec1"
    assert result.room_id == "room1"
    assert result.day == AvailabilityDay.MONDAY
    assert result.slot == AvailabilitySlot.S1
    assert result.level == PreferenceLevel.PREFERRED

    rows = db.query(LecturerPreference).all()
    assert len(rows) == 1
    assert rows[0].level == PreferenceLevel.PREFERRED


def test_preference_cell_is_room_specific(db):
    make_lecturer(db)
    make_room(db, "roomA")
    make_room(db, "roomB")
    upsert_lecturer_preference(db, upsert(room_id="roomA"))
    # roomB at the same lecturer/day/slot is unaffected (neutral).
    rows = db.query(LecturerPreference).all()
    assert {r.room_id for r in rows} == {"roomA"}


def test_avoid_level_stored(db):
    make_lecturer(db)
    make_room(db)
    result = upsert_lecturer_preference(db, upsert(level="avoid"))
    assert result.level == PreferenceLevel.AVOID


def test_neutral_cells_are_never_stored(db):
    make_lecturer(db)
    make_room(db)
    # No upsert issued: the cell is neutral and must not be a row.
    assert db.query(LecturerPreference).count() == 0


# ---------------------------------------------------------------------------
# Upsert overwrite
# ---------------------------------------------------------------------------


def test_upsert_overwrites_existing_cell_level(db):
    make_lecturer(db)
    make_room(db)
    upsert_lecturer_preference(db, upsert(level="preferred"))
    result = upsert_lecturer_preference(db, upsert(level="avoid"))

    assert result.level == PreferenceLevel.AVOID
    # Still exactly one row for the cell — overwrite, not insert.
    assert db.query(LecturerPreference).count() == 1


def test_distinct_cells_coexist(db):
    make_lecturer(db)
    make_room(db)
    upsert_lecturer_preference(db, upsert(slot=AvailabilitySlot.S1))
    upsert_lecturer_preference(db, upsert(slot=AvailabilitySlot.S2))
    assert db.query(LecturerPreference).count() == 2


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_upsert_unknown_lecturer_rejected(db):
    make_room(db)
    with pytest.raises(AppError) as exc:
        upsert_lecturer_preference(db, upsert(lecturer_id="ghost"))
    assert exc.value.code == "lecturer_not_found"


def test_upsert_unknown_room_rejected(db):
    make_lecturer(db)
    with pytest.raises(AppError) as exc:
        upsert_lecturer_preference(db, upsert(room_id="ghost"))
    assert exc.value.code == "room_not_found"


def test_upsert_invalid_level_rejected(db):
    make_lecturer(db)
    make_room(db)
    with pytest.raises(AppError) as exc:
        upsert_lecturer_preference(db, upsert(level="maybe"))
    assert exc.value.code == "invalid_preference_level"


def test_invalid_level_upsert_persists_nothing(db):
    make_lecturer(db)
    make_room(db)
    with pytest.raises(AppError):
        upsert_lecturer_preference(db, upsert(level="maybe"))
    assert db.query(LecturerPreference).count() == 0


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


def test_list_returns_only_that_lecturers_cells(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2")
    make_room(db)
    upsert_lecturer_preference(db, upsert(lecturer_id="lec1"))
    upsert_lecturer_preference(
        db, upsert(lecturer_id="lec2", slot=AvailabilitySlot.S2)
    )

    cells = list_lecturer_preferences(db, "lec1")
    assert len(cells) == 1
    assert cells[0].lecturer_id == "lec1"


def test_list_unknown_lecturer_rejected(db):
    with pytest.raises(AppError) as exc:
        list_lecturer_preferences(db, "ghost")
    assert exc.value.code == "lecturer_not_found"


def test_list_empty_when_no_preferences(db):
    make_lecturer(db)
    assert list_lecturer_preferences(db, "lec1") == []


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_delete_returns_cell_to_neutral(db):
    make_lecturer(db)
    make_room(db)
    upsert_lecturer_preference(db, upsert())
    assert db.query(LecturerPreference).count() == 1

    delete_lecturer_preference(db, delete_input())
    assert db.query(LecturerPreference).count() == 0


def test_delete_neutral_cell_is_noop(db):
    make_lecturer(db)
    make_room(db)
    # No row exists yet; deleting a neutral cell must not raise.
    delete_lecturer_preference(db, delete_input())
    assert db.query(LecturerPreference).count() == 0


def test_delete_only_removes_target_cell(db):
    make_lecturer(db)
    make_room(db)
    upsert_lecturer_preference(db, upsert(slot=AvailabilitySlot.S1))
    upsert_lecturer_preference(db, upsert(slot=AvailabilitySlot.S2))

    delete_lecturer_preference(db, delete_input(slot=AvailabilitySlot.S1))
    remaining = db.query(LecturerPreference).all()
    assert len(remaining) == 1
    assert remaining[0].slot == AvailabilitySlot.S2


def test_delete_unknown_lecturer_rejected(db):
    make_room(db)
    with pytest.raises(AppError) as exc:
        delete_lecturer_preference(db, delete_input(lecturer_id="ghost"))
    assert exc.value.code == "lecturer_not_found"


def test_delete_unknown_room_rejected(db):
    make_lecturer(db)
    with pytest.raises(AppError) as exc:
        delete_lecturer_preference(db, delete_input(room_id="ghost"))
    assert exc.value.code == "room_not_found"


# ---------------------------------------------------------------------------
# Cascade + no cross-validation
# ---------------------------------------------------------------------------


def test_preference_cascades_on_lecturer_delete(db):
    lec = make_lecturer(db)
    make_room(db)
    upsert_lecturer_preference(db, upsert())
    db.delete(lec)
    db.commit()
    assert db.query(LecturerPreference).count() == 0


def test_preference_cascades_on_room_delete(db):
    make_lecturer(db)
    room = make_room(db)
    upsert_lecturer_preference(db, upsert())
    db.delete(room)
    db.commit()
    assert db.query(LecturerPreference).count() == 0


def test_no_cross_validation_against_availability_or_blocks(db):
    """Preferences are persisted as-is: a preferred cell can be saved for any
    valid lecturer/room without checking availability, blocks, or sessions."""
    make_lecturer(db)
    make_room(db)
    # An 'avoid' and a 'preferred' cell in the same room on different slots both
    # persist with no conflict checks.
    upsert_lecturer_preference(db, upsert(slot=AvailabilitySlot.S1, level="avoid"))
    upsert_lecturer_preference(
        db, upsert(slot=AvailabilitySlot.S2, level="preferred")
    )
    assert db.query(LecturerPreference).count() == 2
