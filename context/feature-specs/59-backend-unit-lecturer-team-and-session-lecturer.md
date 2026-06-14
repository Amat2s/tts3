# Unit 59 Spec: Backend Unit Teaching Team and Session-Level Lecturer

## Goal

Change lecturer ownership from one lecturer per unit to a unit teaching team plus one actual lecturer per session. All lecturer conflict, availability, display, schedulability, and later solver behavior must use the session-level lecturer.

## Design

- Keep this unit inside `backend/`.
- Do not change frontend routes in this unit.
- Do not change solver implementation in this unit.
- Do not change tutorial allocation in this unit.
- Replace `Unit.lecturer_id` as the scheduling source with:
  - `unit_lecturers` join table: all lecturers allowed to teach the unit;
  - `Session.lecturer_id`: the lecturer assigned to that session.
- A session lecturer must belong to the parent unit's teaching team.
- A session without a lecturer is not schedulable.
- Existing units migrate their current `lecturer_id` into the teaching team.
- Existing sessions are assigned the existing unit lecturer when available.
- If a unit has only one teaching lecturer, new sessions should default to that lecturer.

## Implementation

### Migration

Create the next Alembic migration.

Steps:

1. Create `unit_lecturers` table:
   - `unit_id` FK to `units.id`, cascade delete;
   - `lecturer_id` FK to `lecturers.id`, cascade delete;
   - unique constraint on `(unit_id, lecturer_id)`.
2. Populate `unit_lecturers` from existing `units.lecturer_id` rows.
3. Add nullable `sessions.lecturer_id` FK to `lecturers.id`.
4. Backfill `sessions.lecturer_id` from the parent unit's existing `lecturer_id`.
5. If every existing session can be backfilled, make `sessions.lecturer_id` non-null.
6. Drop the old `units.lecturer_id` column after backfill and model updates.

If the current schema has `units.lecturer_id` nullable in practice, handle null rows explicitly:

- preserve the unit;
- leave sessions unschedulable until assigned;
- only make `sessions.lecturer_id` nullable if needed.

Prefer non-null if the current v1 invariant guarantees units have lecturers.

### Models

Update `Unit`:

- Remove single `lecturer` relationship.
- Add `lecturers` many-to-many relationship through `unit_lecturers`.
- Keep `students` relationship unchanged.
- Keep `sessions` relationship unchanged.

Update `Session`:

- Add `lecturer_id` FK.
- Add `lecturer` relationship.
- Keep `unit_id`, `session_type`, and `duration` unchanged for now.

### Schemas

Update unit schemas:

- Replace `lecturer_id` with `lecturer_ids` in create/update schemas.
- Require at least one lecturer ID for unit create.
- Unit update should allow replacing the full teaching team.
- `UnitResponse` includes `lecturers: LecturerSummary[]`.
- Keep student summaries and year level from Unit 58.

Update session schemas:

- `SessionCreate` accepts optional `lecturer_id`.
- `SessionUpdate` accepts optional `lecturer_id`.
- `SessionResponse` includes `lecturer` or `lecturer_id` plus display summary.
- `SchedulableSessionResponse` includes:
  - `lecturer_id`
  - `lecturer_display_name`

### Services

Unit create/update:

- Validate every `lecturer_id` exists.
- Persist the teaching team through `unit_lecturers`.
- If removing a lecturer from a unit would leave existing sessions assigned to that lecturer, reject the update with a structured `422` unless the request also reassigns affected sessions through a later explicit session update.
- Do not silently unset session lecturers.

Session create:

- If `lecturer_id` is supplied, validate it belongs to the unit teaching team.
- If `lecturer_id` is omitted and the unit has exactly one teaching lecturer, assign that lecturer automatically.
- If `lecturer_id` is omitted and the unit has multiple teaching lecturers, create the session only if the schema allows incomplete sessions, but it must not appear in schedulable sessions until assigned. Prefer rejecting missing lecturer for create if the current UI always supplies one after Unit 63.

Session update:

- Validate new `lecturer_id` belongs to the parent unit teaching team.
- Changing a session lecturer may create warning conflicts; do not auto-unschedule here unless a blocking assignment rule is violated by other data changes.

Schedulable sessions:

- Exclude sessions without a session-level lecturer.
- Use `session.lecturer`, not `unit.lecturer`, for display and validation DTOs.

Assignments:

- Assignment response should use `session.lecturer` for `lecturer_id`/`lecturer_display_name` once frontend DTOs are updated.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Migration creates `unit_lecturers` and preserves existing unit lecturer assignments.
- Existing sessions are assigned their old unit lecturer where possible.
- Unit create requires at least one teaching lecturer.
- Unit update can replace the teaching team.
- Unit update rejects removing a lecturer who is still assigned to one or more sessions.
- Session create defaults to the only teaching lecturer when exactly one exists.
- Session create/update rejects a lecturer outside the unit teaching team.
- Schedulable sessions use the session lecturer and exclude sessions without one.
- Assignment responses use session lecturer display data.
- Backend tests cover migration-shaped data, validation, defaulting, and schedulable-session behavior.
