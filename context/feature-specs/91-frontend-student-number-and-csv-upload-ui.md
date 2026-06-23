# Unit 91 Spec: Frontend Student Number and CSV Upload UI

## Goal

Update the students page for the new student-number contract and add a CSV upload workflow for importing current student-unit enrolments.

## Design

- System boundary: `frontend/`.
- Use the Unit 89/90 backend contracts.
- Keep `/students` as the owner of student upload UI.
- Do not store CSV contents in localStorage, Zustand, or blob storage.
- Do not expose hidden tutorial allocations.
- Keep manual student create/edit year level editable; do not derive it from student number in the normal form.
- Use app-level components only; do not modify protected shadcn primitives.

## Implementation

### API type alignment

Update `frontend/src/lib/api/students.ts`:

- add `student_number` to `Student`;
- add required `student_number` to `StudentCreate`;
- add optional `student_number` to `StudentUpdate`;
- add an import response type matching the backend aggregate response;
- add `uploadStudentCsv(file: File)` using the existing authenticated API client with `FormData`.

Ensure the API client does not force JSON headers for multipart uploads.

### Student create/edit UI

Update `/students` form behavior:

- add required `Student number` input;
- validate exactly 8 digits on the frontend;
- show a clear inline error for invalid values;
- keep `year_level` as the existing editable selector/control;
- create/save disabled when student number is invalid;
- edit dialog initializes from the student's existing student number.

Update table and filters:

- add `Student number` column;
- make student number searchable;
- keep existing name/year/unit filters;
- preserve the no-title student model.

### CSV upload action

Add an `Upload student information` button to the students page header.

Dialog behavior:

- explain expected CSV headers:
  `Student number, first name, last name, scheduled unit code, dest census date`;
- explain date format: `dd/mm/yyyy`;
- file input accepts `.csv`;
- disable upload until a file is selected;
- show loading state while uploading;
- show structured backend errors clearly;
- on success, show aggregate summary:
  - created students;
  - updated students;
  - added enrolments;
  - skipped unknown-unit rows;
  - skipped invalid rows if nonzero.

Do not show `skipped_past_census_rows` in the primary summary.

On successful upload, invalidate:

- `['students']`;
- `['units']`;
- `['schedulable-sessions']`;
- `['assignments']`.

This ensures enrolment counts, hidden allocation-derived session counts, and timetable validation data refresh.

### Tests

Add/update frontend tests for:

- student number field appears in create/edit;
- create/save disabled for invalid student number;
- valid student number can be submitted;
- year level remains manually editable and is not derived in the form;
- student table shows student number;
- search matches student number;
- upload button opens dialog;
- upload disabled until file selected;
- upload sends multipart request through API client;
- success summary displays required counts but not past-census count;
- structural backend error displays clearly;
- query invalidations fire after successful upload.

## Dependencies

Units 89 and 90. No new frontend dependencies expected.

## Verification checklist

- Manual student CRUD requires `student_number`.
- Manual year level remains editable.
- Student number appears in the table and search.
- CSV upload button appears on `/students`.
- CSV upload dialog states the required format.
- Upload calls the protected backend endpoint.
- Success summary is readable and excludes past-census count.
- Relevant queries invalidate after upload.
- Frontend tests and production build pass.
