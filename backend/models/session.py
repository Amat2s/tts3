import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class SessionType(str, enum.Enum):
    LECTURE = "lecture"
    TUTORIAL = "tutorial"
    LAB = "lab"
    WORKSHOP = "workshop"


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    unit_id: Mapped[str] = mapped_column(
        String, ForeignKey("units.id", ondelete="CASCADE"), nullable=False
    )
    session_type: Mapped[SessionType] = mapped_column(
        Enum(
            SessionType,
            name="sessiontype",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    unit: Mapped["Unit"] = relationship("Unit", back_populates="sessions")
    assignment: Mapped["TimetableAssignment"] = relationship(
        "TimetableAssignment",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
        passive_deletes=True,
        uselist=False,
    )
