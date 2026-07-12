import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class RoomType(str, enum.Enum):
    LECTURE = "lecture"
    TUTORIAL = "tutorial"


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Persisted left-to-right timetable column order (Unit 113). Non-null; new
    # rooms are appended to the end by create_room. Positions need not be
    # contiguous — deletes may leave gaps, which is fine because ordering is by
    # ascending position. The Python-side default keeps direct construction and
    # legacy inserts valid; create_room overrides it with the real append value.
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    room_type: Mapped[RoomType] = mapped_column(
        Enum(RoomType, name="roomtype", values_callable=lambda obj: [e.value for e in obj]),
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
