# Student CSV Upload (Units 89–92) Acceptance Flow

Date prepared: 2026-06-20

Use one authenticated admin workspace with the latest Alembic migration
(`0014`) applied. For each step, check exactly one result. This checklist
covers the Units 89–91 student-number and CSV-import batch verified in Unit 92.

> Note: migration `0014` performs a **deliberate destructive reset** of existing
> `students` rows before adding the required `student_number` column. Apply it
> only against a database whose student data is safe to discard.

## Manual Checklist

1. Sign in and open `/students`. `[ ] PASS  [ ] FAIL`
2. Confirm `Student number` appears in the table and in the create/edit forms. `[ ] PASS  [ ] FAIL`
3. Try invalid manual student numbers (letters, fewer/more than 8 digits, spaces); confirm an inline format error shows and create/save stays disabled. `[ ] PASS  [ ] FAIL`
4. Create a manual student with a valid 8-digit student number and a manually chosen year level; confirm the year level is editable and not derived from the number. `[ ] PASS  [ ] FAIL`
5. Search students by student number; confirm the table filters to the match. `[ ] PASS  [ ] FAIL`
6. Click `Upload student information`; confirm the dialog states the expected headers (`Student number, first name, last name, scheduled unit code, dest census date`) and the `dd/mm/yyyy` date format and accepts `.csv` only. `[ ] PASS  [ ] FAIL`
7. Upload a CSV with a wrong, missing, or extra header column; confirm a clear error and that nothing is imported. `[ ] PASS  [ ] FAIL`
8. Upload a valid CSV using `dd/mm/yyyy` census dates; confirm the import succeeds. `[ ] PASS  [ ] FAIL`
9. Include past-census rows (`dest census date` before today, Australia/Sydney); confirm they do **not** import and are not shown in the summary. `[ ] PASS  [ ] FAIL`
10. Include rows whose unit code does not match any existing unit; confirm they are skipped and counted as unknown-unit rows (no unit is created). `[ ] PASS  [ ] FAIL`
11. Confirm new students are created with an initial year level derived from their student number (future cohorts rejected, above 3 capped to 3). `[ ] PASS  [ ] FAIL`
12. Confirm existing students are matched by student number and their first/last names update from the CSV. `[ ] PASS  [ ] FAIL`
13. Confirm an existing student's manually edited year level is **not** overwritten by the import. `[ ] PASS  [ ] FAIL`
14. Confirm a student can be enrolled into multiple matching units from one upload. `[ ] PASS  [ ] FAIL`
15. Confirm duplicate `(student number, unit code)` rows do not create duplicate enrolments. `[ ] PASS  [ ] FAIL`
16. Confirm the upload summary shows created students, updated students, added enrolments, skipped unknown-unit rows, and skipped invalid rows (only when nonzero) but never past-census rows. `[ ] PASS  [ ] FAIL`
17. Confirm unit enrolment counts and session allocation-derived counts refresh after the import (the `/students`, `/units`, schedulable-sessions, and assignments data are invalidated). `[ ] PASS  [ ] FAIL`
18. Open `/timetable` and confirm timetable/session data remains consistent after the upload (no spurious unscheduling, hidden allocations rebalanced). `[ ] PASS  [ ] FAIL`

## Automated Verification

- Backend test suite: PASS — `414 passed` on 2026-06-20 (includes Unit 89 `test_89_student_number_reset_contract.py` and Unit 90 `test_90_student_csv_import.py`).
- Frontend test suite: PASS — `283 passed` across 24 files (includes Unit 91 `lib/api/students.test.ts` and the `routes/students.test.tsx` student-number/upload suites).
- Frontend production build: PASS — TypeScript (strict `tsc -b`) and Vite build completed. The existing large-chunk warning remains (`915.06 kB`, `268.43 kB` gzip).
- Backend app import smoke: PASS — imported `main.app` with title `TTS3 API`.
- Alembic head check: PASS — repository head is `0014`; local DB `current` is also `0014`. Apply `alembic upgrade head` on the deployed database (deliberate destructive student reset — see note above).

## Scope Guard (verified in Unit 92)

The Units 89–92 batch did **not** introduce any of the following:

- CSV file retention (the upload is parsed in-memory and discarded after the request);
- blob/object storage (no Supabase Storage or Vercel Blob usage was added);
- unit creation from CSV (unknown unit codes are skipped and counted; units are only looked up);
- enrolment deletion or a sync/replace mode (import is additive — `student.units.append(...)` only, never a remove);
- student-facing views;
- lecturer-facing views;
- soft constraints;
- timetable version history;
- hidden mutation of timetable assignments during import beyond the normal data-refresh effect (the only write to scheduling data is `rebalance_unit_session_allocations` for units that gained an enrolment; no assignments are added, moved, or removed by the import).
