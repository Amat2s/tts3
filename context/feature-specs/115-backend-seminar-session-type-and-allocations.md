# Unit 115 Spec: Backend Seminar Session Type and Independent Student Allocations

## Goal

Add **Seminar** as a third session type alongside `lecture` and `tutorial`.
A seminar behaves exactly like a tutorial for the hidden student-allocation
system — enrolled students are divided into balanced groups, each student in
exactly **one** seminar — **except** the seminar grouping is a separate,
independent partition from the tutorial grouping. The two sortings do not
coordinate: a student is placed in exactly one tutorial *and* exactly one
seminar, and the two group memberships are computed independently (they may
coincidentally share members — no attempt is made to align or to avoid overlap).

Backend-only. Frontend surfaces are **Unit 116**; the Excel export is **Unit
117**.

## Role of this unit

This unit extends the same machinery Unit 60 introduced: the `SessionType` enum
and the hidden, system-owned `session_student_allocations` table. Seminars are
schedulable sessions like any other — they carry a lecturer, a duration, and
derived allocations; capacity and student-conflict data come from allocation
rows, not from unit enrolment. No new table, no user-editable allocation, no
solver feasibility change.

## Design

- System boundary: `backend/` only. Files:
  `backend/models/session.py`, `backend/schemas/session.py`,
  `backend/services/session_allocation.py`, `backend/solver/types.py`, plus a
  new Alembic migration. No new packages.
- `SessionType` gains a third member `SEMINAR = "seminar"`. `lecture` and
  `tutorial` are unchanged.
- Seminars reuse the **tutorial partition algorithm verbatim**, run as a
  **second, independent** partition over the unit's seminar sessions. The
  algorithm is generalised (not duplicated) so tutorials and seminars share one
  implementation but two disjoint invocations.
- "Independent partition" (the decision behind *don't overlap their student
  sorting*): the seminar partition is computed with no reference to the tutorial
  partition and vice versa. There is deliberately **no** anti-overlap or
  correlation logic — the two divisions are simply separate.

## Implementation

### Migration

New Alembic migration (new head, revises `0016`):

- Extend the Postgres `sessiontype` enum with the value `seminar`.
  - Postgres cannot add an enum value inside a transaction that also uses it;
    follow the project's existing enum-migration approach (see migration `0011`
    which reshaped this same enum). Prefer `ALTER TYPE sessiontype ADD VALUE
    'seminar'` in its own step, or the create-new-type / swap / drop-old pattern
    if a reversible downgrade is required.
  - No data backfill: existing `lecture`/`tutorial` rows are untouched; no rows
    become `seminar` on migration.
- Downgrade: because Postgres cannot drop a single enum value, a reversible
  downgrade must rebuild the type as `('lecture','tutorial')` and will fail if
  any `seminar` rows exist. Document this in the migration docstring; matching
  the reversibility level of migration `0011` is acceptable.

### Models

`backend/models/session.py`:

- Add `SEMINAR = "seminar"` to `SessionType`. No other model change — seminars
  reuse the existing `Session` columns and the existing `allocations`
  relationship.

### Schemas

`backend/schemas/session.py`:

- No structural change required: `SessionCreate`, `SessionUpdate`,
  `SessionResponse`, and `SchedulableSessionResponse` all reference
  `SessionType`, so `seminar` is accepted and returned automatically once the
  enum grows. Confirm no code hard-codes the two-value set.

### Allocation service

`backend/services/session_allocation.py`:

- Generalise `_tutorial_target(...)` into a type-agnostic
  `_group_target(session_ids, enrolled, existing_by_session)` (a pure balanced,
  stable partition of `enrolled` across `session_ids`). Behaviour is identical
  to today's tutorial logic — dedupe existing valid placements, place the
  unplaced into the smallest group, then correct imbalance with the fewest moves.
