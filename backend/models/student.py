import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class StudentTitle(str, enum.Enum):
    MR = "Mr."
    MS = "Ms."
    MX = "Mx."


class Student(Base):
    __tablename__ = "students"

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
