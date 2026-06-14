"""session-student allocations and reduced session types

Unit 60:
1. Create the hidden ``session_student_allocations`` table (system-owned; no API
   route). Cascade-deletes with both its session and its student.
2. Reduce the ``sessiontype`` Postgres enum to only ``lecture`` and
   ``tutorial``. Existing ``lab``/``workshop`` rows are first remapped to
   ``tutorial`` so no row is left referencing a removed value.

Postgres cannot drop values from an enum in place, so the enum is rebuilt: the
old type is renamed aside, a new two-value type is created, the column is recast
through text, and the old type is dropped.

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Hidden session-student allocations table.
    op.create_table(
        "session_student_allocations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("student_id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "session_id", "student_id", name="uq_session_student_allocation"
        ),
    )
    op.create_index(
        "ix_session_student_allocations_session_id",
        "session_student_allocations",
        ["session_id"],
    )
    op.create_index(
        "ix_session_student_allocations_student_id",
        "session_student_allocations",
        ["student_id"],
    )

    # 2. Remap any lab/workshop sessions to tutorial before shrinking the enum.
    op.execute(
        sa.text(
            "UPDATE sessions SET session_type = 'tutorial' "
            "WHERE session_type IN ('lab', 'workshop')"
        )
    )

    # 3. Rebuild the enum with only lecture/tutorial.
    op.execute("ALTER TYPE sessiontype RENAME TO sessiontype_old")
    op.execute("CREATE TYPE sessiontype AS ENUM ('lecture', 'tutorial')")
    op.execute(
        "ALTER TABLE sessions ALTER COLUMN session_type TYPE sessiontype "
        "USING session_type::text::sessiontype"
    )
    op.execute("DROP TYPE sessiontype_old")


def downgrade() -> None:
    # Restore the four-value enum. Previously-remapped lab/workshop rows cannot
    # be recovered (the distinction was lost on upgrade); they remain tutorial.
    op.execute("ALTER TYPE sessiontype RENAME TO sessiontype_old")
    op.execute(
        "CREATE TYPE sessiontype AS ENUM ('lecture', 'tutorial', 'lab', 'workshop')"
    )
    op.execute(
        "ALTER TABLE sessions ALTER COLUMN session_type TYPE sessiontype "
        "USING session_type::text::sessiontype"
    )
    op.execute("DROP TYPE sessiontype_old")

    op.drop_index(
        "ix_session_student_allocations_student_id",
        table_name="session_student_allocations",
    )
    op.drop_index(
        "ix_session_student_allocations_session_id",
        table_name="session_student_allocations",
    )
    op.drop_table("session_student_allocations")
