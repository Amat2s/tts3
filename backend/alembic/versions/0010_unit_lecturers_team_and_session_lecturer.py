"""unit teaching team and session-level lecturer

Unit 59: move lecturer ownership from a single ``units.lecturer_id`` to a
``unit_lecturers`` teaching team plus a per-session ``sessions.lecturer_id``.

Upgrade steps:
1. Create the ``unit_lecturers`` join table (composite PK enforces the unique
   ``(unit_id, lecturer_id)`` constraint; both FKs cascade on delete).
2. Populate ``unit_lecturers`` from every existing ``units.lecturer_id``.
3. Add a nullable ``sessions.lecturer_id`` FK to ``lecturers.id``.
4. Backfill ``sessions.lecturer_id`` from each session's parent unit lecturer.
5. Drop the old ``units.lecturer_id`` column.

``sessions.lecturer_id`` is left nullable: a session may exist without an
assigned lecturer (it is simply not schedulable until one is assigned), which
the schemas and services rely on. The v1 invariant guaranteed every unit had a
lecturer, so the backfill assigns one to every existing session.

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Teaching-team join table.
    op.create_table(
        "unit_lecturers",
        sa.Column(
            "unit_id",
            sa.String(),
            sa.ForeignKey("units.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "lecturer_id",
            sa.String(),
            sa.ForeignKey("lecturers.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # 2. Populate the team from each unit's existing single lecturer.
    op.execute(
        sa.text(
            "INSERT INTO unit_lecturers (unit_id, lecturer_id) "
            "SELECT id, lecturer_id FROM units WHERE lecturer_id IS NOT NULL"
        )
    )

    # 3. Add the per-session lecturer (nullable).
    op.add_column(
        "sessions",
        sa.Column(
            "lecturer_id",
            sa.String(),
            sa.ForeignKey("lecturers.id"),
            nullable=True,
        ),
    )

    # 4. Backfill each session from its parent unit's lecturer.
    op.execute(
        sa.text(
            "UPDATE sessions "
            "SET lecturer_id = (SELECT u.lecturer_id FROM units u WHERE u.id = sessions.unit_id)"
        )
    )

    # 5. Drop the old single-lecturer column now that the data has moved.
    op.drop_column("units", "lecturer_id")


def downgrade() -> None:
    # Re-add the single lecturer column (nullable — multi-lecturer teams cannot
    # be losslessly collapsed back to one column).
    op.add_column(
        "units",
        sa.Column(
            "lecturer_id",
            sa.String(),
            sa.ForeignKey("lecturers.id"),
            nullable=True,
        ),
    )
    # Best-effort restore: pick one teaching-team lecturer per unit.
    op.execute(
        sa.text(
            "UPDATE units "
            "SET lecturer_id = (SELECT ul.lecturer_id FROM unit_lecturers ul "
            "WHERE ul.unit_id = units.id LIMIT 1)"
        )
    )
    op.drop_column("sessions", "lecturer_id")
    op.drop_table("unit_lecturers")
