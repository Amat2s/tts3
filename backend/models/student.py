import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base


class StudentTitle(str, enum.Enum):
    MR = "Mr."
    MS = "Ms."
    MX = "Mx."


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        CheckConstraint("year_level IN (1, 2, 3)", name="ck_student_year_level"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[StudentTitle] = mapped_column(
        Enum(
            StudentTitle,
            name="studenttitle",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
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
    # Continues to use the existing unit_students join table (no separate
    # enrolment model). Referenced by name to avoid a cross-module import.
    units: Mapped[list["Unit"]] = relationship(
        "Unit",
        secondary="unit_students",
        lazy="selectin",
        back_populates="students",
    )
