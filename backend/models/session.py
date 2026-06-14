import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class SessionType(str, enum.Enum):
    # Unit 60: reduced to only lecture and tutorial. Existing lab/workshop rows
    # are migrated to tutorial (see migration 0011).
    LECTURE = "lecture"
    TUTORIAL = "tutorial"


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
    # Unit 59: the actual lecturer teaching this session. Must belong to the
    # parent unit's teaching team (enforced at the service layer). Nullable so a
    # session may exist without an assigned lecturer; such a session is not
    # schedulable until a lecturer is assigned.
    lecturer_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("lecturers.id"), nullable=True
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

    unit: Mapped["Unit"] = relationship("Unit", back_populates="sessions")
    lecturer: Mapped["Lecturer | None"] = relationship("Lecturer", lazy="selectin")
    # Unit 60: hidden system-owned student allocations for this session. Deleting
    # a session cascades to its allocation rows (DB-level cascade + ORM cascade).
    allocations: Mapped[list["SessionStudentAllocation"]] = relationship(
        "SessionStudentAllocation",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
