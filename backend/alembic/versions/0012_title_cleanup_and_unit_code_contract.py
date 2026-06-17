"""student title removal and lecturer title migration

Unit 72 (backend title and unit-code contract cleanup):

1. Remove the ``title`` column from ``students`` entirely and drop the now-unused
   ``studenttitle`` Postgres enum type. Student titles are removed completely;
   they are not hidden or retained as an unused field.

2. Migrate ``lecturertitle`` to the final product list
   (``Mr``, ``Ms``, ``Mrs``, ``Dr``, ``Fr``, ``A/Prof.``, ``Prof.``). Existing
   values are remapped (``Dr.`` -> ``Dr``, ``Mr.`` -> ``Mr``, ``Ms.`` -> ``Ms``;
   ``Prof.`` and ``A/Prof.`` are unchanged) and the new ``Mrs`` / ``Fr`` values
   become valid. Postgres cannot drop/rename enum values in place, so the enum
   is rebuilt: rename old type aside, create the new type, recast the column with
   an explicit value mapping, drop the old type.

Unit-code structural validation (``^[A-Z]{3}\\d{3}$``) and uppercase
normalization are enforced in the Pydantic schemas / service layer, not by a
database constraint, so they require no migration here.

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Remove the student title column and its now-unused enum type.
    op.drop_column("students", "title")
    op.execute("DROP TYPE IF EXISTS studenttitle")

    # 2. Rebuild the lecturer title enum, remapping existing values.
    op.execute("ALTER TYPE lecturertitle RENAME TO lecturertitle_old")
    op.execute(
        "CREATE TYPE lecturertitle AS ENUM "
        "('Mr', 'Ms', 'Mrs', 'Dr', 'Fr', 'A/Prof.', 'Prof.')"
    )
    op.execute(
        "ALTER TABLE lecturers ALTER COLUMN title TYPE lecturertitle USING ("
        "  CASE title::text"
        "    WHEN 'Dr.' THEN 'Dr'"
        "    WHEN 'Mr.' THEN 'Mr'"
        "    WHEN 'Ms.' THEN 'Ms'"
        "    WHEN 'Prof.' THEN 'Prof.'"
        "    WHEN 'A/Prof.' THEN 'A/Prof.'"
        "    ELSE 'Mr'"
        "  END::lecturertitle"
        ")"
    )
    op.execute("DROP TYPE lecturertitle_old")


def downgrade() -> None:
    # Restore the previous lecturer title enum. The new-only values (Mrs, Fr)
    # have no pre-existing equivalent and are mapped to the closest old value
    # (lossy, documented).
    op.execute("ALTER TYPE lecturertitle RENAME TO lecturertitle_new")
    op.execute(
        "CREATE TYPE lecturertitle AS ENUM "
        "('Dr.', 'Prof.', 'A/Prof.', 'Mr.', 'Ms.')"
    )
    op.execute(
        "ALTER TABLE lecturers ALTER COLUMN title TYPE lecturertitle USING ("
        "  CASE title::text"
        "    WHEN 'Dr' THEN 'Dr.'"
        "    WHEN 'Mr' THEN 'Mr.'"
        "    WHEN 'Ms' THEN 'Ms.'"
        "    WHEN 'Mrs' THEN 'Ms.'"
        "    WHEN 'Fr' THEN 'Mr.'"
        "    WHEN 'Prof.' THEN 'Prof.'"
        "    WHEN 'A/Prof.' THEN 'A/Prof.'"
        "    ELSE 'Mr.'"
        "  END::lecturertitle"
        ")"
    )
    op.execute("DROP TYPE lecturertitle_new")

    # Recreate the student title enum and column (nullable cannot be guaranteed
    # NOT NULL without data, so re-add as nullable then set a default-free state
    # mirroring the original three-value enum).
    op.execute("CREATE TYPE studenttitle AS ENUM ('Mr.', 'Ms.', 'Mx.')")
    op.add_column(
        "students",
        sa.Column(
            "title",
            sa.Enum("Mr.", "Ms.", "Mx.", name="studenttitle"),
            nullable=True,
        ),
    )
