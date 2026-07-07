# Lecturer Preferences (Units 98–102) Acceptance Flow

Date prepared: 2026-07-07

Use one authenticated admin workspace with at least one room, at least one
lecturer, and some schedulable sessions. For each step, check exactly one result.
This checklist covers the Unit 98 backend persistence + API, the Unit 99 page
shell, the Unit 100 API integration, the Unit 101 solver soft constraint, and the
Unit 103 tab/grid bug fixes, verified together in Unit 102.

> Lecturer preferences are a **soft constraint** — the only one in the v1 solver.
> A preference is stored per `lecturer_id + day + slot + room_id` with one `level`
> (`preferred` or `avoid`); neutral is the absence of a row. Preferences never
> block a manual placement, never gate solver feasibility, and never reduce the
> scheduled-session count — the solver uses them only to break ties. The
> `/preferences` editor is immediate-persist: there is **no** dirty-draft or Save
> step, and the frontend owns the on-screen grid state (the backend just stores
> each click).

## Manual Checklist

1. Sign in and open `/preferences` from the navbar (the right-most tab). `[ ] PASS  [ ] FAIL`
2. Confirm the grid matches the real timetable's day/room/slot layout (Monday–Friday, rooms nested under each day, AM/PM slot rows split by the Lunch/Mass divider) with **no** sessions, cards, or drag/drop. `[ ] PASS  [ ] FAIL`
3. Confirm the selector lists lecturers, and after selecting one the trigger shows the lecturer's **name** (not a raw id). `[ ] PASS  [ ] FAIL`
4. With a lecturer selected, confirm any existing preferences highlight correctly (green `preferred` / red `avoid` chips) and that the Prefer/Avoid legend is visible. `[ ] PASS  [ ] FAIL`
5. Click a neutral cell and confirm it becomes `preferred` (green). `[ ] PASS  [ ] FAIL`
6. Click the same cell again and confirm it becomes `avoid` (red). `[ ] PASS  [ ] FAIL`
7. Click the same cell again and confirm it returns to neutral (empty). `[ ] PASS  [ ] FAIL`
8. Confirm each click persists immediately with no Save button and the cell does not flicker/revert after clicking (frontend owns the grid state). `[ ] PASS  [ ] FAIL`
9. Refresh the page, re-select the lecturer, and confirm the saved preferences persist without any explicit save action. `[ ] PASS  [ ] FAIL`
10. Switch to a different lecturer and confirm only that lecturer's own cells are highlighted (no cross-lecturer bleed). `[ ] PASS  [ ] FAIL`
11. Use the per-day filter to hide a day and confirm the column disappears with no change to saved data; re-show it and confirm the cells return unchanged. `[ ] PASS  [ ] FAIL`
12. Toggle the **Extend** control and confirm the grid widens with a horizontal scrollbar on the grid only (the page itself does not scroll horizontally). `[ ] PASS  [ ] FAIL`
13. On `/timetable`, run the solver and confirm it still schedules the maximum possible number of sessions (preferences never reduce the count). `[ ] PASS  [ ] FAIL`
14. With a `preferred` cell available at no scheduling cost, confirm the solver favours it. `[ ] PASS  [ ] FAIL`
15. With an `avoid` cell and a free alternative, confirm the solver steers away from the `avoid` cell — but confirm that when the only feasible placement is an `avoid` cell, the session is still scheduled there (soft, not hard). `[ ] PASS  [ ] FAIL`

## Scope guard

Confirm this batch did **not** introduce:

- fake/phantom sessions or any new persistent session state;
- hard-constraint behaviour for preferences (they must never block placement or reduce solver feasibility);
- a dirty-draft or explicit-Save step on `/preferences`, or a browser-storage draft for it;
- cross-validation of preference clicks against availability, blocks, or sessions;
- regressions to lecturer availability or timetable-block hard-constraint behaviour;
- any additional soft constraint beyond lecturer preferences.

## Automated evidence (Unit 102 pass, 2026-07-07)

- Backend: **520 passed** (`APP_ENV=ci`, dummy `DATABASE_URL`/`SUPABASE_URL`).
- Frontend: **309 passed across 26 files**.
- Frontend production build: **green** (`931.78 kB` / `272.28 kB` gzip; only the pre-existing large-chunk warning).
- Backend app import smoke: **OK** (`TTS3 API`).
- Alembic heads: **`0015 (head)`** (single linear head; `current` requires a live DB and is not checked here).
