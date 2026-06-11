from datetime import datetime

from pydantic import BaseModel, ConfigDict

from models.lecturer import AvailabilityDay, AvailabilitySlot
from models.session import SessionType


class AssignmentItem(BaseModel):
    session_id: str
    day: AvailabilityDay
    start_slot: AvailabilitySlot
    room_id: str


class AssignmentSaveRequest(BaseModel):
    assignments: list[AssignmentItem]


class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assignment_id: str
    session_id: str
    unit_id: str
    unit_code: str
    unit_name: str
    session_type: SessionType
    duration: int
    lecturer_display_name: str
    student_count: int
    day: AvailabilityDay
    start_slot: AvailabilitySlot
    room_id: str
    created_at: datetime
    updated_at: datetime
