import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base

unit_students = Table(
    "unit_students",
    Base.metadata,
    Column("unit_id", String, ForeignKey("units.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", String, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
)

# Unit 59: a unit's teaching team. Replaces the single Unit.lecturer_id as the
# source of who may teach a unit. The actual lecturer of a given session is held
# on Session.lecturer_id and must belong to this team.
unit_lecturers = Table(
    "unit_lecturers",
    Base.metadata,
    Column("unit_id", String, ForeignKey("units.id", ondelete="CASCADE"), primary_key=True),
    Column("lecturer_id", String, ForeignKey("lecturers.id", ondelete="CASCADE"), primary_key=True),
)


class Unit(Base):
    __tablename__ = "units"
    __table_args__ = (
        CheckConstraint("year_level IN (1, 2, 3)", name="ck_unit_year_level"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    code: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Stored derived value; parsed from `code` (first digit, must be 1/2/3).
    # The client never sends this directly. See services/year_level.py.
    year_level: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    # Teaching team (Unit 59). At least one lecturer is required at the service
    # layer for unit create; a session's lecturer must come from this team.
    lecturers: Mapped[list["Lecturer"]] = relationship(
        "Lecturer", secondary=unit_lecturers, lazy="selectin"
    )
    students: Mapped[list["Student"]] = relationship(
        "Student", secondary=unit_students, lazy="selectin", back_populates="units"
    )
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="unit", cascade="all, delete-orphan", lazy="selectin"
    )
