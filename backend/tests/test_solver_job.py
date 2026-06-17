"""Tests for the Unit 45 async solver job runner.

These exercise :func:`run_solver_job` end-to-end through the real backend
pipeline (snapshot builder -> CP-SAT solver -> result application service)
against an in-memory SQLite database (the ``db`` fixture from conftest), so
the runner is verified with production formats. Failure paths are exercised by
monkeypatching the solver step so we can assert saved state is preserved.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from models.assignment import TimetableAssignment
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.student import Student
from models.unit import Unit
from solver import job as job_module
from solver.job import (
    SolverJobPayload,
    SolverJobResult,
    SolverJobStatus,
    run_solver_job,
)
from solver.types import SolverRunResult, SolverStatus


# ---------------------------------------------------------------------------
# Real-format DB fixture builders (mirror test_apply.py)
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
    unit = Unit(id=unit_id, code=code, name=f"Unit {code}", year_level=1)
    db.add(unit)
    db.flush()
    lecturer = db.get(Lecturer, lecturer_id)
    if lecturer is not None:
        unit.lecturers.append(lecturer)
    for sid in student_ids:
        unit.students.append(make_student(db, sid))
    return unit


def make_session(db, session_id, unit_id, duration=1, session_type=SessionType.LECTURE, lecturer_id="lec1") -> Session:
    sess = Session(
        id=session_id,
        unit_id=unit_id,
        session_type=session_type,
        duration=duration,
        lecturer_id=lecturer_id,
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


def saved_rows(db):
    return {
        (a.session_id, a.day.value, a.start_slot.value, a.room_id)
        for a in db.query(TimetableAssignment).all()
    }


def payload(**overrides) -> SolverJobPayload:
    base = dict(solver_run_id="run-1", correlation_id="corr-1")
    base.update(overrides)
    return SolverJobPayload(**base)


# ---------------------------------------------------------------------------
# Payload type
# ---------------------------------------------------------------------------


def test_payload_from_dict_minimal():
    p = SolverJobPayload.from_dict({"solver_run_id": "r1", "correlation_id": "c1"})
    assert p.solver_run_id == "r1"
    assert p.correlation_id == "c1"
    assert p.admin_workspace_id is None
    assert p.snapshot_id is None


def test_payload_from_dict_full():
    p = SolverJobPayload.from_dict(
        {
            "solver_run_id": "r1",
            "correlation_id": "c1",
            "admin_workspace_id": "admin-7",
            "snapshot_id": "snap-3",
        }
    )
    assert p.admin_workspace_id == "admin-7"
    assert p.snapshot_id == "snap-3"


def test_payload_from_dict_missing_field_raises():
    with pytest.raises(ValueError):
        SolverJobPayload.from_dict({"solver_run_id": "r1"})


# ---------------------------------------------------------------------------
# Happy path / end-to-end
# ---------------------------------------------------------------------------


def test_empty_database_completes_with_no_work(db):
    result = run_solver_job(db, payload())

    assert result.status == SolverJobStatus.COMPLETED
    assert result.sessions_attempted == 0
    assert result.sessions_scheduled == 0
    assert result.sessions_unscheduled == 0
    assert result.is_partial is False
    assert result.failure_code is None
    assert result.solver_status in {"optimal", "feasible"}


def test_schedules_unscheduled_session_end_to_end(db):
    make_lecturer(db, "lec1")
    make_room(db, "room1", capacity=30)
    make_unit(db, "unit1", "HIS101", "lec1")
    make_session(db, "sessA", "unit1", duration=1)
    db.commit()

    result = run_solver_job(db, payload())

    assert result.status == SolverJobStatus.COMPLETED
    assert result.sessions_attempted == 1
    assert result.sessions_scheduled == 1
    assert result.sessions_unscheduled == 0
    assert result.newly_scheduled_session_ids == ["sessA"]
    # The generated placement was persisted.
    assert len(saved_rows(db)) == 1


def test_preserves_locked_assignment_and_adds_new(db):
    make_lecturer(db, "lec1")
    make_room(db, "room1", capacity=30)
    make_unit(db, "unit1", "HIS101", "lec1")
    make_session(db, "sessLocked", "unit1", duration=1)
    make_session(db, "sessNew", "unit1", duration=1)
    make_locked_row(db, "sessLocked", "Monday", "s1", "room1")
    db.commit()

    result = run_solver_job(db, payload())

    assert result.status == SolverJobStatus.COMPLETED
    assert result.sessions_attempted == 1  # only sessNew is unscheduled
    assert result.sessions_scheduled == 1
    assert result.newly_scheduled_session_ids == ["sessNew"]
    rows = saved_rows(db)
    # Locked row preserved unchanged plus the new placement.
    assert ("sessLocked", "Monday", "s1", "room1") in rows
    assert len(rows) == 2


def test_partial_when_session_cannot_be_placed(db):
    # Room too small for the allocation-derived student count -> no feasible
    # candidate -> the session stays unscheduled -> partial application.
    from services.session_allocation import rebalance_unit_session_allocations

    make_lecturer(db, "lec1")
    make_room(db, "tiny", capacity=1)
    make_unit(db, "unit1", "BIG101", "lec1", student_ids=["s1", "s2", "s3"])
    make_session(db, "sessBig", "unit1", duration=1)
    db.flush()
    rebalance_unit_session_allocations(db, "unit1")
    db.commit()

    result = run_solver_job(db, payload())

    assert result.status == SolverJobStatus.PARTIAL
    assert result.is_partial is True
    assert result.sessions_attempted == 1
    assert result.sessions_scheduled == 0
    assert result.sessions_unscheduled == 1
    assert result.remaining_unscheduled_session_ids == ["sessBig"]
    assert saved_rows(db) == set()


def test_result_echoes_payload_references(db):
    result = run_solver_job(db, payload(solver_run_id="run-XYZ", correlation_id="corr-XYZ"))
    assert result.solver_run_id == "run-XYZ"
    assert result.correlation_id == "corr-XYZ"


def test_result_carries_timing_metadata(db):
    result = run_solver_job(db, payload())
    assert result.duration_seconds >= 0
    assert result.started_at
    assert result.completed_at


def test_result_is_json_serializable(db):
    result = run_solver_job(db, payload())
    encoded = json.dumps(result.to_dict())
    decoded = json.loads(encoded)
    assert decoded["status"] == "completed"
    assert decoded["solver_run_id"] == "run-1"


# ---------------------------------------------------------------------------
# Failure handling — saved state must be preserved
# ---------------------------------------------------------------------------


def test_solver_exception_fails_without_corrupting_saved_state(db, monkeypatch):
    make_lecturer(db, "lec1")
    make_room(db, "room1", capacity=30)
    make_unit(db, "unit1", "HIS101", "lec1")
    make_session(db, "sessLocked", "unit1", duration=1)
    make_session(db, "sessNew", "unit1", duration=1)
    make_locked_row(db, "sessLocked", "Monday", "s1", "room1")
    db.commit()

    def boom(*_args, **_kwargs):
        raise RuntimeError("solver blew up")

    monkeypatch.setattr(job_module, "solve_timetable", boom)

    result = run_solver_job(db, payload())

    assert result.status == SolverJobStatus.FAILED
    assert result.failure_code == "solver_error"
    assert result.sessions_scheduled == 0
    # Saved (locked) assignment is untouched; no new rows were written.
    assert saved_rows(db) == {("sessLocked", "Monday", "s1", "room1")}


def test_unapplicable_solver_status_fails_and_preserves_state(db, monkeypatch):
    make_lecturer(db, "lec1")
    make_room(db, "room1", capacity=30)
    make_unit(db, "unit1", "HIS101", "lec1")
    make_session(db, "sessLocked", "unit1", duration=1)
    make_session(db, "sessNew", "unit1", duration=1)
    make_locked_row(db, "sessLocked", "Monday", "s1", "room1")
    db.commit()

    def unknown(*_args, **_kwargs):
        return SolverRunResult(
            status=SolverStatus.UNKNOWN,
            generated_assignments=[],
            locked_assignments=[],
            unscheduled_session_ids=["sessNew"],
            scheduled_count=0,
            unscheduled_count=1,
            timed_out=True,
            message="no solution",
        )

    monkeypatch.setattr(job_module, "solve_timetable", unknown)

    result = run_solver_job(db, payload())

    assert result.status == SolverJobStatus.FAILED
    # apply_solver_result rejects a non-OPTIMAL/FEASIBLE result as solver_failed.
    assert result.failure_code == "solver_failed"
    assert result.solver_status == "unknown"
    assert result.timed_out is True
    assert saved_rows(db) == {("sessLocked", "Monday", "s1", "room1")}


def test_snapshot_exception_fails_without_corrupting_saved_state(db, monkeypatch):
    make_lecturer(db, "lec1")
    make_room(db, "room1", capacity=30)
    make_unit(db, "unit1", "HIS101", "lec1")
    make_session(db, "sessLocked", "unit1", duration=1)
    make_locked_row(db, "sessLocked", "Monday", "s1", "room1")
    db.commit()

    def boom(*_args, **_kwargs):
        raise RuntimeError("snapshot blew up")

    monkeypatch.setattr(job_module, "build_solver_input_snapshot", boom)

    result = run_solver_job(db, payload())

    assert result.status == SolverJobStatus.FAILED
    assert result.failure_code == "snapshot_error"
    assert result.solver_status is None
    assert saved_rows(db) == {("sessLocked", "Monday", "s1", "room1")}
