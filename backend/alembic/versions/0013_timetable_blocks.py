"""timetable block groups and room-specific block cells

Unit 84 (backend timetable block persistence):

Create the persisted timetable block data model.

1. ``timetable_block_groups`` — a named or unnamed group of reserved cells.
   ``name`` and ``colour`` are both nullable: an unnamed block stores neither,
   a named block carries both (enforced at the service layer). ``colour`` uses
   a new ``blockcolour`` enum (``gold``, ``light_blue``, ``light_pink``).

2. ``timetable_block_cells`` — one row per reserved ``day + slot + room_id``
   cell. Cells cascade when their block group is deleted and are removed when
   their room is deleted. A unique ``(day, slot, room_id)`` ensures a cell is
   blocked by at most one group. Indexes on ``block_group_id``, ``room_id``,
   and ``(day, slot, room_id)`` support lookups and overlap detection.

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

colour_col = PgEnum(
    "gold", "light_blue", "light_pink",
    name="blockcolour",
    create_type=False,
)
day_col = PgEnum(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    name="blockday",
    create_type=False,
)
slot_col = PgEnum(
    "s1", "s2", "s3", "s4", "s5", "s6", "s7",
    name="blockslot",
    create_type=False,
)


def upgrade() -> None:
    colour_col.create(op.get_bind(), checkfirst=True)
    day_col.create(op.get_bind(), checkfirst=True)
    slot_col.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "timetable_block_groups",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("colour", colour_col, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "timetable_block_cells",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("block_group_id", sa.String(), nullable=False),
        sa.Column("day", day_col, nullable=False),
        sa.Column("slot", slot_col, nullable=False),
        sa.Column("room_id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["block_group_id"], ["timetable_block_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "day", "slot", "room_id", name="uq_block_cell_day_slot_room"
        ),
    )
    op.create_index(
        "ix_block_cells_block_group_id",
        "timetable_block_cells",
        ["block_group_id"],
    )
    op.create_index(
        "ix_block_cells_room_id",
        "timetable_block_cells",
        ["room_id"],
    )
    op.create_index(
        "ix_block_cells_day_slot_room",
        "timetable_block_cells",
        ["day", "slot", "room_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_block_cells_day_slot_room", table_name="timetable_block_cells")
    op.drop_index("ix_block_cells_room_id", table_name="timetable_block_cells")
    op.drop_index("ix_block_cells_block_group_id", table_name="timetable_block_cells")
    op.drop_table("timetable_block_cells")
    op.drop_table("timetable_block_groups")
    slot_col.drop(op.get_bind(), checkfirst=True)
    day_col.drop(op.get_bind(), checkfirst=True)
    colour_col.drop(op.get_bind(), checkfirst=True)
