import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base
from models.lecturer import AvailabilityDay, AvailabilitySlot


class TimetableAssignment(Base):
    __tablename__ = "timetable_assignments"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    day: Mapped[AvailabilityDay] = mapped_column(
        Enum(AvailabilityDay, name="assignmentday", create_type=False,
             values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    start_slot: Mapped[AvailabilitySlot] = mapped_column(
        Enum(AvailabilitySlot, name="assignmentslot", create_type=False,
             values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    room_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("rooms.id", ondelete="CASCADE"),
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

    session: Mapped["Session"] = relationship("Session", lazy="selectin")
    room: Mapped["Room"] = relationship("Room", lazy="selectin")

    __table_args__ = (
        UniqueConstraint(
            "day", "start_slot", "room_id", name="uq_assignment_room_slot"
        ),
    )
