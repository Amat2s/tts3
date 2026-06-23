# Timetable Excel Export (Units 93–95) Acceptance Flow

Date prepared: 2026-06-21

Use one authenticated admin workspace with at least one saved timetable. For
each step, check exactly one result. This checklist covers the Unit 93 backend
export API and the Unit 94 frontend download UI, verified in Unit 95.

> The export reads **saved** timetable state only. It renders the fixed
> repo-owned Campion template (`backend/export_templates/campion_timetable_export_template.xlsx`)
> in-memory and streams it — no generated file is ever stored. `openpyxl` must be
> installed in the backend deployment image.

## Manual Checklist

1. Sign in. `[ ] PASS  [ ] FAIL`
2. Open `/timetable`. `[ ] PASS  [ ] FAIL`
3. Confirm `Download Timetable` appears in the sticky action bar. `[ ] PASS  [ ] FAIL`
4. Make a manual scheduling change and confirm download is disabled until Save (the disabled button explains "Save timetable changes before downloading."). `[ ] PASS  [ ] FAIL`
5. Save the draft. `[ ] PASS  [ ] FAIL`
6. Click `Download Timetable`. `[ ] PASS  [ ] FAIL`
7. Enter a timetable title. `[ ] PASS  [ ] FAIL`
8. Confirm an `.xlsx` file downloads. `[ ] PASS  [ ] FAIL`
9. Open the file in Excel. `[ ] PASS  [ ] FAIL`
10. Confirm it contains one timetable sheet only. `[ ] PASS  [ ] FAIL`
11. Confirm the title cell uses the entered title. `[ ] PASS  [ ] FAIL`
12. Confirm the version text says `Version 1`. `[ ] PASS  [ ] FAIL`
13. Confirm day headers, room headers, time labels, notes, lunch row, and later evening rows match the template. `[ ] PASS  [ ] FAIL`
14. Confirm class cells visually match the template class styling. `[ ] PASS  [ ] FAIL`
15. Confirm each app slot fills the correct two-row visual band. `[ ] PASS  [ ] FAIL`
16. Confirm multi-slot sessions span the correct rows. `[ ] PASS  [ ] FAIL`
17. Confirm tutorial letters are assigned in timetable order. `[ ] PASS  [ ] FAIL`
18. Confirm lecturer initials appear in class labels. `[ ] PASS  [ ] FAIL`
19. Confirm the lecturer/tutor key is generated from the exported lecturers. `[ ] PASS  [ ] FAIL`
20. Confirm named blocks export as block labels with block styling. `[ ] PASS  [ ] FAIL`
21. Confirm unnamed blocks export as blank styled blocked cells. `[ ] PASS  [ ] FAIL`
22. Confirm block rectangles merge where expected. `[ ] PASS  [ ] FAIL`
23. Confirm unscheduled sessions do not appear. `[ ] PASS  [ ] FAIL`
24. Confirm a saved assignment in a non-template room causes a clear export error (`export_room_not_in_template`, surfaced inside the download dialog). `[ ] PASS  [ ] FAIL`

## Automated Verification

- Backend test suite: PASS — `440 passed` on 2026-06-21 (includes Unit 93 `tests/test_93_timetable_excel_export.py`, 26 export tests: auth-protected route, `.xlsx` content-type/disposition, single-sheet workbook, template static-content preservation, one-slot two-row fill, multi-slot span, fixed day/room/slot mapping, unknown-room failure, label format, tutorial lettering, lecturer key, named/unnamed blocks, block rectangle merging, filename slug, and the no-persistence guarantee).
- Frontend test suite: PASS — `300 passed` across 25 files (includes Unit 94 `lib/api/timetableExport.test.ts` and the `routes/timetable.test.tsx` "Unit 94" download suite). Run with `--no-file-parallelism` for a deterministic pass.
- Frontend production build: PASS — TypeScript (strict `tsc -b`) and Vite build completed. The existing large-chunk warning remains (`919.69 kB`, `269.63 kB` gzip).
- Backend app import smoke: PASS — imported `main.app` with title `TTS3 API`.

## Scope Guard (verified in Unit 95)

The Units 93–95 batch did **not** introduce any of the following:

- browser-side Excel generation (the frontend streams the backend blob via `apiRequestBlob` and only triggers a download; no spreadsheet library is bundled);
- generated-file storage (the workbook is rendered to an in-memory `BytesIO` and streamed; nothing is written to the database or object storage);
- export history or timetable version history;
- custom template upload (the template is a single repo-owned static file, loaded read-only);
- dynamic room-column generation (the day/room/slot mapping is fixed constants, mirrored by `build_template.py`);
- all-rooms timetable blocks;
- student- or lecturer-facing views;
- timetable import;
- CSV import changes;
- solver behavior changes.

The export is saved-state-only and read-only: `generate_timetable_export` loads
saved assignments and blocks, never mutates assignment/block state, and the no-
persistence test asserts unchanged DB row counts and a returned `BytesIO`.
