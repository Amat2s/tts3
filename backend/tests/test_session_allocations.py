"""Tests for Unit 60: session types and hidden session-student allocations.

Covers lecture allocation (every enrolled student), tutorial balancing (even
groups, exactly-one membership), stability across edits (minimal movement),
trigger points (unit/student/session mutations), the schedulable + assignment
DTO student counts deriving from allocation rows, and capacity defensive checks
using allocated counts. Uses the in-memory SQLite ``db`` fixture from conftest.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.session_allocation import SessionStudentAllocation
from models.student import Student, StudentTitle
from schemas.assignment import AssignmentItem, AssignmentSaveRequest
from schemas.session import SessionCreate, SessionUpdate
from schemas.student import StudentCreate
from schemas.unit import UnitCreate, UnitUpdate
from services.assignment import save_assignments
from services.session import (
    create_session,
    delete_session,
    list_schedulable_sessions,
    update_session,
)
from services.session_allocation import rebalance_unit_session_allocations
from services.student import create_student, delete_student
from services.unit import create_unit, update_unit


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def make_lecturer(db, lecturer_id="lec1") -> Lecturer:
    lec = Lecturer(
        id=lecturer_id, title=LecturerTitle.DR, first_name="Ada", last_name="Lovelace"
    )
    db.add(lec)
    db.commit()
    return lec


def make_students(db, count, year_level=1, prefix="s") -> list[str]:
    ids = []
    for i in range(count):
        sid = f"{prefix}{i:02d}"
        db.add(
            Student(
                id=sid,
                title=StudentTitle.MX,
                first_name="Stu",
                last_name=sid,
                year_level=year_level,
            )
        )
        ids.append(sid)
    db.commit()
    return ids


def make_room(db, room_id="room1", capacity=100) -> Room:
    r = Room(id=room_id, name=room_id, capacity=capacity, room_type=RoomType.LECTURE)
    db.add(r)
    db.commit()
    return r


def tutorial_map(db, unit_id) -> dict[str, str]:
    """Return student_id -> tutorial session_id for the unit's tutorials."""
    tut_ids = {
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit_id,
            Session.session_type == SessionType.TUTORIAL,
        )
    }
    mapping: dict[str, str] = {}
    for row in db.query(SessionStudentAllocation).filter(
        SessionStudentAllocation.session_id.in_(tut_ids or {"__none__"})
    ):
        mapping[row.student_id] = row.session_id
    return mapping


def alloc_ids(db, session_id) -> set[str]:
    return {
        r.student_id
        for r in db.query(SessionStudentAllocation).filter(
            SessionStudentAllocation.session_id == session_id
        )
    }


# ---------------------------------------------------------------------------
# Session type enum is reduced
# ---------------------------------------------------------------------------


def test_session_type_only_lecture_and_tutorial():
    assert {t.value for t in SessionType} == {"lecture", "tutorial"}


# ---------------------------------------------------------------------------
# Lecture allocation
# ---------------------------------------------------------------------------


def test_lecture_allocates_every_enrolled_student(db):
    make_lecturer(db)
    students = make_students(db, 5)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=students),
    )
    lecture = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
    )
    assert alloc_ids(db, lecture.id) == set(students)


def test_lecture_with_no_students_has_zero_allocations(db):
    make_lecturer(db)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=[]),
    )
    lecture = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
    )
    assert alloc_ids(db, lecture.id) == set()


# ---------------------------------------------------------------------------
# Tutorial allocation: exactly-one membership + even balance
# ---------------------------------------------------------------------------


def _make_unit_with_tutorials(db, n_students, n_tutorials):
    make_lecturer(db)
    students = make_students(db, n_students)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=students),
    )
    for _ in range(n_tutorials):
        create_session(
            db, unit.id, SessionCreate(session_type=SessionType.TUTORIAL, duration=1)
        )
    return unit, students


def test_tutorial_each_student_allocated_exactly_once(db):
    unit, students = _make_unit_with_tutorials(db, 10, 3)
    mapping = tutorial_map(db, unit.id)
    assert set(mapping.keys()) == set(students)  # every student exactly once


