# Unit 89 Spec: Backend Student Number Reset and Contract

## Goal

Add `student_number` as the canonical institutional identifier for students while preserving the existing internal student primary key. Existing student records are intentionally deleted so the database starts fresh under the new required student-number contract.

## Design

- System boundary: `backend/`.
- Keep `students.id` as the internal primary key.
- Add `students.student_number` as a separate required unique column.
- This migration is intentionally destructive for existing students only.
- Student year level remains manually editable in normal CRUD.
- Student-number-derived year level is **not** a general student rule; it is used by the CSV upload feature only.
- Do not add CSV upload behavior in this unit.

## Implementation

### Migration

Create the next Alembic migration after `0013`.

The migration should:

- delete all existing `students` rows before adding/enforcing the new required column;
- rely on existing cascades to clear `unit_students` and `session_student_allocations` rows tied to deleted students;
- add `student_number` to `students`;
- enforce `NOT NULL`;
- enforce uniqueness with an index or unique constraint;
- keep the existing `students.id` primary key unchanged;
- keep `year_level` restricted to 1-3.

This is a deliberate reset, not a preservation/backfill migration. Make that explicit in the migration comments and tracker entry.

### Model and schema contract

Update student persistence/API shapes:

- `Student.student_number: str` required;
- `StudentCreate.student_number` required;
- `StudentUpdate.student_number` optional but, when supplied, required to be valid;
- `StudentResponse.student_number` returned;
- uniqueness conflicts return a structured 409-style error.

Validation:

- trim whitespace;
- require exactly 8 digits;
- reject letters, punctuation, spaces inside the number, blank values, and numbers with fewer/more than 8 digits.

### Student service

Update create/update logic:

- normalize and validate `student_number` before persistence;
- reject duplicate student numbers excluding self on update;
- preserve existing student enrolment behavior;
- preserve manual `year_level` create/update behavior;
- do not derive `year_level` from `student_number` here.

### Tests

Add/update backend tests for:

- migration/model contract where practical;
- create requires student number;
- create rejects invalid student numbers;
- create rejects duplicate student number;
- update can change student number;
- update rejects duplicate student number excluding self;
- response includes `student_number`;
- student year level remains manually supplied and editable;
- deleting existing students in the migration is documented/intentional.

## Dependencies

Units 84-88 complete. No new runtime dependencies expected.

## Verification checklist

- Existing student data is intentionally reset by the migration.
- `students.id` remains the primary key.
- `student_number` is required and unique.
- Student CRUD validates `student_number`.
- Student CRUD still allows manual year-level control.
- Hidden allocation and enrolment cascades remain consistent after the reset.
- Backend tests and app import pass.
