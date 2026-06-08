from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from models.room import RoomType


class RoomCreate(BaseModel):
    name: str
    capacity: int
    room_type: RoomType

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name must not be blank.")
        return v.strip()

    @field_validator("capacity")
    @classmethod
    def capacity_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Capacity must be a positive integer.")
        return v


class RoomUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = None
    room_type: RoomType | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Name must not be blank.")
        return v.strip() if v is not None else v

    @field_validator("capacity")
    @classmethod
    def capacity_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("Capacity must be a positive integer.")
        return v


class RoomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    capacity: int
    room_type: RoomType
    created_at: datetime
    updated_at: datetime
