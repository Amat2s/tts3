from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from models.lecturer import LecturerTitle
from models.student import StudentTitle


class LecturerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: LecturerTitle
    first_name: str
    last_name: str


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: StudentTitle
    first_name: str
    last_name: str
    year_level: int


class UnitCreate(BaseModel):
    code: str
    name: str
    lecturer_id: str
    student_ids: list[str] = []

    @field_validator("code")
    @classmethod
    def code_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Unit code must not be blank.")
        return v.strip()

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Unit name must not be blank.")
        return v.strip()


class UnitUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    lecturer_id: str | None = None
    student_ids: list[str] | None = None

    @field_validator("code")
    @classmethod
    def code_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Unit code must not be blank.")
        return v.strip() if v is not None else v

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Unit name must not be blank.")
        return v.strip() if v is not None else v


class UnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    lecturer_id: str
    lecturer: LecturerSummary
    students: list[StudentSummary]
    created_at: datetime
    updated_at: datetime
