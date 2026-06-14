# Unit 58 Spec: Backend Year-Level Derivation and Enrollment Sync

## Goal

Add the backend foundation for three-year operation and derived unit year levels. Units should derive their year level from the first integer in the unit code, students should be restricted to years 1–3, and enrollment sync should use the existing `unit_students` relationship rather than introducing a second enrollment model.

## Design

- Keep this unit inside `backend/`.
- Do not change frontend UI in this unit.
- Do not add server-side search/filtering.
- Do not change the solver yet.
- Do not create a new student enrollment table; continue using the existing `unit_students` join table.
- `Unit.year_level` is a stored derived value for consistency, filtering, DTOs, and sync rules.
- The client does not manually send `year_level` for units.
- Unit code parsing rule: find the first digit in the unit code string. That digit must be `1`, `2`, or `3`. Codes without a valid first digit are rejected.
- Student `year_level` must be 1, 2, or 3.
- New students are automatically enrolled in existing units whose derived `year_level` matches the student's `year_level`.
- Unit creation should default to all current students in the derived year only when no explicit student list is supplied. If an explicit list is supplied, respect the list.
- Manual enrollment changes remain allowed through unit updates and later student-side updates.

## Implementation

### Migration

Create the next Alembic migration after the current head.

- Add `year_level` integer column to `units`.
- Backfill `units.year_level` by parsing `units.code`.
- Add a database check constraint requiring `units.year_level IN (1, 2, 3)`.
- Add or update a database check constraint requiring `students.year_level IN (1, 2, 3)`.
- If the migration encounters an existing unit code with no valid first digit in `1..3`, fail loudly rather than guessing.
- If old student rows have year 4/5, allow the migration to fail; there should be no such rows.

### Domain helper

Add a small pure helper, for example in `backend/services/year_level.py` or a similarly appropriate domain module:

- `parse_unit_year_level(code: str) -> int`
- Strip surrounding whitespace before parsing.
- Preserve the existing unit code casing/format behavior unless already normalized elsewhere.
- Raise a structured domain error or service-layer validation error if no valid first digit exists.

### SQLAlchemy model updates

Update `Unit` model:

- Add `year_level` column.
- Keep `code` unique.
- Keep the existing `unit_students` relationship.

Update `Student` model constraints if model-level constraints are present.

### Pydantic schemas

Update unit schemas:

- `UnitCreate` should not accept `year_level` from the client.
- `UnitUpdate` should not accept `year_level` from the client.
- `UnitResponse` should include `year_level`.
- Validate unit code via the parser on create/update.

Update student schemas:

- Enforce `year_level` 1–3.
- Add lightweight enrolled unit summary types if not already available:
  - `id`
  - `code`
  - `name`
  - `year_level`
- `StudentResponse` should include:
  - `units`
  - `unit_count`

### Unit service changes

On create unit:

- Parse `year_level` from `code`.
- If `student_ids` is omitted or `None`, default to all existing students with matching `year_level`.
- If `student_ids` is provided, validate and persist exactly those IDs.

On update unit:

- If `code` changes, recompute and persist `year_level`.
- Do not silently overwrite the unit's student list just because the parsed year changed.
- If `student_ids` is provided, validate and persist exactly those IDs.
- If `student_ids` is omitted, preserve current enrollments.

### Student service changes

On create student:

- Validate year level 1–3.
- Create the student.
- Automatically add the student to all existing units with matching `year_level`.
- Do this in the same transaction as student creation.

On update student:

- Validate year level 1–3.
- Preserve existing enrollments unless a later student-enrollment endpoint or request field explicitly changes them.
- If the year level changes, do not silently remove manual enrollments.

### API behavior

- Existing unit and student CRUD route shapes remain resource-oriented.
- Unit responses include `year_level`.
- Student responses include `unit_count` and enrolled unit summaries.
- Do not add filter query parameters in this unit.

### Query invalidation expectations for later frontend units

Document in comments or spec notes that unit/student mutations affect:

- `['units']`
- `['students']`
- `['schedulable-sessions']`
- `['assignments']` indirectly through validation refresh.

Actual frontend invalidation is handled in later units.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Creating unit `HIS101` stores `year_level = 1`.
- Creating unit `THE203` stores `year_level = 2`.
- Creating unit `PHI3A` stores `year_level = 3`.
- Creating a unit with no digit is rejected.
- Creating a unit whose first digit is 4 or 5 is rejected.
- Creating a year 2 student automatically enrolls them in all existing year 2 units.
- Creating a unit without explicit student IDs enrolls all current students in the derived year.
- Creating a unit with explicit student IDs respects the explicit list.
- Updating unit code recomputes `year_level` but does not silently replace selected students.
- Student year level 4/5 is rejected by API validation and database constraints.
- Student list responses include enrolled unit count.
- Unit list responses include derived year level.
- Backend tests cover parser success/failure, migration expectations where practical, unit create defaults, student create sync, and update preservation.
