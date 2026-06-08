from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from models.student import StudentTitle


class StudentCreate(BaseModel):
    title: StudentTitle
    first_name: str
    last_name: str
    year_level: int

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
        if not (1 <= v <= 5):
            raise ValueError("Year level must be between 1 and 5.")
        return v


class StudentUpdate(BaseModel):
    title: StudentTitle | None = None
    first_name: str | None = None
    last_name: str | None = None
    year_level: int | None = None

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
        if v is not None and not (1 <= v <= 5):
            raise ValueError("Year level must be between 1 and 5.")
        return v


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: StudentTitle
    first_name: str
    last_name: str
    year_level: int
    created_at: datetime
    updated_at: datetime
