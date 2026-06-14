import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class SessionStudentAllocation(Base):
    """Hidden, system-owned allocation of a student to a session (Unit 60).

    These rows are never user-editable and have no API route. They record which
    students attend which session so that:
      - lecture sessions include every student enrolled in the parent unit;
      - tutorial sessions evenly divide the enrolled students.

    Room capacity, student-conflict detection, frontend validation data, and the
    solver input derive their per-session student membership from these rows
    (rather than assuming every unit student attends every session). The service
    in ``services/session_allocation.py`` is the sole writer.
    """

    __tablename__ = "session_student_allocations"
    __table_args__ = (
        UniqueConstraint(
            "session_id", "student_id", name="uq_session_student_allocation"
        ),
        Index("ix_session_student_allocations_session_id", "session_id"),
        Index("ix_session_student_allocations_student_id", "student_id"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped["Session"] = relationship(
        "Session", back_populates="allocations"
    )
