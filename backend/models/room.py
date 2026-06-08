import enum
import uuid

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
    room_type: Mapped[RoomType] = mapped_column(
        Enum(RoomType, name="roomtype", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
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
