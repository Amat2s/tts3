import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from models.lecturer import LecturerTitle
from services.year_level import parse_unit_year_level

# Defensive structural validation of unit codes: exactly six characters, three
# letters followed by three numbers (e.g. HIS101). The richer subject/year
# parser (subject prefixes, colours, labels) stays frontend-only; the backend
# only guarantees the structural contract and the derived year level.
UNIT_CODE_PATTERN = re.compile(r"^[A-Z]{3}\d{3}$")
UNIT_CODE_ERROR = (
    "Unit code must be three letters followed by three numbers, e.g. HIS101."
)


def _normalize_unit_code(value: str) -> str:
    """Trim, uppercase, and structurally validate a unit code.

    Returns the normalized (uppercase) code. Raises ``ValueError`` (mapped to a
    422 by Pydantic) when the code is blank or does not match ``AAA999``.
    """
    if not value.strip():
        raise ValueError("Unit code must not be blank.")
    normalized = value.strip().upper()
    if not UNIT_CODE_PATTERN.match(normalized):
        raise ValueError(UNIT_CODE_ERROR)
    # Confirm the year level is derivable (first digit 1/2/3); raises a
    # 422-mapped ValueError otherwise.
    parse_unit_year_level(normalized)
    return normalized


class LecturerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: LecturerTitle
    first_name: str
    last_name: str


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: str
    last_name: str
    year_level: int


class UnitCreate(BaseModel):
    code: str
    name: str
    # Unit 59: the teaching team. At least one lecturer is required.
    lecturer_ids: list[str]
    # `None` means "no explicit list supplied" -> default to all students in the
    # derived year. An explicit list (including []) is respected verbatim.
    # `year_level` is never accepted from the client; it is derived from `code`.
    student_ids: list[str] | None = None

    @field_validator("code")
    @classmethod
    def code_valid(cls, v: str) -> str:
        return _normalize_unit_code(v)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Unit name must not be blank.")
        return v.strip()

    @field_validator("lecturer_ids")
    @classmethod
    def at_least_one_lecturer(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("A unit must have at least one teaching lecturer.")
        return v


class UnitUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    # Replacing the team is allowed; if supplied it must keep at least one
    # lecturer. `None` means "leave the team unchanged".
    lecturer_ids: list[str] | None = None
    student_ids: list[str] | None = None

    @field_validator("code")
    @classmethod
    def code_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _normalize_unit_code(v)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Unit name must not be blank.")
        return v.strip() if v is not None else v

    @field_validator("lecturer_ids")
    @classmethod
    def at_least_one_lecturer(cls, v: list[str] | None) -> list[str] | None:
        if v is not None and not v:
            raise ValueError("A unit must have at least one teaching lecturer.")
        return v


class UnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    year_level: int
    lecturers: list[LecturerSummary]
    students: list[StudentSummary]
    created_at: datetime
    updated_at: datetime
