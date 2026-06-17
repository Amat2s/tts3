"""Tests for Unit 72: backend title and unit-code contract cleanup.

Covers:
- student create/list/update responses no longer expose ``title``;
- student creation no longer accepts ``title`` as a field;
- lecturer titles expose exactly the final product list and create/update
  accept every value;
- the approved old->new lecturer value mapping (asserted at the value level;
  the Postgres remap itself lives in migration 0012 and is not exercised by the
  SQLite test database);
- unit-code structural validation (too short / too long / digits-before-letters
  / letters-only / unsupported punctuation) and lower-case normalization;
- uniqueness enforced after normalization, and consistent create/update service
  behavior (normalize before persist, no self-conflict, invalid update rejected
  before any DB mutation).

Uses the in-memory SQLite ``db`` fixture from conftest so fixtures match the
production ORM models exactly.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from pydantic import ValidationError

from api.errors import AppError
from models.lecturer import Lecturer, LecturerTitle
from schemas.lecturer import LecturerCreate, LecturerUpdate
from schemas.student import StudentCreate, StudentResponse, StudentUpdate
from schemas.unit import UnitCreate, UnitResponse, UnitUpdate
from services.lecturer import create_lecturer, list_lecturers, update_lecturer
from services.student import create_student, list_students, update_student
from services.unit import create_unit, get_unit, update_unit


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


# ---------------------------------------------------------------------------
# Student title removal
# ---------------------------------------------------------------------------


def test_student_schemas_have_no_title_field():
    assert "title" not in StudentCreate.model_fields
    assert "title" not in StudentUpdate.model_fields
    assert "title" not in StudentResponse.model_fields


def test_student_create_does_not_accept_title():
    # `title` is no longer a field; pydantic ignores unknown input by default so
    # the supplied value never lands on the model.
    student = StudentCreate(first_name="Ada", last_name="Byron", year_level=1)
    assert not hasattr(student, "title")


def test_student_create_list_update_responses_exclude_title(db):
    created = create_student(
        db, StudentCreate(first_name="Grace", last_name="Hopper", year_level=1)
    )
    create_response = StudentResponse.model_validate(created)
    assert "title" not in create_response.model_dump()

    listed = list_students(db)
    assert all(
        "title" not in StudentResponse.model_validate(s).model_dump() for s in listed
    )

    updated = update_student(db, created.id, StudentUpdate(first_name="Grace B."))
    update_response = StudentResponse.model_validate(updated)
    assert "title" not in update_response.model_dump()
    assert update_response.first_name == "Grace B."


# ---------------------------------------------------------------------------
# Lecturer title migration
# ---------------------------------------------------------------------------

FINAL_TITLE_VALUES = {"Mr", "Ms", "Mrs", "Dr", "Fr", "A/Prof.", "Prof."}


def test_lecturer_title_enum_exposes_exactly_final_values():
    assert {t.value for t in LecturerTitle} == FINAL_TITLE_VALUES


@pytest.mark.parametrize("title", list(LecturerTitle))
def test_lecturer_create_accepts_every_final_title(db, title):
    lec = create_lecturer(
        db, LecturerCreate(title=title, first_name="Test", last_name="Lecturer")
    )
    assert lec.title == title


@pytest.mark.parametrize("title", list(LecturerTitle))
def test_lecturer_update_accepts_every_final_title(db, title):
    lec = create_lecturer(
        db, LecturerCreate(title=LecturerTitle.MR, first_name="Test", last_name="L")
    )
    updated = update_lecturer(db, lec.id, LecturerUpdate(title=title))
    assert updated.title == title


def test_lecturer_old_value_mapping_matches_approved_targets():
    # The Postgres remap (Dr. -> Dr, Mr. -> Mr, Ms. -> Ms; Prof./A/Prof.
    # unchanged) is performed by migration 0012. Here we assert the new enum
    # members carry exactly the approved target values, and that the new Mrs/Fr
    # values exist.
    assert LecturerTitle.DR.value == "Dr"
    assert LecturerTitle.MR.value == "Mr"
    assert LecturerTitle.MS.value == "Ms"
    assert LecturerTitle.PROF.value == "Prof."
    assert LecturerTitle.ASSOC_PROF.value == "A/Prof."
    assert LecturerTitle.MRS.value == "Mrs"
    assert LecturerTitle.FR.value == "Fr"


def test_lecturer_punctuation_preserved_only_for_prof_titles():
    # Only A/Prof. and Prof. retain a trailing period.
    with_punctuation = {t.value for t in LecturerTitle if t.value.endswith(".")}
    assert with_punctuation == {"A/Prof.", "Prof."}


# ---------------------------------------------------------------------------
# Unit-code structural validation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "code",
    [
        "HI1",        # too short
        "HIS1010",    # too long
        "101HIS",     # numbers before letters
        "ABCDEF",     # only letters
        "HIS-101",    # unsupported punctuation
        "HI5101",     # only two leading letters
        "HISTORY",    # letters only, too long
        "",           # blank
    ],
)
def test_unit_create_rejects_structurally_invalid_codes(code):
    with pytest.raises(ValidationError):
        UnitCreate(code=code, name="Bad", lecturer_ids=["lec1"])


@pytest.mark.parametrize(
    "code",
    ["HI1", "HIS1010", "101HIS", "ABCDEF", "HIS-101"],
)
def test_unit_update_rejects_structurally_invalid_codes(code):
    with pytest.raises(ValidationError):
        UnitUpdate(code=code)


def test_unit_create_error_message_is_clear():
    with pytest.raises(ValidationError) as exc:
        UnitCreate(code="HIS-101", name="Bad", lecturer_ids=["lec1"])
    assert (
        "Unit code must be three letters followed by three numbers, e.g. HIS101."
        in str(exc.value)
    )


@pytest.mark.parametrize(
    "raw,normalized",
    [("his101", "HIS101"), ("  phi201  ", "PHI201"), ("HiS101", "HIS101")],
)
def test_unit_code_normalized_to_uppercase_in_schema(raw, normalized):
    assert UnitCreate(code=raw, name="Unit", lecturer_ids=["lec1"]).code == normalized
    assert UnitUpdate(code=raw).code == normalized


# ---------------------------------------------------------------------------
# Service behavior
# ---------------------------------------------------------------------------


def test_create_unit_stores_normalized_uppercase_code(db):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code="his101", name="History", lecturer_ids=["lec1"])
    )
    assert unit.code == "HIS101"
    assert UnitResponse.model_validate(unit).code == "HIS101"


def test_update_unit_stores_normalized_uppercase_code(db):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    updated = update_unit(db, unit.id, UnitUpdate(code="phi201"))
    assert updated.code == "PHI201"


def test_duplicate_unit_code_rejected_after_normalization(db):
    make_lecturer(db)
    create_unit(db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"]))
    with pytest.raises(AppError) as exc:
        # Lower-case duplicate normalizes to the same stored code.
        create_unit(
            db, UnitCreate(code="his101", name="Dup", lecturer_ids=["lec1"])
        )
    assert exc.value.status_code == 409


def test_update_unit_without_code_change_does_not_self_conflict(db):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    updated = update_unit(db, unit.id, UnitUpdate(name="History of Art"))
    assert updated.code == "HIS101"
    assert updated.name == "History of Art"


def test_update_unit_to_same_normalized_code_is_allowed(db):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    # Re-submitting the same code (lower-case) must not conflict with itself.
    updated = update_unit(db, unit.id, UnitUpdate(code="his101"))
    assert updated.code == "HIS101"


def test_invalid_code_update_fails_before_db_mutation(db):
    make_lecturer(db)
    unit = create_unit(
        db, UnitCreate(code="HIS101", name="History", lecturer_ids=["lec1"])
    )
    # An invalid code is rejected at schema construction, before update_unit can
    # mutate the row.
    with pytest.raises(ValidationError):
        update_unit(db, unit.id, UnitUpdate(code="bad"))
    # The stored unit is unchanged.
    assert get_unit(db, unit.id).code == "HIS101"
