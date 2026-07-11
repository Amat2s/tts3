"""add seminar session type

Unit 115: extend the ``sessiontype`` Postgres enum with a third value,
``seminar``, alongside ``lecture``/``tutorial``. No data backfill — existing
``lecture``/``tutorial`` rows are untouched and no row becomes ``seminar`` on
migration.

Postgres cannot add an enum value and use it inside the same transaction, and
cannot drop a single enum value at all. To keep the downgrade path reversible
(matching migration 0011's approach for this same enum), the type is rebuilt
via rename-aside / create / cast rather than ``ALTER TYPE ... ADD VALUE``.

Downgrade rebuilds the enum back to ``('lecture', 'tutorial')`` and therefore
fails loudly if any ``seminar`` rows still exist — the same reversibility limit
documented on migration 0011.

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE sessiontype RENAME TO sessiontype_old")
    op.execute("CREATE TYPE sessiontype AS ENUM ('lecture', 'tutorial', 'seminar')")
    op.execute(
        "ALTER TABLE sessions ALTER COLUMN session_type TYPE sessiontype "
        "USING session_type::text::sessiontype"
    )
    op.execute("DROP TYPE sessiontype_old")


def downgrade() -> None:
    bind = op.get_bind()
    seminar_count = bind.execute(
        sa.text("SELECT count(*) FROM sessions WHERE session_type = 'seminar'")
    ).scalar()
    if seminar_count:
        raise RuntimeError(
            "Cannot downgrade: "
            f"{seminar_count} session(s) still use the 'seminar' type. "
            "Reassign or delete them before downgrading."
        )

    op.execute("ALTER TYPE sessiontype RENAME TO sessiontype_old")
    op.execute("CREATE TYPE sessiontype AS ENUM ('lecture', 'tutorial')")
    op.execute(
        "ALTER TABLE sessions ALTER COLUMN session_type TYPE sessiontype "
        "USING session_type::text::sessiontype"
    )
    op.execute("DROP TYPE sessiontype_old")
