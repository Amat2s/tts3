import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base

unit_students = Table(
    "unit_students",
    Base.metadata,
    Column("unit_id", String, ForeignKey("units.id", ondelete="CASCADE"), primary_key=True),
    Column("student_id", String, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
)


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    code: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    lecturer_id: Mapped[str] = mapped_column(
        String, ForeignKey("lecturers.id"), nullable=False
    )
    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    lecturer: Mapped["Lecturer"] = relationship("Lecturer", lazy="selectin")
    students: Mapped[list["Student"]] = relationship(
        "Student", secondary=unit_students, lazy="selectin"
    )
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="unit", cascade="all, delete-orphan", lazy="selectin"
    )
