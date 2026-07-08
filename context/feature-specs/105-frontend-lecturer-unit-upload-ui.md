# Unit 105 Spec: Frontend Lecturer and Unit Upload UI

## Goal

Add a CSV/Excel upload workflow that imports lecturers, units, and teaching-team
memberships through the Unit 104 backend endpoint. The same upload action appears
on **both** the `/units` and `/lecturers` pages and does exactly the same thing.
This mirrors the student upload UI (Unit 91) as sibling feature.

## Design

- System boundary: `frontend/`.
- Use the Unit 104 backend contract (`POST /lecturers/import-csv`,
  `LecturerImportResult`).
- One shared upload component/dialog is reused on both pages — do not duplicate
  the dialog, API call, or summary logic per page. The two pages differ only in
  where the trigger button sits.
- Send the file as multipart `FormData` through the shared authenticated API
  client (`apiRequest`), which already omits the JSON `Content-Type` for
  `FormData`. Do not store file contents in localStorage, Zustand, or blob
  storage.
- Reuse the existing dialog/summary pattern from the students page — do not
  modify protected shadcn primitives.

## Implementation

### API type alignment

Update `frontend/src/lib/api/lecturers.ts`:

- add a `LecturerImportResult` interface mirroring the backend counts
  (`created_lecturers`, `created_units`, `added_team_memberships`,
  `skipped_invalid_rows`, `deduped_rows`);
- add `uploadLecturerCsv(file: File)` posting multipart `FormData` to
  `/lecturers/import-csv`, letting structured backend errors propagate (their
  human message is already on `ApiRequestError.message`), mirroring
  `uploadStudentCsv`.

### Shared upload component

Add one reusable upload component (e.g. `features/lecturers/LecturerUnitUpload.tsx`
or a shared `components/` upload control) that owns the whole flow: the trigger
button, the dialog, the file input, the upload mutation, and the success/error
summary. Both `/units` and `/lecturers` render this same component in their page
header, so the behavior stays identical by construction.

Dialog behavior (mirror the Unit 91 upload dialog):

- explain expected columns:
  `TITLE, LAST NAME, FIRST NAME, AVAILABILITY, UNIT CODE, UNIT NAME`;
- note that `AVAILABILITY` is accepted but not imported yet;
- file input accepts `.csv` and `.xlsx`;
- disable upload until a file is selected;
- show a loading state while uploading;
- show structured backend errors clearly (reuse the error callout styling);
- on success, show an aggregate summary of the returned counts:
  - created lecturers;
  - created units;
  - added team memberships;
  - skipped invalid rows (only when nonzero, matching the students summary's
    treatment of invalid rows);
  - deduped rows (only when nonzero);
- force-remount the native file input after a successful upload so its displayed
  filename clears (same technique as the students dialog).

On successful upload, invalidate:

- `['lecturers']`;
- `['units']`.

The same invalidation runs regardless of which page launched the upload, so both
pages refresh consistently. (Teaching-team membership and unit lists change; no
student allocations are touched by this import, so the schedulable-session /
assignment queries do not need invalidation.)

### Page wiring

- `/units` header: add the shared upload trigger alongside the existing add-unit
  action.
- `/lecturers` header: add the shared upload trigger alongside the existing
  add-lecturer action.

Label the button consistently on both pages (e.g. `Upload lecturers & units`).

### Tests

Add/update frontend tests (mirror `students.test.tsx` upload coverage), and cover
that both pages expose the same working upload:

- the upload trigger appears on both `/units` and `/lecturers`;
- the trigger opens the dialog;
- upload disabled until a file is selected;
- upload sends a multipart request through the API client;
- success summary displays the returned counts;
- invalid/deduped counts appear only when nonzero;
- a structured backend error displays clearly;
- `['lecturers']` and `['units']` invalidate after a successful upload.

## Dependencies

Unit 104. No new frontend dependencies expected.

## Verification checklist

- The upload trigger appears on both `/units` and `/lecturers` and behaves
  identically.
- The dialog states the expected columns and accepted file types (`.csv`,
  `.xlsx`).
- Upload is disabled until a file is selected and shows a loading state.
- Upload posts multipart to the Unit 104 endpoint.
- Success summary is readable and reflects the backend counts.
- `['lecturers']` and `['units']` invalidate after upload from either page.
- The dialog/API/summary logic is not duplicated per page.
- Frontend tests and production build pass.
