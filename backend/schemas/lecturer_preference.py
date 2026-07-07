from datetime import datetime

from pydantic import BaseModel, ConfigDict

from models.lecturer import AvailabilityDay, AvailabilitySlot
from models.lecturer_preference import PreferenceLevel


class LecturerPreferenceUpsert(BaseModel):
    """Upsert a single preference cell (`PUT /lecturer-preferences`).

    ``level`` is accepted as a raw string so an unknown value surfaces as a
    structured error from the service rather than a generic validation error.
    """

    lecturer_id: str
    day: AvailabilityDay
    slot: AvailabilitySlot
    room_id: str
    level: str


class LecturerPreferenceDelete(BaseModel):
    """Delete a single preference cell back to neutral
    (`DELETE /lecturer-preferences`)."""

    lecturer_id: str
    day: AvailabilityDay
    slot: AvailabilitySlot
    room_id: str


class LecturerPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lecturer_id: str
    day: AvailabilityDay
    slot: AvailabilitySlot
    room_id: str
    level: PreferenceLevel
    created_at: datetime
    updated_at: datetime
