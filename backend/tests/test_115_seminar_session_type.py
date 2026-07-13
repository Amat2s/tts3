"""Tests for Unit 115: seminar session type and independent allocations.

Seminars behave exactly like tutorials for hidden allocation purposes, except
the seminar partition is a second, wholly independent partition of the same
enrolled set — computed with no reference to the tutorial partition and never
cross-mutating tutorial rows (or vice versa). Uses the in-memory SQLite ``db``
fixture from conftest.
"""
import itertools
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.session_allocation import SessionStudentAllocation
from models.student import Student
from schemas.assignment import AssignmentItem, AssignmentSaveRequest
from schemas.session import SessionCreate, SessionUpdate
from schemas.unit import UnitCreate
from services.assignment import save_assignments
from services.session import create_session, delete_session, list_schedulable_sessions, update_session
from services.unit import create_unit
from solver.snapshot import build_snapshot_from_data
from solver.types import (
    LockedAssignment,
    RoomSnapshot,
    SESSION_TYPE_ORDER,
    SessionSnapshot,
)


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


_student_numbers = itertools.count(20_000_000)


def make_students(db, count, year_level=1, prefix="s") -> list[str]:
    ids = []
    for i in range(count):
        sid = f"{prefix}{i:02d}"
        db.add(
            Student(
                id=sid,
                student_number=str(next(_student_numbers)),
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


def alloc_ids(db, session_id) -> set[str]:
    return {
        r.student_id
        for r in db.query(SessionStudentAllocation).filter(
            SessionStudentAllocation.session_id == session_id
        )
    }


def group_map(db, unit_id, session_type) -> dict[str, str]:
    """Return student_id -> session_id for the unit's sessions of a given type."""
    ids = {
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit_id, Session.session_type == session_type
        )
    }
    mapping: dict[str, str] = {}
    for row in db.query(SessionStudentAllocation).filter(
        SessionStudentAllocation.session_id.in_(ids or {"__none__"})
    ):
        mapping[row.student_id] = row.session_id
    return mapping


def _make_unit_with(db, n_students, n_tutorials=0, n_seminars=0):
    make_lecturer(db)
    students = make_students(db, n_students)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=students),
    )
    for _ in range(n_tutorials):
        create_session(db, unit.id, SessionCreate(session_type=SessionType.TUTORIAL, duration=1))
    for _ in range(n_seminars):
        create_session(db, unit.id, SessionCreate(session_type=SessionType.SEMINAR, duration=1))
    return unit, students


# ---------------------------------------------------------------------------
# Create/update/round-trip
# ---------------------------------------------------------------------------


def test_seminar_accepted_by_create_and_round_trips_schedulable(db):
    unit, students = _make_unit_with(db, 4, n_seminars=1)
    seminar = next(
        s for s in db.query(Session).filter(Session.unit_id == unit.id)
    )
    assert seminar.session_type == SessionType.SEMINAR

    schedulable = list_schedulable_sessions(db)
    by_id = {s.session_id: s for s in schedulable}
    assert by_id[seminar.id].session_type == SessionType.SEMINAR
    assert by_id[seminar.id].student_count == 4
    assert sorted(by_id[seminar.id].allocated_student_ids) == sorted(students)


def test_seminar_accepted_by_update(db):
    make_lecturer(db)
    students = make_students(db, 3)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=students),
    )
    session = create_session(db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1))
    updated = update_session(db, session.id, SessionUpdate(session_type=SessionType.SEMINAR))
    assert updated.session_type == SessionType.SEMINAR


# ---------------------------------------------------------------------------
# Seminar allocation: balanced, exactly-one membership
# ---------------------------------------------------------------------------


def test_seminar_each_student_allocated_exactly_once(db):
    unit, students = _make_unit_with(db, 10, n_seminars=3)
    mapping = group_map(db, unit.id, SessionType.SEMINAR)
    assert set(mapping.keys()) == set(students)


def test_seminar_groups_are_even(db):
    unit, _ = _make_unit_with(db, 10, n_seminars=3)
    sem_ids = [
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit.id, Session.session_type == SessionType.SEMINAR
        )
    ]
    sizes = sorted(len(alloc_ids(db, sid)) for sid in sem_ids)
    assert sizes == [3, 3, 4]


def test_no_seminar_sessions_means_zero_seminar_allocation_rows(db):
    unit, students = _make_unit_with(db, 4, n_tutorials=1)
    assert group_map(db, unit.id, SessionType.SEMINAR) == {}


def test_zero_enrolment_seminar_is_schedulable_with_zero_students(db):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=[])
    )
    seminar = create_session(db, unit.id, SessionCreate(session_type=SessionType.SEMINAR, duration=1))
    schedulable = list_schedulable_sessions(db)
    by_id = {s.session_id: s for s in schedulable}
    assert seminar.id in by_id
    assert by_id[seminar.id].student_count == 0


# ---------------------------------------------------------------------------
# Independence from the tutorial partition
# ---------------------------------------------------------------------------


def test_tutorial_and_seminar_partitions_are_independent(db):
    unit, students = _make_unit_with(db, 9, n_tutorials=3, n_seminars=3)
    tut_map = group_map(db, unit.id, SessionType.TUTORIAL)
    sem_map = group_map(db, unit.id, SessionType.SEMINAR)
    # Every student has exactly one tutorial and exactly one seminar row.
    assert set(tut_map.keys()) == set(students)
    assert set(sem_map.keys()) == set(students)


