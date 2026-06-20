"""Tests for Unit 89: backend student number reset and contract.

Covers the new canonical institutional ``student_number`` identifier:

- model/migration contract where practical (required column, unique index,
  ``id`` remains the primary key, DB-level uniqueness, the migration documents
  the deliberate destructive student reset);
- create requires a student number;
- create rejects invalid student numbers (length, letters, punctuation,
  internal spaces, blank), and trims surrounding whitespace;
- create rejects a duplicate student number;
- update can change the student number;
- update rejects a duplicate student number excluding self;
- the response includes ``student_number``;
- student year level stays manually supplied and editable and is never derived
  from the student number.

Uses the in-memory SQLite ``db`` fixture from conftest so fixtures match the
production ORM models exactly.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from api.errors import AppError
from models.student import Student
from schemas.student import StudentCreate, StudentResponse, StudentUpdate
from services.student import create_student, get_student, update_student


MIGRATION_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "alembic",
    "versions",
    "0014_student_number_reset_and_contract.py",
)


# ---------------------------------------------------------------------------
# Model / migration contract
# ---------------------------------------------------------------------------


def test_student_number_is_required_not_null_column():
    column = Student.__table__.c.student_number
    assert column.nullable is False


def test_student_id_remains_the_only_primary_key():
    pk_columns = {col.name for col in Student.__table__.primary_key.columns}
    assert pk_columns == {"id"}
    assert "student_number" not in pk_columns


def test_student_number_has_a_unique_index():
    unique_indexes = [
        ix
        for ix in Student.__table__.indexes
        if ix.unique and {c.name for c in ix.columns} == {"student_number"}
    ]
    assert unique_indexes, "expected a unique index on student_number"


def test_student_number_uniqueness_enforced_at_database_level(db):
    db.add(
        Student(
            id="a",
            student_number="12345678",
            first_name="Ada",
            last_name="Byron",
            year_level=1,
        )
    )
    db.commit()
    db.add(
        Student(
            id="b",
            student_number="12345678",
            first_name="Grace",
            last_name="Hopper",
            year_level=1,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_student_number_not_null_enforced_at_database_level(db):
    db.add(
        Student(id="a", first_name="Ada", last_name="Byron", year_level=1)
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_migration_documents_intentional_destructive_student_reset():
    with open(MIGRATION_PATH, encoding="utf-8") as fh:
        source = fh.read()
    # The reset is deliberate, deletes existing students, and is documented.
    assert "DELETE FROM students" in source
    assert "DESTRUCTIVE RESET" in source
    assert "down_revision" in source and '"0013"' in source
    assert 'revision: str = "0014"' in source


# ---------------------------------------------------------------------------
# Create: required + validation
# ---------------------------------------------------------------------------


def test_create_requires_student_number():
    with pytest.raises(ValidationError):
        StudentCreate(first_name="Ada", last_name="Byron", year_level=1)


@pytest.mark.parametrize(
    "number",
    [
        "",            # blank
        "   ",         # whitespace only
        "1234567",     # 7 digits
        "123456789",   # 9 digits
        "1234567a",    # trailing letter
        "ABCDEFGH",    # letters only
        "1234-567",    # punctuation
        "1234 5678",   # internal space
        "1234.5678",   # internal punctuation
    ],
)
def test_create_rejects_invalid_student_numbers(number):
    with pytest.raises(ValidationError):
        StudentCreate(
            student_number=number, first_name="Ada", last_name="Byron", year_level=1
        )


def test_create_trims_surrounding_whitespace():
    student = StudentCreate(
        student_number="  12345678  ",
        first_name="Ada",
        last_name="Byron",
        year_level=1,
    )
    assert student.student_number == "12345678"


def test_create_persists_student_number(db):
    student = create_student(
        db,
        StudentCreate(
            student_number="12345678",
            first_name="Ada",
            last_name="Byron",
            year_level=1,
        ),
    )
    assert student.student_number == "12345678"
    assert get_student(db, student.id).student_number == "12345678"


def test_create_rejects_duplicate_student_number(db):
    create_student(
        db,
        StudentCreate(
            student_number="12345678",
            first_name="Ada",
            last_name="Byron",
            year_level=1,
        ),
    )
    with pytest.raises(AppError) as exc:
        create_student(
            db,
            StudentCreate(
                student_number="12345678",
                first_name="Grace",
                last_name="Hopper",
                year_level=1,
            ),
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "student_number_conflict"


# ---------------------------------------------------------------------------
# Update: change + duplicate-excluding-self + validation
# ---------------------------------------------------------------------------


def _make(db, *, student_number, first="Stu", last="Dent", year=1) -> Student:
    return create_student(
        db,
        StudentCreate(
            student_number=student_number,
            first_name=first,
            last_name=last,
            year_level=year,
        ),
    )


def test_update_can_change_student_number(db):
    student = _make(db, student_number="11111111")
    updated = update_student(
        db, student.id, StudentUpdate(student_number="22222222")
    )
    assert updated.student_number == "22222222"
    assert get_student(db, student.id).student_number == "22222222"


def test_update_rejects_duplicate_student_number_excluding_self(db):
    a = _make(db, student_number="11111111")
    b = _make(db, student_number="22222222", first="Grace", last="Hopper")

    # Re-submitting a student's own number is not a self-conflict.
    same = update_student(db, a.id, StudentUpdate(student_number="11111111"))
    assert same.student_number == "11111111"

    # Taking another student's number is rejected.
    with pytest.raises(AppError) as exc:
        update_student(db, b.id, StudentUpdate(student_number="11111111"))
    assert exc.value.status_code == 409
    assert exc.value.code == "student_number_conflict"
    # The rejected update left the row unchanged.
    assert get_student(db, b.id).student_number == "22222222"


def test_update_rejects_invalid_student_number():
    with pytest.raises(ValidationError):
        StudentUpdate(student_number="not-digits")


def test_update_without_student_number_leaves_it_unchanged(db):
    student = _make(db, student_number="11111111")
    updated = update_student(db, student.id, StudentUpdate(first_name="Renamed"))
    assert updated.first_name == "Renamed"
    assert updated.student_number == "11111111"


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------


def test_response_includes_student_number(db):
    student = _make(db, student_number="12345678")
    response = StudentResponse.model_validate(student)
    assert response.student_number == "12345678"


# ---------------------------------------------------------------------------
# Year level remains manual and independent of the student number
# ---------------------------------------------------------------------------


def test_year_level_is_manual_and_not_derived_from_student_number(db):
    # A student number whose leading digit is 9 must not push year_level to 9.
    student = _make(db, student_number="91234567", year=2)
    assert student.year_level == 2

    updated = update_student(db, student.id, StudentUpdate(year_level=3))
    assert updated.year_level == 3
    # The student number is untouched by a year-level edit.
    assert updated.student_number == "91234567"
