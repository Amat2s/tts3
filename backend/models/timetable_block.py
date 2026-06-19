import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base
from models.lecturer import AvailabilityDay, AvailabilitySlot


class BlockColour(str, enum.Enum):
    """Allowed colours for a named timetable block (Unit 84).

    Unnamed blocks store no colour; a named block must carry one of these.
    """

    GOLD = "gold"
    LIGHT_BLUE = "light_blue"
    LIGHT_PINK = "light_pink"


class TimetableBlockGroup(Base):
    """A named or unnamed group of reserved (blocked) timetable cells.

    Blocks are a hard constraint over specific ``day + slot + room_id`` cells.
    They are not sessions and never appear in scheduling models. An unnamed
    block has ``name = None`` and ``colour = None``; a named block requires both.
    """

    __tablename__ = "timetable_block_groups"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    colour: Mapped[BlockColour | None] = mapped_column(
        Enum(
            BlockColour,
            name="blockcolour",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=True,
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

    # Deleting a block group cascades to its cells (DB-level + ORM cascade).
    cells: Mapped[list["TimetableBlockCell"]] = relationship(
        "TimetableBlockCell",
        back_populates="block_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TimetableBlockCell(Base):
    """A single room-specific blocked cell: ``day + slot + room_id``.

    A cell may be blocked by at most one group (unique ``(day, slot, room_id)``).
    Cells cascade when their group is deleted and are removed when their room is
    deleted.
    """

    __tablename__ = "timetable_block_cells"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    block_group_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("timetable_block_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    day: Mapped[AvailabilityDay] = mapped_column(
        Enum(
            AvailabilityDay,
            name="blockday",
            create_type=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    slot: Mapped[AvailabilitySlot] = mapped_column(
        Enum(
            AvailabilitySlot,
            name="blockslot",
            create_type=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    room_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    block_group: Mapped["TimetableBlockGroup"] = relationship(
        "TimetableBlockGroup", back_populates="cells"
    )

    __table_args__ = (
        UniqueConstraint("day", "slot", "room_id", name="uq_block_cell_day_slot_room"),
        Index("ix_block_cells_block_group_id", "block_group_id"),
        Index("ix_block_cells_room_id", "room_id"),
        Index("ix_block_cells_day_slot_room", "day", "slot", "room_id"),
    )
