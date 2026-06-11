from datetime import datetime

from pydantic import BaseModel

from models.assignment import AssignmentDay, AssignmentSlot
from models.session import SessionType


class AssignmentCreate(BaseModel):
    session_id: str
    room_id: str
    day: AssignmentDay
    start_slot: AssignmentSlot


class AssignmentMove(BaseModel):
    room_id: str
    day: AssignmentDay
    start_slot: AssignmentSlot


class AssignmentSessionSummary(BaseModel):
    id: str
    unit_id: str
    session_type: SessionType
    duration: int
    lecturer_id: str
    lecturer_display_name: str
    student_count: int


class AssignmentUnitSummary(BaseModel):
    id: str
    code: str
    name: str


class AssignmentRoomSummary(BaseModel):
    id: str
    name: str


class AssignmentResponse(BaseModel):
    id: str
    session_id: str
    room_id: str
    day: AssignmentDay
    start_slot: AssignmentSlot
    created_at: datetime
    updated_at: datetime
    session: AssignmentSessionSummary
    unit: AssignmentUnitSummary
    room: AssignmentRoomSummary
