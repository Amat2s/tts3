from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from models.session import SessionType
from schemas.unit import LecturerSummary


class SessionCreate(BaseModel):
    session_type: SessionType
    duration: int
    # Unit 59: optional session lecturer. When omitted and the unit has exactly
    # one teaching lecturer, the service assigns that lecturer automatically.
    lecturer_id: str | None = None

    @field_validator("duration")
    @classmethod
    def duration_in_range(cls, v: int) -> int:
        if v < 1 or v > 4:
            raise ValueError("Duration must be between 1 and 4 slots.")
        return v


class SessionUpdate(BaseModel):
    session_type: SessionType | None = None
    duration: int | None = None
    # Unit 59: when supplied, the new lecturer must belong to the parent unit's
    # teaching team. `None` means "leave the lecturer unchanged".
    lecturer_id: str | None = None

    @field_validator("duration")
    @classmethod
    def duration_in_range(cls, v: int | None) -> int | None:
        if v is not None and (v < 1 or v > 4):
            raise ValueError("Duration must be between 1 and 4 slots.")
        return v


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    unit_id: str
    session_type: SessionType
    duration: int
    lecturer_id: str | None
    lecturer: LecturerSummary | None
    created_at: datetime
    updated_at: datetime


class SchedulableSessionResponse(BaseModel):
    session_id: str
    unit_id: str
    unit_code: str
    unit_name: str
    session_type: SessionType
    duration: int
    lecturer_id: str
    lecturer_display_name: str
    student_count: int
