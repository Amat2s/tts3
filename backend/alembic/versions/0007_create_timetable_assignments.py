"""create timetable assignments table

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

assignmentday_col = PgEnum(
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    name="assignmentday",
    create_type=False,
)
assignmentslot_col = PgEnum(
    "s1", "s2", "s3", "s4", "s5", "s6", "s7", name="assignmentslot", create_type=False
)


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE assignmentday AS ENUM (
                'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE assignmentslot AS ENUM (
                's1', 's2', 's3', 's4', 's5', 's6', 's7'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.create_table(
        "timetable_assignments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("room_id", sa.String(), nullable=False),
        sa.Column("day", assignmentday_col, nullable=False),
        sa.Column("start_slot", assignmentslot_col, nullable=False),
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
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", name="uq_timetable_assignments_session_id"),
    )
    op.create_index(
        "ix_timetable_assignments_room_id", "timetable_assignments", ["room_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_timetable_assignments_room_id", table_name="timetable_assignments")
    op.drop_table("timetable_assignments")
    op.execute("DROP TYPE IF EXISTS assignmentslot")
    op.execute("DROP TYPE IF EXISTS assignmentday")
