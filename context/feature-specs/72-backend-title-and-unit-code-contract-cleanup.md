# Unit 72 Spec: Backend Title and Unit Code Contract Cleanup

## Goal

Update backend persistence and API contracts for the new title requirements and unit-code structural validation. Student titles are removed completely, lecturer titles are migrated to the new allowed set, and unit codes are defensively validated as unique six-character codes made of three letters followed by three numbers.

## Design

- Keep this unit inside `backend/`.
- This is a backend contract/migration unit only.
- Do not add backend subject parsing, subject labels, subject colours, or UI-derived subject/year parser behavior.
- Preserve the existing unit-code uniqueness invariant.
- Backend should defensively reject structurally invalid unit codes even though the richer subject/year parser remains frontend-only.
- Student title data is removed completely; it is not hidden or retained as an unused field.
- Lecturer title values are normalized to the final product list:
  - `Mr`
  - `Ms`
  - `Mrs`
  - `Dr`
  - `Fr`
  - `A/Prof.`
  - `Prof.`
- Keep route handlers thin; place normalization/validation in schemas and services where appropriate.

## Implementation

### Student title removal

Update the backend student domain:

- Remove the `StudentTitle` enum if it is now unused.
- Remove the `title` column from the `students` model through an Alembic migration.
- Remove `title` from:
  - `StudentCreate`
  - `StudentUpdate`
  - `StudentResponse`
  - student service create/update logic
  - tests/fixtures that construct students.
- Do not return placeholder or empty title fields to preserve old response shapes.
- Treat this as a breaking API change and align frontend in Unit 73.

### Lecturer title migration

Update lecturer title values:

- Replace the current lecturer-title enum values with the final list.
- Create an Alembic migration that safely maps existing database values:
  - `Dr.` → `Dr`
  - `Mr.` → `Mr`
  - `Prof.` → `Prof.`
  - `Ms.` → `Ms`
  - `A/Prof.` → `A/Prof.`
- Add `Mrs` and `Fr` as valid values.
- Remove any unsupported values after migration.
- Keep API response values exactly as the product values above, including punctuation only for `A/Prof.` and `Prof.`.

### Unit-code structural validation

Update backend unit validation:

- Normalize unit codes by trimming and uppercasing before persistence.
- Enforce structural format: `^[A-Z]{3}\d{3}$`.
- Reject any code that is not exactly six characters, three letters followed by three numbers.
- Preserve existing uniqueness checks after normalization.
- Return a clear validation error such as: `Unit code must be three letters followed by three numbers, e.g. HIS101.`
- Do not validate whether the first three letters are one of the frontend subject prefixes in this unit.
- Do not calculate subject colour or subject label in the backend.

### Service behavior

Ensure create/update behavior is consistent:

- Creating a unit with `his101` stores `HIS101`.
- Updating a unit with `phi201` stores `PHI201`.
- Duplicate checks use the normalized value.
- Updating a unit without changing its code should not conflict with itself.
- Invalid code updates must fail before database mutation.

### Tests

Add or update backend tests for:

- student create/list/update responses no longer include `title`;
- student creation no longer accepts title as a required field;
- lecturer title create/update accepts every final value;
- old lecturer title values migrate or normalize as specified where testable;
- invalid unit-code formats are rejected:
  - too short;
  - too long;
  - number before letters;
  - only letters;
  - unsupported punctuation;
  - lower-case input should be normalized, not rejected;
- duplicate unit codes are rejected after normalization.

## Dependencies

No new runtime dependencies expected.

## Verification checklist

- Alembic migration removes the student title column.
- Backend student schemas no longer include `title`.
- Lecturer title enum/schema exposes exactly the final values.
- Existing lecturer values migrate according to the approved mapping.
- Unit code is normalized to uppercase before save.
- Unit code must match `AAA999` structure.
- Unit code uniqueness remains enforced after normalization.
- Backend does not include subject colour/parser logic.
- Backend tests pass.
