# Unit 104 Spec: Backend Lecturer and Unit CSV/Excel Import

## Goal

Add a protected backend bulk-import endpoint that reads a lecturer/unit
spreadsheet and, for each row, ensures the named lecturer exists, ensures the
named unit exists, and adds that lecturer to the unit's teaching team. Return
aggregate counts only.

This is a sibling of the student CSV import (Unit 90) and follows the same
boundary rules: in-memory parse with no blob storage, whole-file rejection for
structural problems, row-level skip-and-count for bad rows, and one atomic
commit.

## Design

- System boundary: `backend/`.
- New service `services/lecturer_import.py`, new protected route
  `POST /lecturers/import-csv` in `api/lecturers.py`, new `LecturerImportResult`
  schema in `schemas/lecturer.py`.
- Reuse existing persistence: `Lecturer`, `Unit`, and the `unit_lecturers`
  teaching-team relationship. No schema/migration changes.
- Accept `.csv` and `.xlsx`. `.xlsx` is read with `openpyxl` (already a
  dependency from Unit 93); other extensions are rejected. Parse in-memory and
  discard — no blob/object storage, no file retention.
- Additive and non-destructive: never delete lecturers, units, or team links, and
  never rename an existing unit or retitle/rename an existing lecturer.

### Expected columns

Header must contain exactly these six logical columns (case- and
spacing-tolerant, matched by name, no extras), using the Unit 90 header
normalization (`trim -> lowercase -> collapse-whitespace`):

```text
TITLE, LAST NAME, FIRST NAME, AVAILABILITY, UNIT CODE, UNIT NAME
```

`AVAILABILITY` must be present in the header but its value is **ignored** in this
unit (availability import is deferred).

## Behaviour

Structural problems reject the whole import with a structured `422` (missing
file, wrong extension, empty file, bad CSV encoding, header not exactly the six
columns). Reuse the Unit 90 error codes/messages.

Per row (ignoring `AVAILABILITY`):

1. **Lecturer** — match an existing lecturer by a normalized
   `(first_name, last_name)` key (case-insensitive, whitespace-collapsed). If
   none, create one. Its `title` maps the CSV `TITLE` to the `LecturerTitle` enum
   (`Mr, Ms, Mrs, Dr, Fr, A/Prof., Prof.`) with tolerant variant matching;
   unrecognized or blank titles fall back to a single documented default
   (`DEFAULT_LECTURER_TITLE = LecturerTitle.MR`). Title/name only affect newly
   created lecturers.
2. **Unit** — match an existing unit by normalized `code` (Unit code contract:
   `AAA999`, trimmed/uppercased, year derived from the code — invariant 24). If
   none, create it with the row's `UNIT NAME`, the derived year level, and an
   **empty student list** (no auto-enrolment, no sessions, so no
   `session_student_allocations` rebalance).
3. **Team membership** — add the lecturer to the unit's `unit_lecturers` team if
   not already present.

Row-level problems skip and count the row without blocking valid rows: blank
first/last name, blank unit name, or a `UNIT CODE` that fails the `AAA999` /
derivable-year contract. `TITLE` is never a reason to skip.

Dedupe `(lecturer, unit)` pairs within the file. On the first appearance of a new
lecturer name or unit code, that first row is authoritative for the created
record; later rows never retitle or rename.

Apply all creations and team additions in one transaction and commit atomically;
roll back and raise a structured `import_failed` (`500`) on unexpected
persistence failure.

### Result schema

`LecturerImportResult` (counts only — never lecturer/unit lists or raw rows):

- `created_lecturers`
- `created_units`
- `added_team_memberships` (excludes links that already existed)
- `skipped_invalid_rows`
- `deduped_rows`

Prefer counts over raw rows/lists in logs.

## Invariants touched

- 18 (teaching team is many-to-many via `unit_lecturers`; session lecturer
  identity is separate — this importer only adds team links, never sets
  `Session.lecturer_id`).
- 24 (unit code `AAA999`, unique, year derived).
- 26 (lecturer titles restricted to the fixed set).
- Boundary parity with 31 (in-memory parse, no blob storage, whole-file vs
  row-level split, aggregate counts only).

## Tests

Mirror `tests/test_90_student_csv_import.py`: auth required; structural rejects
(`422`); `.csv` and `.xlsx` produce identical results; lecturer matched/created by
name; unit matched/created by code (existing name not overwritten); team link
added additively and no-op when already present; invalid rows skipped/counted;
`(lecturer, unit)` dupes deduped/counted; `AVAILABILITY` ignored; title variants
map and unknown/blank falls back; existing titles never changed; atomic rollback;
no allocations rebalanced; result is counts only.

## Dependencies

Units 89-93 complete. Reuses `openpyxl` (Unit 93). No new runtime dependency.

## Follow-ups (out of scope)

- Frontend upload UI on `/lecturers` (Unit 105).
- Availability import from the `AVAILABILITY` column.
- Docs/tracker acceptance pass (update `project-overview.md`,
  `architecture-context.md`, `code-standards.md`, `progress-tracker.md`).
