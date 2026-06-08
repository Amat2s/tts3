import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class AssignmentDay(str, enum.Enum):
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"


class AssignmentSlot(str, enum.Enum):
    S1 = "s1"
    S2 = "s2"
    S3 = "s3"
    S4 = "s4"
    S5 = "s5"
    S6 = "s6"
    S7 = "s7"


class TimetableAssignment(Base):
    __tablename__ = "timetable_assignments"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    room_id: Mapped[str] = mapped_column(
        String, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    day: Mapped[AssignmentDay] = mapped_column(
        Enum(
            AssignmentDay,
            name="assignmentday",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    start_slot: Mapped[AssignmentSlot] = mapped_column(
        Enum(
            AssignmentSlot,
            name="assignmentslot",
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

    session: Mapped["Session"] = relationship(
        "Session", back_populates="assignment", lazy="selectin"
    )
    room: Mapped["Room"] = relationship(
        "Room", back_populates="assignments", lazy="selectin"
    )

    __table_args__ = (
        UniqueConstraint("session_id", name="uq_timetable_assignments_session_id"),
    )
