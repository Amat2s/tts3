"""add rooms.position for admin-controlled ordering

Unit 113 (backend room ordering persistence):

Give rooms a persisted, admin-controlled ``position`` so the timetable can
render room columns left-to-right in that order. Previously rooms had no order
field and were returned alphabetically by ``name``.

The column is added nullable first, then backfilled by the existing alphabetical
``name`` order (``row_number()`` over ``ORDER BY name``, 0-based) so the visible
timetable order is preserved verbatim immediately after migrating, then set
``NOT NULL``. Positions need not stay contiguous — later deletes may leave gaps,
which is fine because ordering is by ascending ``position``.

Downgrade drops the column.

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the column nullable so existing rows can be backfilled first.
    op.add_column("rooms", sa.Column("position", sa.Integer(), nullable=True))

    # 2. Backfill by the existing alphabetical name order, 0-based, so the
    #    timetable looks identical immediately after migrating.
    op.execute(
        sa.text(
            """
            WITH ordered AS (
                SELECT id, (row_number() OVER (ORDER BY name) - 1) AS pos
                FROM rooms
            )
            UPDATE rooms
            SET position = ordered.pos
            FROM ordered
            WHERE rooms.id = ordered.id
            """
        )
    )

    # 3. Enforce NOT NULL once every row has a value.
    op.alter_column(
        "rooms", "position", existing_type=sa.Integer(), nullable=False
    )


def downgrade() -> None:
    op.drop_column("rooms", "position")
