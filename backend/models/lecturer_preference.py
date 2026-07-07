import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base
from models.lecturer import AvailabilityDay, AvailabilitySlot


class PreferenceLevel(str, enum.Enum):
    """The two allowed levels for a lecturer preference cell (Unit 98).

    A cell holds exactly one level. No row means neutral (no preference);
    neutral is never stored.
    """

    PREFERRED = "preferred"
    AVOID = "avoid"


class LecturerPreference(Base):
    """A room-specific lecturer scheduling preference cell.

    A preference cell is ``lecturer_id + day + slot + room_id`` with exactly one
    ``level`` (``preferred`` | ``avoid``). Preferences are soft constraints only:
    this unit persists submitted cells as-is and never cross-validates them
    against availability, timetable blocks, or existing sessions. Preferences are
    not sessions and never appear in scheduling models.
    """

    __tablename__ = "lecturer_preferences"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    lecturer_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("lecturers.id", ondelete="CASCADE"),
        nullable=False,
    )
    day: Mapped[AvailabilityDay] = mapped_column(
        Enum(
            AvailabilityDay,
            name="prefday",
            create_type=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    slot: Mapped[AvailabilitySlot] = mapped_column(
        Enum(
            AvailabilitySlot,
            name="prefslot",
            create_type=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    room_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
    )
    level: Mapped[PreferenceLevel] = mapped_column(
        Enum(
            PreferenceLevel,
            name="preferencelevel",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "lecturer_id",
            "day",
            "slot",
            "room_id",
            name="uq_lecturer_preference_cell",
        ),
        Index("ix_lecturer_preferences_lecturer_id", "lecturer_id"),
        Index(
            "ix_lecturer_preferences_day_slot_room", "day", "slot", "room_id"
        ),
    )
