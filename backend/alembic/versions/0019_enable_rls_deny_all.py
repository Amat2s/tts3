"""enable row level security (deny-all) on every public table

Closes the Supabase auto-exposed Data API (PostgREST) door. With RLS disabled,
the ``anon`` and ``authenticated`` roles that back the browser-shipped anon key
can read and write every row directly, bypassing the FastAPI backend and its
Supabase-JWT auth entirely. The app never uses that direct Data API path — the
frontend talks only to the backend, which connects as ``postgres`` (a role with
``rolbypassrls = true``) — so enabling RLS with **no policies** shuts the direct
door while leaving the backend's access untouched.

Deny-by-default is intentional: RLS-enabled with zero policies means PostgREST
returns nothing for ``anon``/``authenticated``. If a future feature needs direct
client-side table access, add explicit policies in a later migration rather than
disabling RLS again.

``alembic_version`` is deliberately included: it is an internal migration-
bookkeeping table with no reason to be reachable through the Data API. The
backend/Alembic (``postgres``) bypass RLS, so gating it does not affect
migrations.

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-13

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Every table in the public schema. Kept as an explicit list (rather than a
# dynamic catalog sweep) so the migration is deterministic and reviewable.
_TABLES: tuple[str, ...] = (
    "alembic_version",
    "rooms",
    "lecturers",
    "lecturer_availability",
    "students",
    "units",
    "unit_students",
    "sessions",
    "timetable_assignments",
    "solver_runs",
    "unit_lecturers",
    "session_student_allocations",
    "timetable_block_groups",
    "timetable_block_cells",
    "lecturer_preferences",
)


def upgrade() -> None:
    for table in _TABLES:
        # ENABLE alone leaves the table readable by its owner-adjacent roles but
        # closed to anon/authenticated with no policy. FORCE additionally makes
        # the policy check apply even to the table owner, so a non-bypass owner
        # role can never accidentally read around it. The backend's postgres role
        # bypasses RLS regardless (rolbypassrls), so backend access is unchanged.
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE public.{table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE public.{table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
