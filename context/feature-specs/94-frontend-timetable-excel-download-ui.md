# Unit 94 Spec: Frontend Timetable Excel Download UI

## Goal

Add a frontend download flow for exporting the current saved timetable as an Excel file. The admin clicks `Download Timetable`, enters a timetable title/name in a dialog, and receives the backend-generated `.xlsx` file.

## Design

- System boundary: `frontend/`.
- Export only the current **saved** timetable.
- Do not export the unsaved frontend draft.
- Do not generate Excel files in the browser.
- Keep the button in the sticky timetable action bar.
- Disable export when the saved timetable is not safe to export.
- Use the backend endpoint from Unit 93.
- Do not change scheduling, saving, validation, or solver behavior.
- Do not add blob storage or export history.

## Implementation

### API client

Add a frontend API helper, for example:

```text
frontend/src/lib/api/timetableExport.ts
```

Function:

```ts
exportSavedTimetableExcel(input: { title: string }): Promise<Blob>
```

Rules:

- uses the existing authenticated API client/auth token pattern;
- sends the title as a query param or encoded request value matching the backend route;
- expects an `.xlsx` blob;
- converts structured backend errors into readable messages;
- does not parse the workbook in the browser.

If the existing `apiRequest` helper is JSON-focused, add a small authenticated binary-download helper rather than overloading JSON response parsing.

### Download button placement

Add a `Download Timetable` button to the sticky `TimetableActionBar` beside the save/solver actions.

Disable it when:

- the timetable draft is dirty;
- save is in progress;
- solver is running or starting;
- saved assignments are loading;
- saved assignments failed to load;
- rooms failed to load;
- blocks failed to load;
- an export request is currently running.

Dirty-draft disabled reason:

```text
Save timetable changes before downloading.
```

The button may stay enabled when:

- there are unscheduled sessions;
- saved warning-invalid assignments exist;
- the current saved timetable is partial.

Export represents the saved timetable, not an ideal/complete timetable.

### Dialog

Clicking `Download Timetable` opens a dialog.

Dialog fields:

- title/name input, required;
- helper text explaining that this title appears inside the Excel file;
- primary action: `Download`;
- secondary action: `Cancel`.

Default title suggestion:

```text
Campion Timetable
```

or, if preferred by existing copy:

```text
Semester Timetable
```

Rules:

- trim title before request;
- disable `Download` while title is blank or export is running;
- show backend/export errors inside the dialog;
- keep dialog open on failure;
- close dialog on successful download.

### File download

On successful blob response:

- create an object URL;
- trigger a browser download;
- use filename convention from backend `Content-Disposition` when available;
- fallback filename:

```text
campion-timetable-YYYY-MM-DD.xlsx
```

- revoke object URL after triggering download.

### Action bar messaging

After successful export, show a concise sticky-bar notice such as:

```text
Timetable downloaded.
```

Do not show technical workbook details.

### Tests

Add/update frontend tests for:

- `Download Timetable` appears in sticky action bar;
- button disabled when draft is dirty with clear reason;
- button disabled while saving;
- button disabled while solver is running;
- button disabled when assignment data failed to load;
- button opens title dialog when enabled;
- blank title disables download;
- successful download calls export API with trimmed title;
- successful download triggers a blob download and closes dialog;
- backend error keeps dialog open and shows message;
- unscheduled sessions do not disable export;
- warning-invalid saved assignments do not disable export.

## Dependencies

- Unit 93.
- No new package dependencies expected.

## Verification checklist

- Download button lives in sticky timetable action bar.
- Export is blocked while draft is dirty.
- Export is blocked while save/solver/loading/error states make saved data unsafe.
- Dialog collects a required title/name.
- Frontend downloads the backend `.xlsx` blob.
- Filename uses backend content disposition or date fallback.
- Errors are visible and non-destructive.
- Frontend tests and build pass.
