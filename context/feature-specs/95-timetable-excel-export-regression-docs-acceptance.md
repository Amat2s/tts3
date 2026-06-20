# Unit 95 Spec: Timetable Excel Export Regression, Docs, and Acceptance Pass

## Goal

Verify the timetable Excel export batch and update docs/progress so the implemented export behavior is recorded accurately. This unit is a regression and documentation pass only unless defects from Units 93-94 are found.

## Design

- Full-app verification unit.
- Do not add new export features unless fixing a defect from Units 93-94.
- Confirm the export preserves the template layout and styling.
- Confirm export remains saved-state-only.
- Confirm no generated export files are stored.
- Confirm the export does not introduce broad import/export infrastructure beyond this `.xlsx` download.

## Implementation

### Documentation updates

Update relevant context files:

- `project-overview.md`:
  - saved timetable can be downloaded as Excel;
  - export uses a fixed Campion timetable template;
  - export is saved-state-only;
  - dirty drafts must be saved before download.
- `architecture-context.md`:
  - static Excel template file in backend repo;
  - backend-generated streamed export;
  - no persisted export history/blob storage;
  - fixed room/template mapping.
- `code-standards.md`:
  - Excel export service location;
  - binary download route expectations;
  - template mapping constants;
  - no browser-side workbook generation.
- `progress-tracker.md`:
  - Unit 93 and 94 completion notes;
  - Unit 95 final evidence;
  - manual follow-ups.
- `ui-context.md` only if new action-bar visual rules are introduced.

### Backend regression

Run backend tests and verify:

- export route is protected;
- export streams a valid `.xlsx`;
- template sheet layout is preserved;
- one-slot sessions fill two rows;
- multi-slot sessions span expected visual bands;
- classes use template class styling;
- named/unnamed timetable blocks export correctly;
- block rectangles merge correctly;
- room not in template fails clearly;
- tutorial letters are deterministic;
- lecturer key is generated correctly;
- generated files are not persisted.

### Frontend regression

Run frontend tests/build and verify:

- `Download Timetable` appears in the sticky timetable action bar;
- the button is disabled while the draft is dirty;
- the button is disabled while save/solver/data error states make export unsafe;
- dialog title is required;
- successful export triggers a blob download;
- export errors remain visible and do not alter timetable state;
- warning conflicts and unscheduled sessions do not block export.

### Manual acceptance checklist

Create or update a docs checklist covering:

1. Sign in.
2. Open `/timetable`.
3. Confirm `Download Timetable` appears in the sticky action bar.
4. Make a manual scheduling change and confirm download is disabled until Save.
5. Save the draft.
6. Click `Download Timetable`.
7. Enter a timetable title.
8. Confirm an `.xlsx` file downloads.
9. Open the file in Excel.
10. Confirm it contains one timetable sheet only.
11. Confirm title cell uses the entered title.
12. Confirm version text says `Version 1`.
13. Confirm day headers, room headers, time labels, notes, lunch row, and later evening rows match the template.
14. Confirm class cells visually match the template class styling.
15. Confirm each app slot fills the correct two-row visual band.
16. Confirm multi-slot sessions span the correct rows.
17. Confirm tutorial letters are assigned in timetable order.
18. Confirm lecturer initials appear in class labels.
19. Confirm lecturer/tutor key is generated from exported lecturers.
20. Confirm named blocks export as block labels with block styling.
21. Confirm unnamed blocks export as blank styled blocked cells.
22. Confirm block rectangles merge where expected.
23. Confirm unscheduled sessions do not appear.
24. Confirm a saved assignment in a non-template room causes a clear export error.

### Scope guard

Confirm this batch did not introduce:

- browser-side Excel generation;
- generated-file storage;
- export history/version history;
- custom template upload;
- dynamic room-column generation;
- all-rooms timetable blocks;
- student/lecturer-facing views;
- timetable import;
- CSV import changes;
- solver behavior changes.

## Dependencies

- Units 93-94.

No new dependencies beyond Unit 93.

## Verification checklist

- Backend tests pass.
- Frontend tests pass.
- Frontend production build passes.
- Exported workbook opens successfully in Excel.
- Exported workbook visually matches the template layout.
- Export is saved-state-only.
- Dirty draft gating works.
- Documentation is updated.
- Manual checklist exists.
