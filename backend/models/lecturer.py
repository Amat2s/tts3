import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class LecturerTitle(str, enum.Enum):
    MR = "Mr"
    MS = "Ms"
    MRS = "Mrs"
    DR = "Dr"
    FR = "Fr"
    REV_DR = "Rev. Dr"
    ASSOC_PROF = "A/Prof."
    PROF = "Prof."


class AvailabilityDay(str, enum.Enum):
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"


class AvailabilitySlot(str, enum.Enum):
    S1 = "s1"
    S2 = "s2"
    S3 = "s3"
    S4 = "s4"
    S5 = "s5"
    S6 = "s6"
    S7 = "s7"


class Lecturer(Base):
    __tablename__ = "lecturers"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[LecturerTitle] = mapped_column(
        Enum(
            LecturerTitle,
            name="lecturertitle",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    unavailable_slots: Mapped[list["LecturerAvailability"]] = relationship(
        "LecturerAvailability",
        back_populates="lecturer",
        cascade="all, delete-orphan",
    )


class LecturerAvailability(Base):
    __tablename__ = "lecturer_availability"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    lecturer_id: Mapped[str] = mapped_column(
        String, ForeignKey("lecturers.id", ondelete="CASCADE"), nullable=False
    )
    day: Mapped[AvailabilityDay] = mapped_column(
        Enum(
            AvailabilityDay,
            name="availabilityday",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    slot: Mapped[AvailabilitySlot] = mapped_column(
        Enum(
            AvailabilitySlot,
            name="availabilityslot",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    lecturer: Mapped["Lecturer"] = relationship(
        "Lecturer", back_populates="unavailable_slots"
    )

    __table_args__ = (
        UniqueConstraint("lecturer_id", "day", "slot", name="uq_lecturer_availability"),
    )
