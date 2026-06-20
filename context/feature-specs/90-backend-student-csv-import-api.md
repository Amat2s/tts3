# Unit 90 Spec: Backend Student CSV Import API

## Goal

Add a protected backend CSV import endpoint that reads student information, filters current rows by census date, creates/updates students by student number, enrols them into matching existing units, and returns aggregate import results.

## Design

- System boundary: `backend/`.
- Use the Unit 89 `student_number` contract.
- Process the uploaded CSV immediately and discard it.
- Do not use blob/object storage.
- Do not create units from CSV rows.
- Do not remove old enrolments; import is additive only.
- Existing students are matched only by `student_number`.
- Existing student names are updated from the CSV.
- Existing student `year_level` is **not** overwritten by CSV import; only newly created students get an initially derived year level.
- Hidden session allocations must be rebalanced for affected units after enrolment changes.

## Implementation

### Route

Add protected route:

```text
POST /students/import-csv
```

Use authenticated admin access. Accept a single uploaded `.csv` file as multipart form data. Add `python-multipart` only if the backend does not already include it.

Reject the whole file for structural errors:

- missing file;
- wrong file extension or unreadable content;
- invalid encoding;
- empty file;
- header row missing or incorrect;
- extra columns beyond the required five after normalization.

### Required CSV columns

The required logical columns are:

```text
Student number, first name, last name, scheduled unit code, dest census date
```

Header matching should be tolerant for case and spacing:

- trim cells;
- lowercase;
- collapse repeated whitespace;
- compare normalized names.

After normalization, the file must contain exactly the five required columns and no extras. If not, return a clear user-facing error explaining the expected header.

### Row parsing rules

For each row:

- trim all fields;
- `student_number` must be exactly 8 digits;
- `first_name` and `last_name` must be non-blank;
- `scheduled_unit_code` is trimmed and uppercased;
- `dest census date` must parse as `dd/mm/yyyy`;
- compare census date to the current date in `Australia/Sydney` using `zoneinfo`;
- rows with census date before today are ignored as non-current;
- rows with invalid values are skipped and counted;
- rows with unknown `scheduled_unit_code` are skipped and counted;
- duplicate `(student_number, unit_code)` pairs are deduped.

Student-number year derivation for newly created students only:

```text
year_level = current_year - first_four_digits + 1
```

Rules:

- reject if derived year is less than 1;
- cap derived year above 3 to 3;
- example in 2026: `20261234 -> 1`, `20251234 -> 2`, `20241234 -> 3`, `20231234 -> 3`, `20271234 -> invalid`.

### Import service

Create a dedicated service/module, for example:

```text
backend/services/student_import.py
```

Service behavior:

- pre-load known units by normalized code;
- pre-load existing students by `student_number`;
- create missing students only for rows with known units;
- update existing student first/last names when changed;
- do not overwrite existing student year levels;
- add missing `unit_students` enrolments;
- do not remove enrolments missing from the CSV;
- collect affected unit IDs and rebalance hidden `session_student_allocations` for those units in the same transaction;
- commit all valid changes together;
- roll back on unexpected persistence failure.

### Response shape

Return an aggregate response such as:

```json
{
  "created_students": 12,
  "updated_students": 3,
  "added_enrolments": 47,
  "skipped_unknown_unit_rows": 2,
  "skipped_invalid_rows": 1,
  "skipped_past_census_rows": 14,
  "deduped_rows": 5
}
```

The API may return `skipped_past_census_rows` for internal/testing visibility, but the frontend should not display it in the primary success summary.

Do not return full student lists or raw CSV row contents.

### Tests

Add backend tests for:

- exact valid header accepted;
- case/spacing header variants accepted;
- missing/wrong/extra headers reject the whole file;
- dd/mm/yyyy parsing;
- past census rows ignored;
- invalid student numbers skipped;
- future student-number cohort rejected;
- new students created with derived initial year;
- existing students matched by student number and names updated;
- existing students keep manually edited year level;
- unknown unit rows skipped and counted;
- duplicate student/unit rows deduped;
- one student can enrol into multiple matching units;
- import is additive and never removes enrolments;
- affected session allocations rebalance after enrolment changes;
- response counts are accurate;
- auth required.

## Dependencies

Unit 89. Add `python-multipart` only if needed for FastAPI file uploads.

## Verification checklist

- CSV files are parsed safely and discarded.
- Structural file errors reject the whole import.
- Row-level errors do not block valid rows.
- Current rows are determined by `dest census date >= today` in Australia/Sydney.
- Unknown unit codes are skipped, not created.
- Existing students update by student number.
- New students receive initial year level from student number.
- Existing student year levels are preserved.
- Enrolments are additive.
- Hidden allocations are rebalanced.
- Backend tests pass.
