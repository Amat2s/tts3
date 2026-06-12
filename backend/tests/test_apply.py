"""Tests for the Unit 43 solver result application service.

These use real ORM models persisted to an in-memory SQLite database (the
``db`` fixture from conftest) and real solver output DTOs, so the fixtures
match production formats exactly.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from models.assignment import TimetableAssignment
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.student import Student, StudentTitle
from models.unit import Unit
from solver.apply import (
    ApplicationStatus,
    SolverResultApplicationError,
    apply_solver_result,
)
from solver.types import (
    GeneratedAssignment,
    LockedAssignment,
    SolverRunResult,
    SolverStatus,
)


# ---------------------------------------------------------------------------
# Real-format DB fixture builders
# ---------------------------------------------------------------------------


def make_lecturer(db, lecturer_id="lec1") -> Lecturer:
    lec = Lecturer(
        id=lecturer_id, title=LecturerTitle.DR, first_name="Ada", last_name="Lovelace"
    )
    db.add(lec)
    return lec


def make_student(db, student_id) -> Student:
    s = Student(
        id=student_id,
        title=StudentTitle.MX,
        first_name="Stu",
        last_name=student_id,
        year_level=1,
    )
    db.add(s)
    return s


def make_room(db, room_id, capacity=30, name=None) -> Room:
    r = Room(id=room_id, name=name or room_id, capacity=capacity, room_type=RoomType.LECTURE)
    db.add(r)
    return r


def make_unit(db, unit_id, code, lecturer_id, student_ids=()) -> Unit:
    unit = Unit(id=unit_id, code=code, name=f"Unit {code}", lecturer_id=lecturer_id)
    for sid in student_ids:
        unit.students.append(make_student(db, sid))
    db.add(unit)
    return unit


def make_session(
    db, session_id, unit_id, duration=1, session_type=SessionType.LECTURE
) -> Session:
    sess = Session(
        id=session_id, unit_id=unit_id, session_type=session_type, duration=duration
    )
    db.add(sess)
    return sess


def make_locked_row(db, session_id, day, start_slot, room_id) -> TimetableAssignment:
    a = TimetableAssignment(
        session_id=session_id,
        day=AvailabilityDay(day),
        start_slot=AvailabilitySlot(start_slot),
        room_id=room_id,
    )
    db.add(a)
    return a


def base_world(db, *, with_students=0):
    """A lecturer, one room, one unit, and two schedulable sessions.

    Returns the created room/unit for convenience.
    """
    make_lecturer(db, "lec1")
    make_room(db, "room1", capacity=30)
    student_ids = [f"stu{i}" for i in range(with_students)]
    make_unit(db, "unit1", "HIS101", "lec1", student_ids=student_ids)
    make_session(db, "sessA", "unit1", duration=1)
    make_session(db, "sessB", "unit1", duration=1)
    db.commit()


def run_result(
    *,
    status=SolverStatus.OPTIMAL,
    generated=None,
    locked=None,
    unscheduled=None,
    timed_out=False,
) -> SolverRunResult:
    generated = generated or []
    locked = locked or []
    unscheduled = unscheduled or []
    return SolverRunResult(
        status=status,
        generated_assignments=generated,
        locked_assignments=locked,
        unscheduled_session_ids=unscheduled,
        scheduled_count=len(generated),
        unscheduled_count=len(unscheduled),
        timed_out=timed_out,
        message="fixture",
    )


def gen(session_id, day="Monday", start_slot="s1", room_id="room1", duration=1):
    return GeneratedAssignment(
        session_id=session_id,
        day=day,
        start_slot=start_slot,
        room_id=room_id,
        duration=duration,
    )


def saved_rows(db):
    return {
        (a.session_id, a.day.value, a.start_slot.value, a.room_id)
        for a in db.query(TimetableAssignment).all()
    }


# ---------------------------------------------------------------------------
# Happy path: persistence + metadata
# ---------------------------------------------------------------------------


def test_applies_generated_assignments(db):
    base_world(db)
    result = run_result(
        generated=[gen("sessA", start_slot="s1"), gen("sessB", start_slot="s4")]
    )

    application = apply_solver_result(db, result)

    assert application.status == ApplicationStatus.APPLIED
    assert application.scheduled_count == 2
    assert application.unscheduled_count == 0
    assert application.is_partial is False
    assert application.newly_scheduled_session_ids == ["sessA", "sessB"]
    assert application.preserved_locked_count == 0

    assert saved_rows(db) == {
        ("sessA", "Monday", "s1", "room1"),
        ("sessB", "Monday", "s4", "room1"),
    }


def test_metadata_reports_counts(db):
    base_world(db)
    result = run_result(
        generated=[gen("sessA")], unscheduled=["sessB"]
    )

    application = apply_solver_result(db, result)

    assert application.scheduled_count == 1
    assert application.unscheduled_count == 1
    assert application.newly_scheduled_session_ids == ["sessA"]
    assert application.remaining_unscheduled_session_ids == ["sessB"]
    assert "1 generated" in application.message


# ---------------------------------------------------------------------------
# Locked preservation
# ---------------------------------------------------------------------------


def test_locked_assignments_preserved(db):
    base_world(db)
    # sessA is already saved (locked). sessB is unscheduled and gets placed.
    make_locked_row(db, "sessA", "Tuesday", "s2", "room1")
    db.commit()

    result = run_result(
        generated=[gen("sessB", day="Monday", start_slot="s1")],
        locked=[LockedAssignment("sessA", "Tuesday", "s2", "room1", 1)],
    )

    application = apply_solver_result(db, result)

    assert application.preserved_locked_count == 1
    assert application.scheduled_count == 1
    # Locked row is untouched and the new row is added alongside it.
    assert saved_rows(db) == {
        ("sessA", "Tuesday", "s2", "room1"),
        ("sessB", "Monday", "s1", "room1"),
    }


# ---------------------------------------------------------------------------
# Partial results
# ---------------------------------------------------------------------------


def test_partial_result_marks_partial_and_leaves_unscheduled(db):
    base_world(db)
    result = run_result(
        generated=[gen("sessA")], unscheduled=["sessB"]
    )

    application = apply_solver_result(db, result)

    assert application.status == ApplicationStatus.PARTIAL
    assert application.is_partial is True
    # Only the placed session has a row; the unplaced session stays unscheduled.
    assert saved_rows(db) == {("sessA", "Monday", "s1", "room1")}


# ---------------------------------------------------------------------------
# Failure safety: no mutation, rollback, structured error
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("status", [SolverStatus.INFEASIBLE, SolverStatus.UNKNOWN])
def test_failed_result_does_not_mutate(db, status):
    base_world(db)
    make_locked_row(db, "sessA", "Tuesday", "s2", "room1")
    db.commit()
    before = saved_rows(db)

    result = run_result(status=status, generated=[gen("sessB")], unscheduled=["sessB"])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "solver_failed"
    # Saved timetable is unchanged — the locked row remains, no new row added.
    assert saved_rows(db) == before


def test_invalid_result_object_rejected(db):
    base_world(db)
    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, None)  # type: ignore[arg-type]
    assert exc.value.code == "invalid_result"


# ---------------------------------------------------------------------------
# Defensive validation (runs before commit; nothing persists on failure)
# ---------------------------------------------------------------------------


def test_duplicate_generated_session_rejected(db):
    base_world(db)
    result = run_result(generated=[gen("sessA", start_slot="s1"), gen("sessA", start_slot="s4")])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "duplicate_generated_session"
    assert saved_rows(db) == set()


def test_unknown_session_rejected(db):
    base_world(db)
    result = run_result(generated=[gen("ghost")])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "session_not_found"
    assert saved_rows(db) == set()


def test_unknown_room_rejected(db):
    base_world(db)
    result = run_result(generated=[gen("sessA", room_id="ghost_room")])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "room_not_found"
    assert saved_rows(db) == set()


def test_invalid_slot_rejected(db):
    base_world(db)
    result = run_result(generated=[gen("sessA", start_slot="s9")])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "invalid_slot"
    assert saved_rows(db) == set()


def test_lunch_crossing_rejected(db):
    base_world(db)
    # duration-2 session starting at s3 would span s3 (AM) into s4 (PM).
    make_session(db, "sessLong", "unit1", duration=2)
    db.commit()
    result = run_result(generated=[gen("sessLong", start_slot="s3", duration=2)])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "blocking_integrity_violation"
    assert saved_rows(db) == set()


def test_off_timetable_rejected(db):
    base_world(db)
    make_session(db, "sessLong", "unit1", duration=2)
    db.commit()
    # s7 is the last slot; duration-2 from s7 runs off the timetable.
    result = run_result(generated=[gen("sessLong", start_slot="s7", duration=2)])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "blocking_integrity_violation"
    assert saved_rows(db) == set()


def test_room_capacity_rejected(db):
    make_lecturer(db, "lec1")
    make_room(db, "small", capacity=1)
    make_unit(db, "unit1", "HIS101", "lec1", student_ids=["s1", "s2", "s3"])
    make_session(db, "sessA", "unit1", duration=1)
    db.commit()

    result = run_result(generated=[gen("sessA", room_id="small")])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "blocking_integrity_violation"
    assert saved_rows(db) == set()


def test_generated_overwriting_locked_rejected(db):
    base_world(db)
    make_locked_row(db, "sessA", "Tuesday", "s2", "room1")
    db.commit()
    before = saved_rows(db)

    # Solver tries to re-place the already-locked sessA.
    result = run_result(generated=[gen("sessA", day="Monday", start_slot="s1")])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "would_overwrite_locked"
    assert saved_rows(db) == before


def test_generated_double_book_against_locked_rejected(db):
    base_world(db)
    make_locked_row(db, "sessA", "Monday", "s1", "room1")
    db.commit()
    before = saved_rows(db)

    # sessB placed in the same room/day/slot as locked sessA.
    result = run_result(generated=[gen("sessB", day="Monday", start_slot="s1", room_id="room1")])

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "blocking_integrity_violation"
    assert saved_rows(db) == before


def test_generated_double_book_against_each_other_rejected(db):
    base_world(db)
    result = run_result(
        generated=[
            gen("sessA", day="Monday", start_slot="s1", room_id="room1"),
            gen("sessB", day="Monday", start_slot="s1", room_id="room1"),
        ]
    )

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "blocking_integrity_violation"
    assert saved_rows(db) == set()


# ---------------------------------------------------------------------------
# Transaction rollback: a later defensive failure undoes nothing committed
# ---------------------------------------------------------------------------


def test_rollback_leaves_no_partial_state(db):
    base_world(db)
    # First generated placement is valid, second is invalid (unknown room).
    # The whole apply must fail with nothing persisted.
    result = run_result(
        generated=[
            gen("sessA", day="Monday", start_slot="s1"),
            gen("sessB", room_id="ghost_room"),
        ]
    )

    with pytest.raises(SolverResultApplicationError):
        apply_solver_result(db, result)
    assert saved_rows(db) == set()


# ---------------------------------------------------------------------------
# Empty success
# ---------------------------------------------------------------------------


def test_empty_result_is_applied_noop(db):
    base_world(db)
    result = run_result(generated=[], unscheduled=[])

    application = apply_solver_result(db, result)

    assert application.status == ApplicationStatus.APPLIED
    assert application.scheduled_count == 0
    assert application.is_partial is False
    assert saved_rows(db) == set()
