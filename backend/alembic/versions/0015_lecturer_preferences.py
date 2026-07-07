"""lecturer preference persistence

Unit 98 (backend lecturer preference persistence):

Create the persisted lecturer scheduling preference data model.

``lecturer_preferences`` — one row per room-specific preference cell
(``lecturer_id + day + slot + room_id``) carrying exactly one ``level``
(``preferred`` | ``avoid``) via a new ``preferencelevel`` enum. Rows cascade
when their lecturer or room is deleted. A unique
``(lecturer_id, day, slot, room_id)`` keeps a cell to a single level; indexes on
``lecturer_id`` and ``(day, slot, room_id)`` support lookups. No row means
neutral (no preference); neutral is never stored.

Preferences are soft constraints only, distinct from lecturer availability and
timetable blocks (both hard constraints); solver integration comes later.

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

level_col = PgEnum(
    "preferred", "avoid",
    name="preferencelevel",
    create_type=False,
)
day_col = PgEnum(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    name="prefday",
    create_type=False,
)
slot_col = PgEnum(
    "s1", "s2", "s3", "s4", "s5", "s6", "s7",
    name="prefslot",
    create_type=False,
)


def upgrade() -> None:
    level_col.create(op.get_bind(), checkfirst=True)
    day_col.create(op.get_bind(), checkfirst=True)
    slot_col.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "lecturer_preferences",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("lecturer_id", sa.String(), nullable=False),
        sa.Column("day", day_col, nullable=False),
        sa.Column("slot", slot_col, nullable=False),
        sa.Column("room_id", sa.String(), nullable=False),
        sa.Column("level", level_col, nullable=False),
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
        sa.ForeignKeyConstraint(
            ["lecturer_id"], ["lecturers.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "lecturer_id",
            "day",
            "slot",
            "room_id",
            name="uq_lecturer_preference_cell",
        ),
    )
    op.create_index(
        "ix_lecturer_preferences_lecturer_id",
        "lecturer_preferences",
        ["lecturer_id"],
    )
    op.create_index(
        "ix_lecturer_preferences_day_slot_room",
        "lecturer_preferences",
        ["day", "slot", "room_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_lecturer_preferences_day_slot_room",
        table_name="lecturer_preferences",
    )
    op.drop_index(
        "ix_lecturer_preferences_lecturer_id",
        table_name="lecturer_preferences",
    )
    op.drop_table("lecturer_preferences")
    slot_col.drop(op.get_bind(), checkfirst=True)
    day_col.drop(op.get_bind(), checkfirst=True)
    level_col.drop(op.get_bind(), checkfirst=True)
