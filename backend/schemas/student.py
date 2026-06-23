import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

# Unit 89: the canonical institutional student number. Exactly 8 digits after
# trimming surrounding whitespace. Letters, punctuation, internal spaces, blank
# values, and any length other than 8 digits are rejected.
STUDENT_NUMBER_PATTERN = re.compile(r"^\d{8}$")
STUDENT_NUMBER_ERROR = "Student number must be exactly 8 digits."


def _normalize_student_number(value: str) -> str:
    """Trim and validate a student number, returning the normalized 8-digit value.

    Raises ``ValueError`` (mapped to a 422 by Pydantic) when the value is blank
    or is not exactly 8 digits.
    """
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("Student number must not be blank.")
    if not STUDENT_NUMBER_PATTERN.match(trimmed):
        raise ValueError(STUDENT_NUMBER_ERROR)
    return trimmed


class EnrolledUnitSummary(BaseModel):
    """Lightweight summary of a unit a student is enrolled in."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    year_level: int


class StudentCreate(BaseModel):
    student_number: str
    first_name: str
    last_name: str
    year_level: int

    @field_validator("student_number")
    @classmethod
    def student_number_valid(cls, v: str) -> str:
        return _normalize_student_number(v)

    @field_validator("first_name")
    @classmethod
    def first_name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("First name must not be blank.")
        return v.strip()

    @field_validator("last_name")
    @classmethod
    def last_name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Last name must not be blank.")
        return v.strip()

    @field_validator("year_level")
    @classmethod
    def year_level_valid(cls, v: int) -> int:
        if not (1 <= v <= 3):
            raise ValueError("Year level must be between 1 and 3.")
        return v


class StudentUpdate(BaseModel):
    student_number: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    year_level: int | None = None

    @field_validator("student_number")
    @classmethod
    def student_number_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _normalize_student_number(v)

    @field_validator("first_name")
    @classmethod
    def first_name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("First name must not be blank.")
        return v.strip() if v is not None else v

    @field_validator("last_name")
    @classmethod
    def last_name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Last name must not be blank.")
        return v.strip() if v is not None else v

    @field_validator("year_level")
    @classmethod
    def year_level_valid(cls, v: int | None) -> int | None:
        if v is not None and not (1 <= v <= 3):
            raise ValueError("Year level must be between 1 and 3.")
        return v


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_number: str
    first_name: str
    last_name: str
    year_level: int
    units: list[EnrolledUnitSummary] = []
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def unit_count(self) -> int:
        return len(self.units)


class StudentImportResult(BaseModel):
    """Aggregate outcome of a Unit 90 CSV student import.

    Only counts are returned — never full student lists or raw CSV row contents.
    ``skipped_past_census_rows`` is exposed for internal/testing visibility; the
    frontend should not surface it in the primary success summary.
    """

    created_students: int
    updated_students: int
    added_enrolments: int
    skipped_unknown_unit_rows: int
    skipped_invalid_rows: int
    skipped_past_census_rows: int
    deduped_rows: int
