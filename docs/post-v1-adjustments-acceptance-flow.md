# Post-V1 Adjustments Acceptance Flow

Date prepared: 2026-06-15

Use one authenticated admin workspace with the latest Alembic migration applied. For each step, check exactly one result.

## Manual Checklist

1. Sign in. `[] PASS  [ ] FAIL`
2. Create Year 1, Year 2, and Year 3 students. `[ ] PASS  [ ] FAIL`
3. Create units whose first code digits derive Years 1, 2, and 3. `[ ] PASS  [ ] FAIL`
4. Confirm matching-year students are selected and enrolled by default. `[ ] PASS  [ ] FAIL`
5. Manually remove and add a student from a unit. `[ ] PASS  [ ] FAIL`
6. Confirm the Students page reflects the same enrolment. `[ ] PASS  [ ] FAIL`
7. Add multiple lecturers to a unit teaching team. `[ ] PASS  [ ] FAIL`
8. Create Lecture and Tutorial sessions and assign session lecturers from the teaching team. `[ ] PASS  [ ] FAIL`
9. Confirm the Lecturers page shows taught units read-only. `[ ] PASS  [ ] FAIL`
10. Confirm management search and filter controls work for rooms, students, lecturers, and units. `[ ] PASS  [ ] FAIL`
11. Confirm the unscheduled pool groups sessions into unit boxes. `[ ] PASS  [ ] FAIL`
12. Schedule sessions manually. `[ ] PASS  [ ] FAIL`
13. Confirm room capacity uses the lecture/tutorial allocation size. `[ ] PASS  [ ] FAIL`
14. Confirm lecturer conflict and availability warnings use the session lecturer. `[ ] PASS  [ ] FAIL`
15. Confirm overlapping tutorials warn only when their allocated students overlap. `[ ] PASS  [ ] FAIL`
16. Save the timetable and refresh; confirm assignments remain scheduled. `[ ] PASS  [ ] FAIL`
17. Use Clear All, cancel once, then open it again and confirm. `[ ] PASS  [ ] FAIL`
18. Confirm Clear All changes only the draft until Save. `[ ] PASS  [ ] FAIL`
19. Save the cleared timetable and refresh; confirm it remains cleared. `[ ] PASS  [ ] FAIL`
20. Recreate a valid saved setup and select Generate Timetable. `[ ] PASS  [ ] FAIL`
21. Confirm solver success or partial-success behavior and locked-session preservation. `[ ] PASS  [ ] FAIL`
22. Confirm failed or partially scheduled sessions remain visible in the unscheduled pool. `[ ] PASS  [ ] FAIL`

## Automated Verification

- Backend test suite: PASS - `271 passed` on 2026-06-15. Pytest reported one non-blocking cache write warning for `backend/.pytest_cache`.
- Frontend test suite: PASS - `100 passed` across 14 files.
- Frontend production build: PASS - TypeScript and Vite build completed. The existing large-chunk warning remains (`885.91 kB`, `260.59 kB` gzip).
- Backend app import smoke: PASS - imported `main.app` with title `TTS3 API`.
- Alembic head check: PASS - repository head is `0011`.
- Alembic current check: PASS - configured PostgreSQL database reports `0011 (head)`.

## Failure Notes

Record the failing step, observed behavior, expected behavior, and any relevant request/job ID. Do not include access tokens, database URLs, or student payloads.