def test_changing_seminars_never_perturbs_tutorials(db):
    unit, students = _make_unit_with(db, 8, n_tutorials=2, n_seminars=2)
    tut_before = group_map(db, unit.id, SessionType.TUTORIAL)

    # Add another seminar (rebalances seminars only).
    create_session(db, unit.id, SessionCreate(session_type=SessionType.SEMINAR, duration=1))
    assert group_map(db, unit.id, SessionType.TUTORIAL) == tut_before

    # Remove a seminar (rebalances seminars only).
    sem_ids = [
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit.id, Session.session_type == SessionType.SEMINAR
        )
    ]
    delete_session(db, sem_ids[0])
    assert group_map(db, unit.id, SessionType.TUTORIAL) == tut_before


def test_changing_tutorials_never_perturbs_seminars(db):
    unit, students = _make_unit_with(db, 8, n_tutorials=2, n_seminars=2)
    sem_before = group_map(db, unit.id, SessionType.SEMINAR)

    create_session(db, unit.id, SessionCreate(session_type=SessionType.TUTORIAL, duration=1))
    assert group_map(db, unit.id, SessionType.SEMINAR) == sem_before

    tut_ids = [
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit.id, Session.session_type == SessionType.TUTORIAL
        )
    ]
    delete_session(db, tut_ids[0])
    assert group_map(db, unit.id, SessionType.SEMINAR) == sem_before


def test_adding_seminar_rebalances_with_minimal_movement(db):
    unit, students = _make_unit_with(db, 8, n_seminars=1)  # all 8 in one seminar
    first_sem = next(
        s.id
        for s in db.query(Session).filter(
            Session.unit_id == unit.id, Session.session_type == SessionType.SEMINAR
        )
    )
    before_members = alloc_ids(db, first_sem)
    create_session(db, unit.id, SessionCreate(session_type=SessionType.SEMINAR, duration=1))
    sizes = sorted(
        len(alloc_ids(db, s.id))
        for s in db.query(Session).filter(
            Session.unit_id == unit.id, Session.session_type == SessionType.SEMINAR
        )
    )
    assert sizes == [4, 4]
    assert alloc_ids(db, first_sem) <= before_members


# ---------------------------------------------------------------------------
# Capacity defensive check
# ---------------------------------------------------------------------------


def test_capacity_check_uses_seminar_group_not_unit_total(db):
    unit, _ = _make_unit_with(db, 10, n_seminars=2)  # seminars of 5
    make_room(db, "small", capacity=5)
    sem = next(
        s
        for s in db.query(Session).filter(
            Session.unit_id == unit.id, Session.session_type == SessionType.SEMINAR
        )
    )
    saved = save_assignments(
        db,
        AssignmentSaveRequest(
            assignments=[
                AssignmentItem(
                    session_id=sem.id,
                    day=AvailabilityDay.MONDAY,
                    start_slot=AvailabilitySlot.S1,
                    room_id="small",
                )
            ]
        ),
    )
    assert saved[0].student_count == 5


# ---------------------------------------------------------------------------
# Solver ordering and snapshot integration
# ---------------------------------------------------------------------------


def test_session_type_order_places_seminar_after_tutorial():
    assert SESSION_TYPE_ORDER["lecture"] < SESSION_TYPE_ORDER["tutorial"]
    assert SESSION_TYPE_ORDER["tutorial"] < SESSION_TYPE_ORDER["seminar"]


def test_snapshot_builds_seminar_candidates_deterministically():
    room = RoomSnapshot(room_id="room-1", name="Room A", capacity=50, room_type="lecture")
    lecture = SessionSnapshot(
        session_id="sess-lecture",
        unit_id="unit-1",
        unit_code="HIS101",
        unit_name="History",
        session_type="lecture",
        duration=1,
        lecturer_id="lec-1",
        student_ids=frozenset({"stu-1", "stu-2"}),
        student_count=2,
    )
    tutorial = SessionSnapshot(
        session_id="sess-tutorial",
        unit_id="unit-1",
        unit_code="HIS101",
        unit_name="History",
        session_type="tutorial",
        duration=1,
        lecturer_id="lec-1",
        student_ids=frozenset({"stu-1"}),
        student_count=1,
    )
    seminar = SessionSnapshot(
        session_id="sess-seminar",
        unit_id="unit-1",
        unit_code="HIS101",
        unit_name="History",
        session_type="seminar",
        duration=1,
        lecturer_id="lec-1",
        student_ids=frozenset({"stu-2"}),
        student_count=1,
    )

    # Passed out of order to prove the builder sorts deterministically.
    snapshot = build_snapshot_from_data(
        rooms=[room],
        sessions=[seminar, lecture, tutorial],
        availability=[],
        saved_assignments=[],
    )

    assert [s.session_id for s in snapshot.sessions] == [
        "sess-lecture",
        "sess-tutorial",
        "sess-seminar",
    ]
    assert set(snapshot.unscheduled_session_ids) == {
        "sess-lecture",
        "sess-tutorial",
        "sess-seminar",
    }
