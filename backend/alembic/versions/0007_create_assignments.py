"""create timetable assignments table

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

day_col = PgEnum(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    name="assignmentday",
    create_type=False,
)
slot_col = PgEnum(
    "s1", "s2", "s3", "s4", "s5", "s6", "s7",
    name="assignmentslot",
    create_type=False,
)


def upgrade() -> None:
    day_col.create(op.get_bind(), checkfirst=True)
    slot_col.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "timetable_assignments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("day", day_col, nullable=False),
        sa.Column("start_slot", slot_col, nullable=False),
        sa.Column("room_id", sa.String(), nullable=False),
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
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", name="uq_assignment_session"),
        sa.UniqueConstraint("day", "start_slot", "room_id", name="uq_assignment_room_slot"),
    )


def downgrade() -> None:
    op.drop_table("timetable_assignments")
    day_col.drop(op.get_bind(), checkfirst=True)
    slot_col.drop(op.get_bind(), checkfirst=True)