- In `rebalance_unit_session_allocations`:
  - Split the unit's sessions into `lecture_ids`, `tutorial_ids`, **and**
    `seminar_ids`.
  - Lectures: unchanged (every enrolled student in every lecture session).
  - Tutorials: `_group_target(tutorial_ids, enrolled, existing_by_session)`,
    reconciled against the tutorial rows only.
  - Seminars: `_group_target(seminar_ids, enrolled, existing_by_session)`,
    reconciled against the **seminar rows only** — a second, independent call.
    The two calls share the `enrolled` set and the same `existing_by_session`
    read but never each other's target, so the partitions are independent.
  - When a unit has no seminar sessions, seminar allocation rows for that unit
    are removed (mirrors the tutorial "no tutorials → drop tutorial rows" rule).
- The reconcile diff must scope each type's existing rows by that type's session
  ids (as tutorials already do), so seminar reconciliation never deletes or
  moves tutorial rows and vice versa.

### Trigger points

No new trigger points. `rebalance_unit_session_allocations` already runs after
every enrolment/session mutation (unit create/update, student create/update/
delete, session create/update/delete). Because it now also builds the seminar
partition, creating/updating/deleting a seminar session, or changing a session's
type to/from `seminar`, rebalances correctly through the existing callers.

### Capacity & defensive checks

- Assignment capacity and defensive save checks already derive the student count
  from allocation rows (Unit 60), so seminar capacity = the seminar group's
  allocated size with no additional code. Confirm no capacity branch is keyed on
  `session_type == tutorial`; if one exists, generalise it to "any allocation-
  grouped type".

### Solver ordering constant

`backend/solver/types.py`:

- Add `"seminar": 2` to `SESSION_TYPE_ORDER` so seminars sort deterministically
  after tutorials (today unknown types fall to `99`). This is a **pure
  deterministic-ordering tie-break with no feasibility meaning** — seminars are
  already valid solver input because they carry allocation rows like tutorials.
  No other solver/snapshot change: capacity, conflicts, and candidate generation
  all flow from allocations, which this unit populates.

## Out of scope

- Any frontend change (Unit 116) or Excel-export change (Unit 117).
- Any anti-overlap / correlated grouping between tutorials and seminars — the
  decision is an independent partition; overlap is allowed and untracked.
- New room-type rules for seminars. Seminars follow tutorial room behaviour:
  capacity is by allocated count; no room-type-vs-session-type hard constraint is
  introduced in v1.
- Exposing allocation membership through any API (still system-owned/hidden).

## Dependencies

- New Alembic migration revising `0016`. No new packages.

## Tests

Backend (pytest):

- `seminar` is accepted by session create/update and round-trips through
  `SessionResponse` / the schedulable DTO.
- Migration adds the enum value; existing rows are unchanged.
- Seminar allocation gives every enrolled student exactly one seminar when at
  least one seminar exists, balanced as evenly as possible.
- Tutorial and seminar partitions are **independent**: in a unit with both, each
  student has exactly one tutorial row and exactly one seminar row, and changing
  seminar sessions never perturbs tutorial rows (and vice versa).
- Adding/removing a seminar session rebalances seminars with minimal movement and
  leaves tutorials untouched.
- A unit with no seminar sessions has zero seminar allocation rows.
- Assignment defensive capacity check for a seminar uses its allocated group size.
- A zero-enrolment seminar is valid/schedulable with `student_count = 0`.
- Solver snapshot builds seminar candidates (allocated students only) and remains
  deterministic; `SESSION_TYPE_ORDER` places seminars after tutorials.

## Verification checklist

- `SessionType` is `lecture | tutorial | seminar`; migration is applied and
  reversible to the documented degree.
- Seminars allocate one balanced group membership per enrolled student,
  independent of tutorial grouping.
- Tutorial and seminar reconciliation are type-scoped and never cross-mutate.
- No new packages; capacity/solver behaviour changes only by gaining seminar
  data, not by new feasibility rules.
- Backend tests and build pass; `context/architecture-context.md` invariant 1/19
  and `context/project-overview.md` session-type wording are updated to include
  seminars; `context/progress-tracker.md` reflects the completed unit.