def test_tutorial_groups_are_even(db):
    unit, students = _make_unit_with_tutorials(db, 10, 3)
    tut_ids = [
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit.id,
            Session.session_type == SessionType.TUTORIAL,
        )
    ]
    sizes = sorted(len(alloc_ids(db, sid)) for sid in tut_ids)
    assert sizes == [3, 3, 4]  # 10 over 3 -> as even as possible


def test_no_tutorial_sessions_means_no_tutorial_allocations(db):
    make_lecturer(db)
    students = make_students(db, 4)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=students),
    )
    # Only a lecture exists; no tutorial rows anywhere.
    create_session(db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1))
    assert tutorial_map(db, unit.id) == {}


# ---------------------------------------------------------------------------
# Stability and minimal movement
# ---------------------------------------------------------------------------


def test_rebalance_is_idempotent(db):
    unit, _ = _make_unit_with_tutorials(db, 10, 3)
    before = tutorial_map(db, unit.id)
    rebalance_unit_session_allocations(db, unit.id)
    db.commit()
    assert tutorial_map(db, unit.id) == before


def test_adding_student_does_not_move_existing(db):
    unit, students = _make_unit_with_tutorials(db, 9, 3)  # 3/3/3 even
    before = tutorial_map(db, unit.id)
    new_id = make_students(db, 1, prefix="new")[0]
    update_unit(db, unit.id, UnitUpdate(student_ids=students + [new_id]))
    after = tutorial_map(db, unit.id)
    # No existing student moved; the new student is placed exactly once.
    for sid in students:
        assert after[sid] == before[sid]
    assert new_id in after


def test_removing_tutorial_reassigns_its_students(db):
    unit, students = _make_unit_with_tutorials(db, 8, 2)  # 4/4
    tut_ids = [
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit.id,
            Session.session_type == SessionType.TUTORIAL,
        )
    ]
    delete_session(db, tut_ids[0])
    mapping = tutorial_map(db, unit.id)
    # Every student is now in the single remaining tutorial, exactly once.
    assert set(mapping.keys()) == set(students)
    assert set(mapping.values()) == {tut_ids[1]}


def test_adding_tutorial_rebalances_with_minimal_movement(db):
    unit, students = _make_unit_with_tutorials(db, 8, 1)  # all 8 in one tutorial
    first_tut = next(
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit.id,
            Session.session_type == SessionType.TUTORIAL,
        )
    )
    before_members = alloc_ids(db, first_tut)
    create_session(
        db, unit.id, SessionCreate(session_type=SessionType.TUTORIAL, duration=1)
    )
    sizes = sorted(
        len(alloc_ids(db, s.id))
        for s in db.query(Session).filter(
            Session.unit_id == unit.id,
            Session.session_type == SessionType.TUTORIAL,
        )
    )
    assert sizes == [4, 4]  # evenly split
    # The original tutorial kept a subset of its members (minimal movement).
    assert alloc_ids(db, first_tut) <= before_members


# ---------------------------------------------------------------------------
# Trigger points: student create/delete
# ---------------------------------------------------------------------------


def test_create_student_joins_lectures_and_one_tutorial(db):
    make_lecturer(db)
    existing = make_students(db, 6)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=existing),
    )
    lecture = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
    )
    create_session(db, unit.id, SessionCreate(session_type=SessionType.TUTORIAL, duration=1))
    create_session(db, unit.id, SessionCreate(session_type=SessionType.TUTORIAL, duration=1))

    # A new year-1 student auto-enrols into the matching-year unit.
    new = create_student(
        db, StudentCreate(title=StudentTitle.MX, first_name="New", last_name="Comer", year_level=1)
    )
    assert new.id in alloc_ids(db, lecture.id)  # in the lecture
    tut = tutorial_map(db, unit.id)
    assert tut.get(new.id) is not None  # in exactly one tutorial


