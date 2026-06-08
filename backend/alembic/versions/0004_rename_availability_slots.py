"""rename availability slots s5-s8 to s4-s7

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-08

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's5' TO 's4'")
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's6' TO 's5'")
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's7' TO 's6'")
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's8' TO 's7'")


def downgrade() -> None:
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's7' TO 's8'")
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's6' TO 's7'")
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's5' TO 's6'")
    op.execute("ALTER TYPE availabilityslot RENAME VALUE 's4' TO 's5'")
