"""Tests for Unit 59: unit teaching team and session-level lecturer.

Covers unit-team create/update validation, the unit-update guard against
removing a lecturer who still teaches a session, session-lecturer defaulting
and team-membership validation, schedulable-session exclusion of sessions
without a lecturer, and assignment responses sourcing display data from the
session lecturer. Uses the in-memory SQLite ``db`` fixture from conftest.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from pydantic import ValidationError

from api.errors import AppError
from models.assignment import TimetableAssignment
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.student import Student
from schemas.assignment import AssignmentItem, AssignmentSaveRequest
from schemas.session import SessionCreate, SessionResponse, SessionUpdate
from schemas.unit import UnitCreate, UnitResponse, UnitUpdate
from services.assignment import list_assignments, save_assignments
from services.session import (
    create_session,
    list_schedulable_sessions,
    update_session,
)
from services.unit import create_unit, update_unit


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def make_lecturer(db, lecturer_id, last_name="Lovelace") -> Lecturer:
    lec = Lecturer(
        id=lecturer_id,
        title=LecturerTitle.DR,
        first_name="Ada",
        last_name=last_name,
    )
    db.add(lec)
    db.commit()
    return lec


def make_student(db, student_id, year_level=1) -> Student:
    s = Student(
        id=student_id,
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
# Unit create: teaching team
# ---------------------------------------------------------------------------


def test_unit_create_requires_at_least_one_lecturer_schema():
    with pytest.raises(ValidationError):
        UnitCreate(code="HIS101", name="History", lecturer_ids=[])


def test_unit_create_persists_full_team(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    assert {lec.id for lec in unit.lecturers} == {"lec1", "lec2"}


def test_unit_create_rejects_unknown_lecturer(db):
    make_lecturer(db, "lec1")
    with pytest.raises(AppError) as exc:
        create_unit(
            db, UnitCreate(code="HIS101", name="History", lecturer_ids=["ghost"])
        )
    assert exc.value.status_code == 422


def test_unit_response_includes_lecturers(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    response = UnitResponse.model_validate(unit)
    assert {lec.id for lec in response.lecturers} == {"lec1", "lec2"}


# ---------------------------------------------------------------------------
# Unit update: replace team
# ---------------------------------------------------------------------------


def test_unit_update_replaces_team(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    updated = update_unit(db, unit.id, UnitUpdate(lecturer_ids=["lec2"]))
    assert {lec.id for lec in updated.lecturers} == {"lec2"}


def test_unit_update_rejects_empty_team_schema():
    with pytest.raises(ValidationError):
        UnitUpdate(lecturer_ids=[])


def test_unit_update_rejects_removing_lecturer_with_assigned_session(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    # A session is taught by lec1.
    create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="lec1")
    )
    # Removing lec1 (still assigned) is rejected with a structured 422.
    with pytest.raises(AppError) as exc:
        update_unit(db, unit.id, UnitUpdate(lecturer_ids=["lec2"]))
    assert exc.value.status_code == 422
    assert exc.value.code == "lecturer_still_assigned"


def test_unit_update_allows_removing_unassigned_lecturer(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    # Session taught by lec1; removing lec2 (not assigned) is fine.
    create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="lec1")
    )
    updated = update_unit(db, unit.id, UnitUpdate(lecturer_ids=["lec1"]))
    assert {lec.id for lec in updated.lecturers} == {"lec1"}


# ---------------------------------------------------------------------------
# Session create: defaulting and team validation
# ---------------------------------------------------------------------------


def test_session_create_defaults_to_sole_lecturer(db):
    make_lecturer(db, "lec1")
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    session = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
    )
    assert session.lecturer_id == "lec1"


def test_session_create_requires_lecturer_when_multiple(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    with pytest.raises(AppError) as exc:
        create_session(
            db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
        )
    assert exc.value.status_code == 422
    assert exc.value.code == "lecturer_required"


def test_session_create_rejects_lecturer_outside_team(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "outsider", last_name="Outside")
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    with pytest.raises(AppError) as exc:
        create_session(
            db,
            unit.id,
            SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="outsider"),
        )
    assert exc.value.status_code == 422
    assert exc.value.code == "lecturer_not_in_team"


def test_session_create_accepts_explicit_team_lecturer(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    session = create_session(
        db,
        unit.id,
        SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="lec2"),
    )
    assert session.lecturer_id == "lec2"


# ---------------------------------------------------------------------------
# Session update: team validation
# ---------------------------------------------------------------------------


def test_session_update_changes_lecturer_to_team_member(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    session = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="lec1")
    )
    updated = update_session(db, session.id, SessionUpdate(lecturer_id="lec2"))
    assert updated.lecturer_id == "lec2"


def test_session_update_rejects_lecturer_outside_team(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "outsider", last_name="Outside")
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    session = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="lec1")
    )
    with pytest.raises(AppError) as exc:
        update_session(db, session.id, SessionUpdate(lecturer_id="outsider"))
    assert exc.value.status_code == 422
    assert exc.value.code == "lecturer_not_in_team"


def test_session_response_includes_lecturer_summary(db):
    make_lecturer(db, "lec1")
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    session = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1)
    )
    response = SessionResponse.model_validate(session)
    assert response.lecturer_id == "lec1"
    assert response.lecturer is not None
    assert response.lecturer.id == "lec1"


# ---------------------------------------------------------------------------
# Schedulable sessions: session lecturer + exclusion of unassigned
# ---------------------------------------------------------------------------


def test_schedulable_uses_session_lecturer_and_excludes_unassigned(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"]),
    )
    assigned = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="lec2")
    )
    # A session without a lecturer (direct ORM insert) must be excluded.
    unassigned = Session(
        id="no-lec",
        unit_id=unit.id,
        session_type=SessionType.TUTORIAL,
        duration=1,
        lecturer_id=None,
    )
    db.add(unassigned)
    db.commit()

    schedulable = list_schedulable_sessions(db)
    by_id = {s.session_id: s for s in schedulable}

    assert "no-lec" not in by_id
    assert assigned.id in by_id
    # Display data comes from the session-level lecturer (lec2), not lec1.
    assert by_id[assigned.id].lecturer_id == "lec2"
    assert "Turing" in by_id[assigned.id].lecturer_display_name


# ---------------------------------------------------------------------------
# Assignment responses use session-level lecturer display data
# ---------------------------------------------------------------------------


def test_assignment_response_uses_session_lecturer(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    make_room(db, "room1", capacity=30)
    unit = create_unit(
        db,
        UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1", "lec2"], student_ids=[]),
    )
    session = create_session(
        db, unit.id, SessionCreate(session_type=SessionType.LECTURE, duration=1, lecturer_id="lec2")
    )

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

    responses = list_assignments(db)
    assert len(responses) == 1
    assert responses[0].lecturer_id == "lec2"
    assert "Turing" in responses[0].lecturer_display_name
