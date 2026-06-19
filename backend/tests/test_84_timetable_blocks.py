"""Tests for Unit 84: backend timetable block persistence and API.

Covers the block service contract: persistence of groups + cells, room-specific
cells only, name/colour rules (unnamed = no colour, named = required colour),
request dedupe, room existence, duplicate-cell rejection across groups, the
update keep/replace-own-cells path, create/update unscheduling overlapping saved
assignments (with expanded session duration), and delete freeing cells without
rescheduling. Uses the in-memory SQLite ``db`` fixture from conftest.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from models.assignment import TimetableAssignment
from models.lecturer import (
    AvailabilityDay,
    AvailabilitySlot,
    Lecturer,
    LecturerTitle,
)
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.timetable_block import (
    BlockColour,
    TimetableBlockCell,
    TimetableBlockGroup,
)
from models.unit import Unit
from schemas.timetable_block import (
    BlockCellInput,
    TimetableBlockCreate,
    TimetableBlockUpdate,
)
from services.timetable_block import (
    create_timetable_block,
    delete_timetable_block,
    list_timetable_blocks,
    update_timetable_block,
)


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def make_room(db, room_id="room1", capacity=100) -> Room:
    r = Room(id=room_id, name=room_id, capacity=capacity, room_type=RoomType.LECTURE)
    db.add(r)
    db.commit()
    return r


def make_unit(db, unit_id="unit1", code="HIS101") -> Unit:
    u = Unit(id=unit_id, code=code, name="History", year_level=1)
    db.add(u)
    db.commit()
    return u


def make_lecturer(db, lecturer_id="lec1") -> Lecturer:
    lec = Lecturer(
        id=lecturer_id, title=LecturerTitle.DR, first_name="Ada", last_name="Lovelace"
    )
    db.add(lec)
    db.commit()
    return lec


def make_session(db, unit, lecturer, session_id="sess1", duration=1) -> Session:
    s = Session(
        id=session_id,
        unit_id=unit.id,
        session_type=SessionType.LECTURE,
        duration=duration,
        lecturer_id=lecturer.id,
    )
    db.add(s)
    db.commit()
    return s


def make_assignment(
    db,
    session,
    room,
    *,
    assignment_id="asg1",
    day=AvailabilityDay.MONDAY,
    start_slot=AvailabilitySlot.S1,
) -> TimetableAssignment:
    a = TimetableAssignment(
        id=assignment_id,
        session_id=session.id,
        day=day,
        start_slot=start_slot,
        room_id=room.id,
    )
    db.add(a)
    db.commit()
    return a


def cell(room_id="room1", day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1):
    return BlockCellInput(day=day, slot=slot, room_id=room_id)


# ---------------------------------------------------------------------------
# Persistence + room-specific cells
# ---------------------------------------------------------------------------


def test_create_unnamed_block_persists_group_and_cells(db):
    make_room(db, "room1")
    result = create_timetable_block(
        db, TimetableBlockCreate(name=None, colour=None, cells=[cell("room1")])
    )

    assert result.block.name is None
    assert result.block.colour is None
    assert len(result.block.cells) == 1
    assert result.unscheduled_session_ids == []

    groups = db.query(TimetableBlockGroup).all()
    cells = db.query(TimetableBlockCell).all()
    assert len(groups) == 1
    assert len(cells) == 1
    assert cells[0].room_id == "room1"
    assert cells[0].day == AvailabilityDay.MONDAY
    assert cells[0].slot == AvailabilitySlot.S1


def test_create_named_block_stores_name_and_colour(db):
    make_room(db, "room1")
    result = create_timetable_block(
        db,
        TimetableBlockCreate(
            name="Chapel", colour=BlockColour.GOLD, cells=[cell("room1")]
        ),
    )
    assert result.block.name == "Chapel"
    assert result.block.colour == BlockColour.GOLD


def test_block_cell_is_room_specific(db):
    make_room(db, "roomA")
    make_room(db, "roomB")
    create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("roomA")])
    )
    # roomB at the same day/slot is not blocked.
    cells = db.query(TimetableBlockCell).all()
    assert {c.room_id for c in cells} == {"roomA"}


# ---------------------------------------------------------------------------
# Name / colour rules
# ---------------------------------------------------------------------------


def test_blank_name_becomes_unnamed(db):
    make_room(db, "room1")
    result = create_timetable_block(
        db, TimetableBlockCreate(name="   ", colour=None, cells=[cell("room1")])
    )
    assert result.block.name is None


def test_name_is_trimmed(db):
    make_room(db, "room1")
    result = create_timetable_block(
        db,
        TimetableBlockCreate(
            name="  Chapel  ", colour=BlockColour.LIGHT_BLUE, cells=[cell("room1")]
        ),
    )
    assert result.block.name == "Chapel"


def test_named_block_without_colour_rejected(db):
    make_room(db, "room1")
    with pytest.raises(AppError) as exc:
        create_timetable_block(
            db, TimetableBlockCreate(name="Chapel", colour=None, cells=[cell("room1")])
        )
    assert exc.value.code == "block_named_without_colour"


def test_unnamed_block_with_colour_rejected(db):
    make_room(db, "room1")
    with pytest.raises(AppError) as exc:
        create_timetable_block(
            db,
            TimetableBlockCreate(
                name=None, colour=BlockColour.GOLD, cells=[cell("room1")]
            ),
        )
    assert exc.value.code == "block_unnamed_with_colour"


# ---------------------------------------------------------------------------
# Cells validation
# ---------------------------------------------------------------------------


def test_empty_cells_rejected(db):
    with pytest.raises(AppError) as exc:
        create_timetable_block(db, TimetableBlockCreate(cells=[]))
    assert exc.value.code == "block_no_cells"


def test_unknown_room_rejected(db):
    with pytest.raises(AppError) as exc:
        create_timetable_block(db, TimetableBlockCreate(cells=[cell("ghost")]))
    assert exc.value.code == "room_not_found"


def test_duplicate_cells_in_request_deduped(db):
    make_room(db, "room1")
    result = create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[cell("room1"), cell("room1"), cell("room1")]
        ),
    )
    assert len(result.block.cells) == 1
    assert db.query(TimetableBlockCell).count() == 1


def test_cell_blocked_by_another_group_rejected(db):
    make_room(db, "room1")
    create_timetable_block(db, TimetableBlockCreate(cells=[cell("room1")]))
    with pytest.raises(AppError) as exc:
        create_timetable_block(db, TimetableBlockCreate(cells=[cell("room1")]))
    assert exc.value.code == "cell_already_blocked"


def test_duplicate_blocked_cell_cannot_exist_at_rest(db):
    make_room(db, "room1")
    create_timetable_block(db, TimetableBlockCreate(cells=[cell("room1")]))
    # A different room/day/slot is fine and coexists.
    make_room(db, "room2")
    create_timetable_block(db, TimetableBlockCreate(cells=[cell("room2")]))
    keys = {
        (c.day, c.slot, c.room_id) for c in db.query(TimetableBlockCell).all()
    }
    assert len(keys) == db.query(TimetableBlockCell).count()


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


def test_list_returns_all_blocks(db):
    make_room(db, "room1")
    make_room(db, "room2")
    create_timetable_block(db, TimetableBlockCreate(cells=[cell("room1")]))
    create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[cell("room2", slot=AvailabilitySlot.S2)]
        ),
    )
    blocks = list_timetable_blocks(db)
    assert len(blocks) == 2


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def test_update_can_keep_own_cells(db):
    make_room(db, "room1")
    created = create_timetable_block(
        db, TimetableBlockCreate(name="Chapel", colour=BlockColour.GOLD, cells=[cell("room1")])
    )
    # Re-submitting the same cell for the same group must not collide with itself.
    updated = update_timetable_block(
        db,
        created.block.id,
        TimetableBlockUpdate(
            name="Chapel", colour=BlockColour.LIGHT_PINK, cells=[cell("room1")]
        ),
    )
    assert updated.block.colour == BlockColour.LIGHT_PINK
    assert len(updated.block.cells) == 1
    assert db.query(TimetableBlockCell).count() == 1


def test_update_replaces_cells(db):
    make_room(db, "room1")
    make_room(db, "room2")
    created = create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("room1")])
    )
    update_timetable_block(
        db,
        created.block.id,
        TimetableBlockUpdate(cells=[cell("room2", slot=AvailabilitySlot.S3)]),
    )
    cells = db.query(TimetableBlockCell).all()
    assert len(cells) == 1
    assert cells[0].room_id == "room2"
    assert cells[0].slot == AvailabilitySlot.S3


def test_update_rejects_cell_blocked_by_other_group(db):
    make_room(db, "room1")
    make_room(db, "room2")
    create_timetable_block(db, TimetableBlockCreate(cells=[cell("room1")]))
    other = create_timetable_block(db, TimetableBlockCreate(cells=[cell("room2")]))
    with pytest.raises(AppError) as exc:
        update_timetable_block(
            db, other.block.id, TimetableBlockUpdate(cells=[cell("room1")])
        )
    assert exc.value.code == "cell_already_blocked"


def test_update_missing_group_rejected(db):
    with pytest.raises(AppError) as exc:
        update_timetable_block(
            db, "missing", TimetableBlockUpdate(cells=[cell("room1")])
        )
    assert exc.value.code == "block_group_not_found"


# ---------------------------------------------------------------------------
# Assignment unscheduling on create / update
# ---------------------------------------------------------------------------


def test_create_unschedules_overlapping_assignment(db):
    room = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    session = make_session(db, unit, lec, duration=1)
    make_assignment(db, session, room, start_slot=AvailabilitySlot.S1)

    result = create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("room1", slot=AvailabilitySlot.S1)])
    )

    assert result.unscheduled_session_ids == [session.id]
    assert db.query(TimetableAssignment).count() == 0


def test_create_unschedules_multi_slot_assignment_via_duration_expansion(db):
    room = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    # Session starts at s1 and runs 3 slots (s1, s2, s3).
    session = make_session(db, unit, lec, duration=3)
    make_assignment(db, session, room, start_slot=AvailabilitySlot.S1)

    # Block only s3 — the assignment overlaps via its expanded duration.
    result = create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("room1", slot=AvailabilitySlot.S3)])
    )

    assert result.unscheduled_session_ids == [session.id]
    assert db.query(TimetableAssignment).count() == 0


def test_create_does_not_unschedule_nonoverlapping_assignment(db):
    room = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    session = make_session(db, unit, lec, duration=1)
    make_assignment(db, session, room, start_slot=AvailabilitySlot.S1)

    # Block a different slot in the same room.
    result = create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("room1", slot=AvailabilitySlot.S5)])
    )

    assert result.unscheduled_session_ids == []
    assert db.query(TimetableAssignment).count() == 1


def test_create_does_not_unschedule_other_room(db):
    room_a = make_room(db, "roomA")
    make_room(db, "roomB")
    unit = make_unit(db)
    lec = make_lecturer(db)
    session = make_session(db, unit, lec, duration=1)
    make_assignment(db, session, room_a, start_slot=AvailabilitySlot.S1)

    result = create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("roomB", slot=AvailabilitySlot.S1)])
    )
    assert result.unscheduled_session_ids == []
    assert db.query(TimetableAssignment).count() == 1


def test_update_unschedules_overlapping_assignment(db):
    room = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    session = make_session(db, unit, lec, duration=1)

    created = create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("room1", slot=AvailabilitySlot.S5)])
    )
    # Place an assignment at s1, then move the block to s1 via update.
    make_assignment(db, session, room, start_slot=AvailabilitySlot.S1)
    result = update_timetable_block(
        db,
        created.block.id,
        TimetableBlockUpdate(cells=[cell("room1", slot=AvailabilitySlot.S1)]),
    )
    assert result.unscheduled_session_ids == [session.id]
    assert db.query(TimetableAssignment).count() == 0


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_delete_frees_cells_without_rescheduling(db):
    room = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    session = make_session(db, unit, lec, duration=1)
    make_assignment(db, session, room, start_slot=AvailabilitySlot.S5)

    created = create_timetable_block(
        db, TimetableBlockCreate(cells=[cell("room1", slot=AvailabilitySlot.S1)])
    )
    delete_timetable_block(db, created.block.id)

    assert db.query(TimetableBlockGroup).count() == 0
    assert db.query(TimetableBlockCell).count() == 0
    # Delete does not touch assignments.
    assert db.query(TimetableAssignment).count() == 1


def test_delete_missing_group_rejected(db):
    with pytest.raises(AppError) as exc:
        delete_timetable_block(db, "missing")
    assert exc.value.code == "block_group_not_found"


def test_delete_cascades_cells(db):
    make_room(db, "room1")
    created = create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[
                cell("room1", slot=AvailabilitySlot.S1),
                cell("room1", slot=AvailabilitySlot.S2),
            ]
        ),
    )
    assert db.query(TimetableBlockCell).count() == 2
    delete_timetable_block(db, created.block.id)
    assert db.query(TimetableBlockCell).count() == 0
