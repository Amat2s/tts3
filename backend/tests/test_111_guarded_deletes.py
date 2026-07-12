"""Tests for Unit 111: backend guarded deletes with dependency reasons.

Covers the structured 409 ``*_delete_blocked`` path for a lecturer still
assigned to teach a session, and confirms deletes that are defined to cascade
(room, unit, student, session) still succeed and perform their existing
cascade/rebalance behavior. Uses the in-memory SQLite ``db`` fixture from
conftest (foreign keys enabled), so the un-cascaded ``Session.lecturer_id``
reference genuinely blocks at the database level.
"""
import itertools
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from models.lecturer import Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.student import Student
from schemas.assignment import AssignmentItem, AssignmentSaveRequest
from schemas.session import SessionCreate
from schemas.unit import UnitCreate
from services.assignment import list_assignments, save_assignments
from models.lecturer import AvailabilityDay, AvailabilitySlot
from services.lecturer import delete_lecturer
from services.room import delete_room
from services.session import create_session, delete_session
from services.session_allocation import allocation_counts
from services.student import delete_student
from services.unit import create_unit, delete_unit


def make_lecturer(db, lecturer_id, last_name="Lovelace") -> Lecturer:
    lec = Lecturer(id=lecturer_id, title=LecturerTitle.DR, first_name="Ada", last_name=last_name)
    db.add(lec)
    db.commit()
    return lec


_student_numbers = itertools.count(20_000_000)


def make_student(db, student_id, year_level=1) -> Student:
    s = Student(
        id=student_id,
        student_number=str(next(_student_numbers)),
        first_name="Stu",
        last_name=student_id,
        year_level=year_level,
    )
    db.add(s)
    db.commit()
    return s


def make_room(db, room_id="room1", capacity=30) -> Room:
    r = Room(id=room_id, name=room_id, capacity=capacity, room_type=RoomType.LECTURE)
    db.add(r)
    db.commit()
    return r


# ---------------------------------------------------------------------------
# Lecturer: genuine blocking reference (Session.lecturer_id has no cascade)
# ---------------------------------------------------------------------------


def test_delete_lecturer_blocked_by_teaching_team_session(db):
    make_lecturer(db, "lec1")
    unit = create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"]))
    create_session(db, unit.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec1"))

    with pytest.raises(AppError) as exc:
        delete_lecturer(db, "lec1")

    assert exc.value.status_code == 409
    assert exc.value.code == "lecturer_delete_blocked"
    assert "HIS101" in exc.value.message


def test_delete_lecturer_blocked_message_lists_multiple_unit_codes(db):
    make_lecturer(db, "lec1")
    unit_a = create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"]))
    unit_b = create_unit(db, UnitCreate(code="PHI201", name="Philosophy", lecturer_ids=["lec1"]))
    create_session(db, unit_a.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec1"))
    create_session(db, unit_b.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec1"))

    with pytest.raises(AppError) as exc:
        delete_lecturer(db, "lec1")

    assert exc.value.code == "lecturer_delete_blocked"
    assert "HIS101" in exc.value.message
    assert "PHI201" in exc.value.message


def test_delete_lecturer_succeeds_when_not_teaching_any_session(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]))
    # lec2 teaches the session; lec1 is only on the team, never assigned.
    create_session(db, unit.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec2"))

    delete_lecturer(db, "lec1")

    from models.lecturer import Lecturer as LecturerModel

    assert db.query(LecturerModel).filter(LecturerModel.id == "lec1").first() is None


# ---------------------------------------------------------------------------
# Room: intended cascade (unschedules assignments, frees block cells/preferences)
# ---------------------------------------------------------------------------


def test_delete_room_cascades_and_unschedules_assignment(db):
    make_lecturer(db, "lec1")
    make_room(db, "room1")
    unit = create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=[]))
    session = create_session(db, unit.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec1"))
    save_assignments(
        db,
        AssignmentSaveRequest(
            assignments=[
                AssignmentItem(
                    session_id=session.id,
                    day=AvailabilityDay.MONDAY,
                    start_slot=AvailabilitySlot.S1,
                    room_id="room1",
                )
            ]
        ),
    )

    delete_room(db, "room1")

    assert list_assignments(db) == []
    assert db.query(Room).filter(Room.id == "room1").first() is None


# ---------------------------------------------------------------------------
# Unit: intended cascade (deletes child sessions)
# ---------------------------------------------------------------------------


def test_delete_unit_cascades_sessions(db):
    make_lecturer(db, "lec1")
    unit = create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=[]))
    create_session(db, unit.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec1"))

    delete_unit(db, unit.id)

    from models.unit import Unit as UnitModel

    assert db.query(UnitModel).filter(UnitModel.id == unit.id).first() is None


# ---------------------------------------------------------------------------
# Student: intended cascade (enrolments + allocations, with rebalance)
# ---------------------------------------------------------------------------


def test_delete_student_cascades_and_rebalances(db):
    make_lecturer(db, "lec1")
    student = make_student(db, "stu1")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=["stu1"]),
    )
    session = create_session(db, unit.id, SessionCreate(session_type="tutorial", duration=1, lecturer_id="lec1"))
    assert allocation_counts(db, [session.id]).get(session.id, 0) == 1

    delete_student(db, "stu1")

    assert db.query(Student).filter(Student.id == "stu1").first() is None
    assert allocation_counts(db, [session.id]).get(session.id, 0) == 0


# ---------------------------------------------------------------------------
# Session: intended cascade (allocations + assignment)
# ---------------------------------------------------------------------------


def test_delete_session_cascades_assignment(db):
    make_lecturer(db, "lec1")
    make_room(db, "room1")
    unit = create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=[]))
    session = create_session(db, unit.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec1"))
    save_assignments(
        db,
        AssignmentSaveRequest(
            assignments=[
                AssignmentItem(
                    session_id=session.id,
                    day=AvailabilityDay.MONDAY,
                    start_slot=AvailabilitySlot.S1,
                    room_id="room1",
                )
            ]
        ),
    )

    delete_session(db, session.id)

    assert list_assignments(db) == []
