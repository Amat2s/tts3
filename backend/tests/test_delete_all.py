"""Tests for the bulk delete-all-of-type services (units, lecturers, students).

Mirrors the guarded-delete philosophy of Unit 111: units and students cascade
freely (their delete-all is a simple atomic bulk delete), while lecturers can be
blocked by a still-assigned `Session.lecturer_id` (no cascade) — bulk lecturer
deletion is all-or-nothing so a blocked lecturer never leaves other lecturers
partially deleted.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from models.lecturer import Lecturer, LecturerTitle
from models.student import Student
from models.unit import Unit
from schemas.session import SessionCreate
from schemas.unit import UnitCreate
from services.lecturer import delete_all_lecturers
from services.session import create_session
from services.student import delete_all_students
from services.unit import create_unit, delete_all_units


def make_lecturer(db, lecturer_id, last_name="Lovelace") -> Lecturer:
    lec = Lecturer(id=lecturer_id, title=LecturerTitle.DR, first_name="Ada", last_name=last_name)
    db.add(lec)
    db.commit()
    return lec


def make_student(db, student_id, number) -> Student:
    s = Student(id=student_id, student_number=number, first_name="Stu", last_name=student_id, year_level=1)
    db.add(s)
    db.commit()
    return s


def test_delete_all_units_removes_every_unit(db):
    make_lecturer(db, "lec1")
    create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"], student_ids=[]))
    create_unit(db, UnitCreate(code="PHI201", name="Philosophy", lecturer_ids=["lec1"], student_ids=[]))

    count = delete_all_units(db)

    assert count == 2
    assert db.query(Unit).count() == 0


def test_delete_all_units_on_empty_table_returns_zero(db):
    assert delete_all_units(db) == 0


def test_delete_all_students_removes_every_student(db):
    make_student(db, "s1", "20261111")
    make_student(db, "s2", "20261112")

    count = delete_all_students(db)

    assert count == 2
    assert db.query(Student).count() == 0


def test_delete_all_lecturers_removes_every_lecturer_when_none_assigned(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")

    count = delete_all_lecturers(db)

    assert count == 2
    assert db.query(Lecturer).count() == 0


def test_delete_all_lecturers_blocked_when_any_lecturer_teaches_a_session(db):
    make_lecturer(db, "lec1")
    make_lecturer(db, "lec2", last_name="Turing")
    unit = create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"]))
    create_session(db, unit.id, SessionCreate(session_type="lecture", duration=1, lecturer_id="lec1"))

    with pytest.raises(AppError) as exc:
        delete_all_lecturers(db)

    assert exc.value.status_code == 409
    assert exc.value.code == "lecturer_delete_blocked"
    # Nothing was deleted — the operation is all-or-nothing.
    assert db.query(Lecturer).count() == 2
