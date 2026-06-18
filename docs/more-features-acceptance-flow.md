# More-Features (Units 72–82) Acceptance Flow

Date prepared: 2026-06-18

Use one authenticated admin workspace with the latest Alembic migration
(`0012`) applied. For each step, check exactly one result. This checklist
covers the Units 72–82 "more features" batch verified in Unit 83.

## Manual Checklist

1. Sign in. `[ ] PASS  [ ] FAIL`
2. Open `/units`. `[ ] PASS  [ ] FAIL`
3. Try invalid unit codes (too short, digits first, unknown prefix, year 4+) and confirm create/save is disabled. `[ ] PASS  [ ] FAIL`
4. Enter a valid code such as `HIS101` and confirm the parser display shows class/colour/year. `[ ] PASS  [ ] FAIL`
5. Confirm unit colours follow the subject prefix. `[ ] PASS  [ ] FAIL`
6. Create/edit a student without a title field. `[ ] PASS  [ ] FAIL`
7. Create/edit lecturers using the final title list (`Mr`, `Ms`, `Mrs`, `Dr`, `Fr`, `A/Prof.`, `Prof.`). `[ ] PASS  [ ] FAIL`
8. Confirm lecturer/student subject filters work from unit relationships. `[ ] PASS  [ ] FAIL`
9. Confirm unscheduled unit boxes are equal width and wrap across the page. `[ ] PASS  [ ] FAIL`
10. Confirm unscheduled search matches unit/lecturer but not `Lecture`/`Tutorial`. `[ ] PASS  [ ] FAIL`
11. Confirm the timetable action bar is sticky and the details overlay does not move layout. `[ ] PASS  [ ] FAIL`
12. Confirm validation details show time labels, not raw slot IDs. `[ ] PASS  [ ] FAIL`
13. Drag a multi-hour session and confirm the preview/hover range matches placement. `[ ] PASS  [ ] FAIL`
14. Hover an invalid placement and confirm no highlight/reason appears before drop. `[ ] PASS  [ ] FAIL`
15. Drop an invalid placement and confirm the sticky bar shows feedback after drop. `[ ] PASS  [ ] FAIL`
16. Leave and return to `/timetable`; confirm the unsaved draft restores. `[ ] PASS  [ ] FAIL`
17. Refresh the page; confirm safe draft restore. `[ ] PASS  [ ] FAIL`
18. Clear all sessions; confirm the warning dialog and draft-only behavior. `[ ] PASS  [ ] FAIL`
19. Save an empty timetable; confirm the request succeeds and the button shows `Saved`. `[ ] PASS  [ ] FAIL`
20. Confirm the lunch row says `Lunch/Mass`. `[ ] PASS  [ ] FAIL`
21. Confirm the navbar says `Campion - Timetable`. `[ ] PASS  [ ] FAIL`
22. Confirm the solver button says `Generate Timetable` and remains blue. `[ ] PASS  [ ] FAIL`

## Automated Verification

- Backend test suite: PASS — `314 passed` on 2026-06-18.
- Frontend test suite: PASS — `222 passed` across 21 files.
- Frontend production build: PASS — TypeScript (strict `tsc -b`) and Vite build completed. The existing large-chunk warning remains (`893.31 kB`, `263.19 kB` gzip).
- Backend app import smoke: PASS — imported `main.app` with title `TTS3 API`.
- Alembic head check: PASS — repository head is `0012`.

## Scope Guard (verified in Unit 83)

The Units 72–82 batch did **not** introduce any of the following:

- backend subject parser or subject storage (the subject/colour parser stays in `frontend/src/lib/unit-code-parser.ts`; `backend/schemas/unit.py` only enforces the structural `AAA999` contract and authoritative year derivation);
- soft constraints (none in `backend/solver` or `backend/constraints`);
- timetable version history;
- file import/export;
- student-facing or lecturer-facing views;
- Redis/cache infrastructure;
- object/blob storage;
- hidden backend mutations on drag/drop (manual placement only updates the frontend draft);
- immediate backend mutation on Clear All (`clearAssignments()` is never called from the timetable route; the empty set persists only through the explicit Save).

## Failure Notes

Record the failing step, observed behavior, expected behavior, and any relevant
request/job ID. Do not include access tokens, database URLs, or student payloads.
