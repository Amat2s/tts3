# Timetable Blocks (Units 84–88) Acceptance Flow

Date prepared: 2026-06-20

Use one authenticated admin workspace with the latest Alembic migration
(`0013`) applied. For each step, check exactly one result. This checklist
covers the Units 84–88 timetable blocks batch verified in Unit 88.

## Manual Checklist

1. Sign in and open `/timetable`. `[ ] PASS  [ ] FAIL`
2. Confirm `Add block` appears in the action bar when the timetable draft is clean. `[ ] PASS  [ ] FAIL`
3. Click `Add block`; confirm the grid enters block-selection mode with instructions and `Cancel`/`Create block` controls in the action bar, replacing normal Save/Generate. `[ ] PASS  [ ] FAIL`
4. Select a single cell; confirm it highlights with the block-selection accent styling. `[ ] PASS  [ ] FAIL`
5. Click `Create block` without entering a name; confirm an unnamed block saves and the cell renders grey with a lock icon and no label. `[ ] PASS  [ ] FAIL`
6. Confirm a session cannot be placed into the blocked cell (click or drag); confirm no hover highlight over the blocked target and a feedback message appears after the drop attempt. `[ ] PASS  [ ] FAIL`
7. Click the grey block overlay; confirm the edit dialog opens showing the block cells and allowing name/colour edit or delete. `[ ] PASS  [ ] FAIL`
8. Enter a name and select `Gold`; confirm the block now renders with a lock icon, the name, and gold colouring. `[ ] PASS  [ ] FAIL`
9. Repeat block creation with `Light blue` and `Light pink` named blocks; confirm all three named colours render distinctly. `[ ] PASS  [ ] FAIL`
10. In another room column at the same day/time as a blocked cell, confirm the cell is **not** blocked (blocks are room-specific). `[ ] PASS  [ ] FAIL`
11. Attempt to place a session in the unblocked cell at the same time; confirm it is accepted (no block interference from the adjacent room). `[ ] PASS  [ ] FAIL`
12. Create a block over a saved assignment; confirm the session returns to the unscheduled pool and a success notice mentions the unscheduled session count. `[ ] PASS  [ ] FAIL`
13. Leave `/timetable` and return; if the timetable had a dirty draft, confirm blocks still render correctly and that a restored draft overlapping a block is auto-cleaned. `[ ] PASS  [ ] FAIL`
14. Delete a block; confirm the cell becomes usable (a session can be placed there) and that no sessions are rescheduled automatically. `[ ] PASS  [ ] FAIL`
15. Dirty the timetable draft (add or move a session without saving); confirm the `Add block` button is disabled with a tooltip explaining blocks require saving or discarding first. `[ ] PASS  [ ] FAIL`
16. Confirm blocks do not appear in the unscheduled session pool and are not counted as sessions. `[ ] PASS  [ ] FAIL`
17. Run the solver; confirm generated assignments do not occupy any blocked cell. `[ ] PASS  [ ] FAIL`
18. Create a block that makes one or more sessions impossible to schedule; run the solver; confirm a partial result is shown and the impossible sessions remain in the unscheduled pool. `[ ] PASS  [ ] FAIL`

## Automated Verification

- Backend test suite: PASS — `358 passed` on 2026-06-20.
- Frontend test suite: PASS — `259 passed` across 23 files.
- Frontend production build: PASS — TypeScript (strict `tsc -b`) and Vite build completed. The existing large-chunk warning remains (`908.65 kB`, `266.61 kB` gzip).
- Backend app import smoke: PASS — imported `main.app` with title `TTS3 API`.
- Alembic head check: PASS — repository head is `0013` (local DB at `0012`; apply `alembic upgrade head` on the deployed database).

## Scope Guard (verified in Unit 88)

The Units 84–88 batch did **not** introduce any of the following:

- fake sessions (blocks are not sessions; they never appear in the unscheduled pool or solver variable set);
- all-rooms block abstraction (every block cell is uniquely keyed by `day + slot + room_id`);
- soft constraints (blocks are hard feasibility constraints in frontend, backend save, and solver model);
- timetable version history;
- file import/export;
- student-facing or lecturer-facing views;
- hidden backend mutation on normal drag/drop (block create/update is an explicit admin action through the block CRUD API, not a side-effect of session placement).
