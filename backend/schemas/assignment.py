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
    lecturer_id: str | None
    lecturer_display_name: str
    # Unit 60: derived from the hidden session-student allocation rows.
    student_count: int
    # Internal validation payload only; the UI must not display tutorial
    # allocation membership.
    allocated_student_ids: list[str] = []
    day: AvailabilityDay
    start_slot: AvailabilitySlot
    room_id: str
    created_at: datetime
    updated_at: datetime
