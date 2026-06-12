"""create solver runs table

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

status_col = PgEnum(
    "pending",
    "running",
    "succeeded",
    "failed",
    name="solverrunstatus",
    create_type=False,
)


def upgrade() -> None:
    status_col.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "solver_runs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("status", status_col, nullable=False),
        sa.Column("trigger_job_id", sa.String(), nullable=True),
        sa.Column("correlation_id", sa.String(), nullable=False),
        sa.Column("requested_by_admin_id", sa.String(), nullable=True),
        sa.Column("scheduled_count", sa.Integer(), nullable=True),
        sa.Column("unscheduled_count", sa.Integer(), nullable=True),
        sa.Column("partial_success", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("failure_message", sa.Text(), nullable=True),
        sa.Column("failure_code", sa.String(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_solver_runs_status", "solver_runs", ["status"])
    op.create_index("ix_solver_runs_created_at", "solver_runs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_solver_runs_created_at", table_name="solver_runs")
    op.drop_index("ix_solver_runs_status", table_name="solver_runs")
    op.drop_table("solver_runs")
    status_col.drop(op.get_bind(), checkfirst=True)

