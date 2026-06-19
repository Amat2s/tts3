from datetime import datetime

from pydantic import BaseModel, ConfigDict

from models.lecturer import AvailabilityDay, AvailabilitySlot
from models.timetable_block import BlockColour


class BlockCellInput(BaseModel):
    day: AvailabilityDay
    slot: AvailabilitySlot
    room_id: str


class TimetableBlockCreate(BaseModel):
    name: str | None = None
    colour: BlockColour | None = None
    cells: list[BlockCellInput]


class TimetableBlockUpdate(BaseModel):
    name: str | None = None
    colour: BlockColour | None = None
    cells: list[BlockCellInput]


class BlockCellResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    day: AvailabilityDay
    slot: AvailabilitySlot
    room_id: str


class TimetableBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str | None
    colour: BlockColour | None
    cells: list[BlockCellResponse]
    created_at: datetime
    updated_at: datetime


class TimetableBlockMutationResponse(BaseModel):
    """Create/update result: the persisted block plus any assignments that were
    intentionally unscheduled because the block now reserves their cells."""

    block: TimetableBlockResponse
    unscheduled_session_ids: list[str]
