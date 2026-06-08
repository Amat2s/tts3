"""create lecturers and students tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

lecturertitle_enum = postgresql.ENUM(
    "Dr.", "Prof.", "A/Prof.", "Mr.", "Ms.",
    name="lecturertitle",
    create_type=False,
)
availabilityday_enum = postgresql.ENUM(
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    name="availabilityday",
    create_type=False,
)
availabilityslot_enum = postgresql.ENUM(
    "s1", "s2", "s3", "s5", "s6", "s7", "s8",
    name="availabilityslot",
    create_type=False,
)
studenttitle_enum = postgresql.ENUM(
    "Mr.", "Ms.", "Mx.",
    name="studenttitle",
    create_type=False,
)


def upgrade() -> None:
    lecturertitle_enum.create(op.get_bind(), checkfirst=True)
    availabilityday_enum.create(op.get_bind(), checkfirst=True)
    availabilityslot_enum.create(op.get_bind(), checkfirst=True)
    studenttitle_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "lecturers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("title", lecturertitle_enum, nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
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

    op.create_table(
        "lecturer_availability",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("lecturer_id", sa.String(), nullable=False),
        sa.Column("day", availabilityday_enum, nullable=False),
        sa.Column("slot", availabilityslot_enum, nullable=False),
        sa.ForeignKeyConstraint(
            ["lecturer_id"], ["lecturers.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "lecturer_id", "day", "slot", name="uq_lecturer_availability"
        ),
    )

    op.create_table(
        "students",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("title", studenttitle_enum, nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("year_level", sa.Integer(), nullable=False),
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


def downgrade() -> None:
    op.drop_table("lecturer_availability")
    op.drop_table("lecturers")
    op.drop_table("students")
    lecturertitle_enum.drop(op.get_bind(), checkfirst=True)
    availabilityday_enum.drop(op.get_bind(), checkfirst=True)
    availabilityslot_enum.drop(op.get_bind(), checkfirst=True)
    studenttitle_enum.drop(op.get_bind(), checkfirst=True)
