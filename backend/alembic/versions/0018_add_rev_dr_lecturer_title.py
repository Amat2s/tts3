"""add Rev. Dr lecturer title

Extend the ``lecturertitle`` Postgres enum with an eighth value, ``Rev. Dr``,
alongside the existing final product list
(``Mr``, ``Ms``, ``Mrs``, ``Dr``, ``Fr``, ``A/Prof.``, ``Prof.``). No data
backfill — existing lecturer rows are untouched and none becomes ``Rev. Dr`` on
migration.

Postgres cannot add an enum value and use it inside the same transaction, and
cannot drop a single enum value at all. To keep the downgrade path reversible
(matching migrations 0012/0017 for these enums), the type is rebuilt via
rename-aside / create / cast rather than ``ALTER TYPE ... ADD VALUE``.

Downgrade rebuilds the enum back to the seven-value list and therefore fails
loudly if any ``Rev. Dr`` rows still exist — the same reversibility limit
documented on migrations 0012/0017.

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-13

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE lecturertitle RENAME TO lecturertitle_old")
    op.execute(
        "CREATE TYPE lecturertitle AS ENUM "
        "('Mr', 'Ms', 'Mrs', 'Dr', 'Fr', 'Rev. Dr', 'A/Prof.', 'Prof.')"
    )
    op.execute(
        "ALTER TABLE lecturers ALTER COLUMN title TYPE lecturertitle "
        "USING title::text::lecturertitle"
    )
    op.execute("DROP TYPE lecturertitle_old")


def downgrade() -> None:
    # The USING cast below rebuilds the seven-value enum and fails loudly if any
    # lecturer row still carries 'Rev. Dr' (no equivalent in the old set) — the
    # documented, intentional reversibility limit shared with migrations 0012/0017.
    op.execute("ALTER TYPE lecturertitle RENAME TO lecturertitle_new")
    op.execute(
        "CREATE TYPE lecturertitle AS ENUM "
        "('Mr', 'Ms', 'Mrs', 'Dr', 'Fr', 'A/Prof.', 'Prof.')"
    )
    op.execute(
        "ALTER TABLE lecturers ALTER COLUMN title TYPE lecturertitle "
        "USING title::text::lecturertitle"
    )
    op.execute("DROP TYPE lecturertitle_new")
