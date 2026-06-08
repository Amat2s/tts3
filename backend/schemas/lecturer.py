from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from models.lecturer import AvailabilityDay, AvailabilitySlot, LecturerTitle


class AvailabilityEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day: AvailabilityDay
    slot: AvailabilitySlot


class LecturerCreate(BaseModel):
    title: LecturerTitle
    first_name: str
    last_name: str

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


class LecturerUpdate(BaseModel):
    title: LecturerTitle | None = None
    first_name: str | None = None
    last_name: str | None = None

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


class LecturerAvailabilitySet(BaseModel):
    unavailable: list[AvailabilityEntry]


class LecturerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: LecturerTitle
    first_name: str
    last_name: str
    unavailable_slots: list[AvailabilityEntry]
    created_at: datetime
    updated_at: datetime
