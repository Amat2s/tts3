"""add unit year_level (derived) and year-level check constraints

Adds a stored, derived ``units.year_level`` column backfilled by parsing each
unit code's first digit (must be 1, 2, or 3). Adds database CHECK constraints
restricting both ``units.year_level`` and ``students.year_level`` to 1..3.

The backfill fails loudly if any existing unit code has no valid first digit in
1..3, and the students CHECK constraint will fail loudly if any existing student
row has a year level of 4/5 — there should be no such rows.

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from services.year_level import parse_unit_year_level

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the column nullable so existing rows can be backfilled first.
    op.add_column("units", sa.Column("year_level", sa.Integer(), nullable=True))

    # 2. Backfill by parsing each unit code. Fail loudly on any invalid code.
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, code FROM units")).fetchall()
    for row in rows:
        year_level = parse_unit_year_level(row.code)
        bind.execute(
            sa.text("UPDATE units SET year_level = :year WHERE id = :id"),
            {"year": year_level, "id": row.id},
        )

    # 3. Enforce NOT NULL once every row has a value.
    op.alter_column("units", "year_level", existing_type=sa.Integer(), nullable=False)

    # 4. Restrict both year levels to 1..3 at rest.
    op.create_check_constraint(
        "ck_unit_year_level", "units", "year_level IN (1, 2, 3)"
    )
    op.create_check_constraint(
        "ck_student_year_level", "students", "year_level IN (1, 2, 3)"
    )


def downgrade() -> None:
    op.drop_constraint("ck_student_year_level", "students", type_="check")
    op.drop_constraint("ck_unit_year_level", "units", type_="check")
    op.drop_column("units", "year_level")
