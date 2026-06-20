# Unit 92 Spec: Student Upload Regression, Docs, and Acceptance Pass

## Goal

Verify the full student CSV upload batch and update the project documentation so the new student-number and import behavior is recorded accurately.

## Design

- Full-app regression and documentation pass.
- Do not add new product behavior unless fixing a defect from Units 89-91.
- Confirm this feature does not introduce blob storage, file retention, student-facing views, soft constraints, or timetable version history.

## Implementation

### Documentation updates

Update relevant context files:

- `project-overview.md`:
  - student CSV upload is now in scope;
  - uploaded files are processed immediately and discarded;
  - import is additive;
  - unknown unit codes are skipped;
  - student number is the required institutional identifier.
- `architecture-context.md`:
  - `students.student_number` required unique column;
  - CSV upload route belongs to backend student management;
  - no blob storage/file retention for this import;
  - import writes canonical `unit_students` relationships and refreshes hidden session allocations.
- `code-standards.md`:
  - student import parser/service location;
  - student-number validation contract;
  - CSV header/date rules;
  - logging should prefer counts over raw CSV/student lists.
- `progress-tracker.md`:
  - completion notes for Units 89-91;
  - final Unit 92 evidence;
  - any remaining manual follow-ups.

### Regression coverage

Backend verification should cover:

- destructive student reset migration is explicit;
- student-number CRUD contract;
- CSV structure validation;
- date filtering;
- student-number year derivation for new imported students;
- existing-student name update without year overwrite;
- additive enrolment behavior;
- allocation rebalance;
- auth protection and structured errors.

Frontend verification should cover:

- student-number CRUD UI;
- table/search display;
- upload dialog;
- multipart API client;
- success/error states;
- query invalidation after import.

Run:

- backend tests;
- backend app import smoke;
- frontend tests;
- frontend production build;
- Alembic head/current checks where practical.

### Manual acceptance checklist

Create a docs checklist covering:

1. Sign in and open `/students`.
2. Confirm `Student number` appears in the table and create/edit forms.
3. Try invalid manual student numbers and confirm create/save is disabled.
4. Create a manual student with valid student number and editable year level.
5. Search students by student number.
6. Open `Upload student information`.
7. Try a CSV with wrong/missing/extra headers and confirm a clear error.
8. Upload a valid CSV with `dd/mm/yyyy` census dates.
9. Confirm past-census rows do not import.
10. Confirm unknown unit-code rows are skipped and counted.
11. Confirm new students are created with initial year derived from student number.
12. Confirm existing students match by student number and their names update.
13. Confirm existing students' manually edited year levels are not overwritten.
14. Confirm students can be enrolled into multiple matching units.
15. Confirm duplicate rows do not duplicate enrolments.
16. Confirm upload summary shows created, updated, added enrolments, unknown units, and invalid rows, but not past-census rows.
17. Confirm unit enrolment counts/session allocation-derived counts refresh after import.
18. Confirm timetable/session data remains consistent after upload.

### Scope guard

Confirm this batch did not introduce:

- CSV file retention;
- blob/object storage;
- unit creation from CSV;
- enrolment deletion/sync mode;
- student-facing views;
- lecturer-facing views;
- soft constraints;
- timetable version history;
- hidden mutation of timetable assignments during import beyond normal data refresh effects.

## Dependencies

Units 89-91.

## Verification checklist

- Backend tests pass.
- Frontend tests pass.
- Frontend build passes.
- Alembic head is correct.
- Docs updated.
- Manual checklist exists.
- CSV upload behavior matches the clarified contract.
- No file is stored after import.