def test_delete_student_removes_allocations_and_rebalances(db):
    unit, students = _make_unit_with_tutorials(db, 6, 2)  # 3/3
    lecture = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
    )
    victim = students[0]
    delete_student(db, victim)
    # Gone from the lecture and from all tutorials.
    assert victim not in alloc_ids(db, lecture.id)
    assert victim not in tutorial_map(db, unit.id)
    # Remaining 5 students each in exactly one tutorial; groups stay even (3/2).
    mapping = tutorial_map(db, unit.id)
    assert set(mapping.keys()) == set(students) - {victim}
    sizes = sorted(
        len(alloc_ids(db, s.id))
        for s in db.query(Session).filter(
            Session.unit_id == unit.id,
            Session.session_type == SessionType.TUTORIAL,
        )
    )
    assert sizes == [2, 3]


# ---------------------------------------------------------------------------
# Trigger point: session_type change
# ---------------------------------------------------------------------------


def test_changing_lecture_to_tutorial_rebalances(db):
    make_lecturer(db)
    students = make_students(db, 4)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=students),
    )
    # Two lectures: both currently hold all 4 students.
    a = create_session(db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1))
    b = create_session(db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1))
    assert alloc_ids(db, a.id) == set(students)
    assert alloc_ids(db, b.id) == set(students)
    # Flip one lecture to a tutorial -> it becomes the sole tutorial holding all 4.
    update_session(db, b.id, SessionUpdate(session_type=SessionType.TUTORIAL))
    assert alloc_ids(db, a.id) == set(students)  # lecture unchanged
    assert alloc_ids(db, b.id) == set(students)  # one tutorial -> all students


# ---------------------------------------------------------------------------
# Response DTO counts derive from allocations
# ---------------------------------------------------------------------------


def test_schedulable_student_count_uses_allocations(db):
    unit, students = _make_unit_with_tutorials(db, 10, 2)  # 5/5 tutorials
    create_session(db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1))
    schedulable = list_schedulable_sessions(db)
    by_id = {s.session_id: s for s in schedulable}
    for s in schedulable:
        if s.session_type == SessionType.LECTURE:
            assert s.student_count == 10
            assert sorted(s.allocated_student_ids) == sorted(students)
        else:
            assert s.student_count == 5


def test_zero_student_tutorial_is_schedulable(db):
    make_lecturer(db)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=[]),
    )
    tut = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.TUTORIAL, duration=1)
    )
    schedulable = list_schedulable_sessions(db)
    by_id = {s.session_id: s for s in schedulable}
    assert tut.id in by_id  # has a lecturer + duration -> schedulable
    assert by_id[tut.id].student_count == 0


# ---------------------------------------------------------------------------
# Capacity defensive check uses allocated group size
# ---------------------------------------------------------------------------


def test_capacity_check_uses_tutorial_group_not_unit_total(db):
    unit, _ = _make_unit_with_tutorials(db, 10, 2)  # tutorials of 5
    make_room(db, "small", capacity=5)
    tut = next(
        s
        for s in db.query(Session).filter(
            Session.unit_id == unit.id,
            Session.session_type == SessionType.TUTORIAL,
        )
    )
    # Group size is 5; a capacity-5 room must be accepted even though the unit
    # has 10 enrolled students total.
    saved = save_assignments(
        db,
        AssignmentSaveRequest(
            assignments=[
                AssignmentItem(
                    session_id=tut.id,
                    day=AvailabilityDay.MONDAY,
                    start_slot=AvailabilitySlot.S1,
                    room_id="small",
                )
            ]
        ),
    )
    assert saved[0].student_count == 5


def test_capacity_check_rejects_lecture_over_capacity(db):
    make_lecturer(db)
    students = make_students(db, 6)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=students),
    )
    lecture = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
    )
    make_room(db, "tiny", capacity=5)
    with pytest.raises(AppError) as exc:
        save_assignments(
            db,
            AssignmentSaveRequest(
                assignments=[
                    AssignmentItem(
                        session_id=lecture.id,
                        day=AvailabilityDay.MONDAY,
                        start_slot=AvailabilitySlot.S1,
                        room_id="tiny",
                    )
                ]
            ),
        )
    assert exc.value.code == "room_capacity_too_small"
