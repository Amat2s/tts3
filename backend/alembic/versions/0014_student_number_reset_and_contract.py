"""student number reset and required unique contract

Unit 89 (backend student number reset and contract):

DESTRUCTIVE RESET — this migration intentionally DELETES ALL existing
``students`` rows before adding the new required ``student_number`` column. The
existing student data is discarded on purpose so the database starts fresh under
the new required, unique student-number contract. This is a deliberate reset,
NOT a preservation/backfill migration: there is no attempt to derive or
back-populate a student number for the old rows.

Steps:

1. Delete every ``students`` row. The existing ``ON DELETE CASCADE`` foreign keys
   on ``unit_students.student_id`` and ``session_student_allocations.student_id``
   clear the dependent enrolment and hidden-allocation rows automatically, so the
   reset stays consistent with no orphaned enrolments or allocations.

2. Add ``student_number`` as ``NOT NULL``. The table is empty after step 1, so the
   required column needs no backfill and no server default.

3. Enforce uniqueness with a unique index (``ix_students_student_number``).

``students.id`` remains the internal primary key (unchanged) and the existing
``ck_student_year_level`` CHECK (``year_level IN (1, 2, 3)``) is left untouched.

The 8-digit format/normalization rule is enforced in the Pydantic schema and
service layer (mirroring the unit-code contract), not by a database constraint,
so no CHECK is added for it here.

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Deliberate destructive reset: drop all existing students. The cascading
    #    FKs on unit_students and session_student_allocations clear dependent
    #    rows tied to these students automatically.
    op.execute("DELETE FROM students")

    # 2. Add the required student number. Safe as NOT NULL because the table is
    #    now empty (no backfill / server default required).
    op.add_column(
        "students",
        sa.Column("student_number", sa.String(), nullable=False),
    )

    # 3. Enforce uniqueness on the new institutional identifier.
    op.create_index(
        "ix_students_student_number",
        "students",
        ["student_number"],
        unique=True,
    )


def downgrade() -> None:
    # Note: the destructive student reset performed on upgrade is not (and cannot
    # be) reversed here — the deleted student data is gone. Downgrade only removes
    # the new column and its unique index.
    op.drop_index("ix_students_student_number", table_name="students")
    op.drop_column("students", "student_number")
