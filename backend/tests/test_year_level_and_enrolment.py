"""Tests for Unit 58: derived unit year levels and enrolment sync.

Covers the year-level parser (success/failure), unit-create year derivation and
default enrolment, explicit student-list handling, student-create auto-enrolment,
update preservation, schema/database year-level constraints, and the enriched
student response shape. Uses the in-memory SQLite ``db`` fixture from conftest so
fixtures match production ORM models exactly.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from models.lecturer import Lecturer, LecturerTitle
from models.student import Student, StudentTitle
from models.unit import Unit
from schemas.student import StudentCreate, StudentResponse, StudentUpdate
from schemas.unit import UnitCreate, UnitResponse, UnitUpdate
from services.student import create_student
from services.unit import create_unit, update_unit
from services.year_level import InvalidUnitCodeError, parse_unit_year_level


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


def make_student(db, student_id, year_level) -> Student:
    s = Student(
        id=student_id,
        title=StudentTitle.MX,
        first_name="Stu",
        last_name=student_id,
        year_level=year_level,
    )
    db.add(s)
    db.commit()
    return s


# ---------------------------------------------------------------------------
# Parser: success
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "code,expected",
    [
        ("HIS101", 1),
        ("THE203", 2),
        ("PHI3A", 3),
        ("  HIS101  ", 1),  # surrounding whitespace stripped
        ("2ABC9", 2),  # first digit wins over later digits
    ],
)
def test_parse_unit_year_level_success(code, expected):
    assert parse_unit_year_level(code) == expected


# ---------------------------------------------------------------------------
# Parser: failure
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("code", ["ABC", "HISTORY", "   "])
def test_parse_unit_year_level_no_digit_rejected(code):
    with pytest.raises(InvalidUnitCodeError):
        parse_unit_year_level(code)


@pytest.mark.parametrize("code", ["PHY401", "BIO5", "X0Y"])
def test_parse_unit_year_level_out_of_range_first_digit_rejected(code):
    with pytest.raises(InvalidUnitCodeError):
        parse_unit_year_level(code)


# ---------------------------------------------------------------------------
# Schema: unit code validation
# ---------------------------------------------------------------------------


def test_unit_create_rejects_code_without_valid_first_digit():
    with pytest.raises(ValidationError):
        UnitCreate(code="ABC", name="No Digit", lecturer_ids=["lec1"])


def test_unit_create_rejects_code_with_first_digit_four():
    with pytest.raises(ValidationError):
        UnitCreate(code="PHY401", name="Too High", lecturer_ids=["lec1"])


def test_unit_update_rejects_invalid_code():
    with pytest.raises(ValidationError):
        UnitUpdate(code="ZZZ")


def test_unit_create_does_not_accept_year_level_from_client():
    # year_level is not a field on UnitCreate; pydantic ignores unknown by
    # default, so the supplied value never reaches the model.
    data = UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    assert not hasattr(data, "year_level")


# ---------------------------------------------------------------------------
# Unit service: year derivation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "code,expected",
    [("HIS101", 1), ("THE203", 2), ("PHI3A", 3)],
)
def test_create_unit_stores_derived_year_level(db, code, expected):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code=code, name=f"Unit {code}", lecturer_ids=["lec1"])
    )
    assert unit.year_level == expected


# ---------------------------------------------------------------------------
# Unit service: default enrolment by derived year
# ---------------------------------------------------------------------------


def test_create_unit_without_student_ids_enrols_matching_year(db):
    make_lecturer(db)
    make_student(db, "y1a", 1)
    make_student(db, "y2a", 2)
    make_student(db, "y2b", 2)
    make_student(db, "y3a", 3)

    unit = create_unit(db, UnitCreate(code="THE203", name="Theology", lecturer_ids=["lec1"]))

    enrolled = {s.id for s in unit.students}
    assert enrolled == {"y2a", "y2b"}


def test_create_unit_with_explicit_student_ids_respects_list(db):
    make_lecturer(db)
    make_student(db, "y2a", 2)
    make_student(db, "y2b", 2)

    unit = create_unit(
        db,
        UnitCreate(
            code="THE203", name="Theology", lecturer_ids=["lec1"], student_ids=["y2a"]
        ),
    )

    assert {s.id for s in unit.students} == {"y2a"}


def test_create_unit_with_explicit_empty_list_enrols_nobody(db):
    make_lecturer(db)
    make_student(db, "y2a", 2)

    unit = create_unit(
        db,
        UnitCreate(
            code="THE203", name="Theology", lecturer_ids=["lec1"], student_ids=[]
        ),
    )

    assert unit.students == []


# ---------------------------------------------------------------------------
# Student service: auto-enrolment sync
# ---------------------------------------------------------------------------


def test_create_student_auto_enrols_in_matching_year_units(db):
    make_lecturer(db)
    y2_unit = create_unit(
        db, UnitCreate(code="THE203", name="Theology", lecturer_ids=["lec1"])
    )
    y1_unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )

    student = create_student(
        db,
        StudentCreate(title=StudentTitle.MX, first_name="New", last_name="Stu", year_level=2),
    )

    enrolled_unit_ids = {u.id for u in student.units}
    assert y2_unit.id in enrolled_unit_ids
    assert y1_unit.id not in enrolled_unit_ids


# ---------------------------------------------------------------------------
# Unit update: code change recomputes year but preserves students
# ---------------------------------------------------------------------------


def test_update_unit_code_recomputes_year_without_replacing_students(db):
    make_lecturer(db)
    make_student(db, "y2a", 2)
    unit = create_unit(
        db,
        UnitCreate(
            code="THE203", name="Theology", lecturer_ids=["lec1"], student_ids=["y2a"]
        ),
    )
    assert unit.year_level == 2

    updated = update_unit(db, unit.id, UnitUpdate(code="HIS101"))

    assert updated.year_level == 1
    # The previously selected (year-2) student is preserved, not replaced.
    assert {s.id for s in updated.students} == {"y2a"}


# ---------------------------------------------------------------------------
# Shared enrolment relationship
# ---------------------------------------------------------------------------


def test_unit_enrolment_edit_updates_student_side_of_same_relationship(db):
    make_lecturer(db)
    student = make_student(db, "stu1", 1)
    unit = create_unit(
        db,
        UnitCreate(
            code="HIS101",
            name="History",
            lecturer_ids=["lec1"],
            student_ids=[],
        ),
    )

    updated = update_unit(db, unit.id, UnitUpdate(student_ids=[student.id]))
    db.refresh(student, attribute_names=["units"])

    assert {s.id for s in updated.students} == {"stu1"}
    assert {u.id for u in student.units} == {unit.id}
    assert StudentResponse.model_validate(student).unit_count == 1


# ---------------------------------------------------------------------------
# Year-level constraints: schema + database
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("year", [4, 5, 0])
def test_student_create_schema_rejects_out_of_range_year(year):
    with pytest.raises(ValidationError):
        StudentCreate(
            title=StudentTitle.MX, first_name="A", last_name="B", year_level=year
        )


@pytest.mark.parametrize("year", [4, 5, 0])
def test_student_update_schema_rejects_out_of_range_year(year):
    with pytest.raises(ValidationError):
        StudentUpdate(year_level=year)


def test_student_year_level_database_constraint(db):
    db.add(
        Student(
            id="bad",
            title=StudentTitle.MX,
            first_name="A",
            last_name="B",
            year_level=4,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_unit_year_level_database_constraint(db):
    make_lecturer(db)
    db.add(
        Unit(id="bad", code="X1", name="Bad", year_level=4)
    )
    with pytest.raises(IntegrityError):
        db.commit()


# ---------------------------------------------------------------------------
# Response shapes
# ---------------------------------------------------------------------------


def test_student_response_includes_units_and_unit_count(db):
    make_lecturer(db)
    create_unit(db, UnitCreate(code="THE203", name="Theology", lecturer_ids=["lec1"]))
    student = create_student(
        db,
        StudentCreate(title=StudentTitle.MX, first_name="New", last_name="Stu", year_level=2),
    )

    response = StudentResponse.model_validate(student)
    assert response.unit_count == 1
    assert response.units[0].code == "THE203"
    assert response.units[0].year_level == 2


def test_unit_response_includes_year_level(db):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code="PHI3A", name="Philosophy", lecturer_ids=["lec1"])
    )
    response = UnitResponse.model_validate(unit)
    assert response.year_level == 3
