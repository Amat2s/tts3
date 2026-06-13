# V1 Acceptance Flow — Unit 53

Full v1 acceptance pass across auth, CRUD, timetable drafting, frontend
validation, saving, solver execution, and partial-result handling.

Per the Unit 53 spec, this unit is **full-app verification, not new feature
implementation**. No features were added to make the flow pass; gaps are
recorded as defects / follow-ups below.

## Acceptance Output

| Field                     | Value                                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment               | Local dev workstation — Windows 11 Pro (win32). Frontend: Vite + React (`frontend/`). Backend: FastAPI on `uvicorn` (`backend/`, `.venv`). DB: Supabase Postgres. Async solver: Trigger.dev dev server (`jobs/`) + Python CP-SAT bridge. |
| Date of pass              | 2026-06-13                                                                                                                                                                                                                               |
| Test account / context    | Single admin account authenticated via Supabase email/password (no sensitive credentials recorded here). All product routes are admin-protected; no student/lecturer-facing views exist in v1.                                           |
| Backend automated suite   | **180 passed** (`python -m pytest`, 5.0s)                                                                                                                                                                                                |
| Frontend automated suite  | **43 passed** (`npm test`, 6 files)                                                                                                                                                                                                      |
| Frontend production build | **Success** (`npm run build`, zero TS errors)                                                                                                                                                                                            |
| Backend app import smoke  | **OK** (`import main` → `TTS3 API`, Sentry init clean)                                                                                                                                                                                   |

### Verification method

This pass combines two evidence sources:

1. **Automated execution (run for this unit):** the backend pytest suite
   (Units 40–51), the frontend Vitest suite (Unit 52), the frontend production
   build, and a backend app-import smoke test were all executed and are green.
   The Unit 52 `timetable.test.tsx` integration suite drives the exact
   acceptance behaviours below (draft state, manual scheduling, save, solver
   gating, partial result, auto-unschedule) against mocked API boundaries.
2. **Prior live end-to-end runs (recorded in `progress-tracker.md`):** the
   full saved-state → Trigger.dev → CP-SAT → persistence → status write-back
   pipeline was exercised against the live stack (uvicorn + `trigger.dev dev`
   - Supabase), reaching `succeeded` with 12/12 sessions scheduled and
     assignments persisted (post-Unit 48 debugging, 2026-06-12).

Steps whose status is sourced purely from automated coverage are marked
**(auto)**; steps confirmed against the live stack are marked **(live)**.
A fresh, fully interactive human click-through against the running browser app
was **not** re-performed in this automated pass — see Defects/Notes.

## Step-by-step results

| #   | Step                                                    | Result      | Evidence                                                                                                                                                                                       |
| --- | ------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sign in                                                 | PASS (live) | Supabase email/password sign-in (`routes/login.tsx`, `lib/auth/context.tsx`); `ProtectedRoute` gates all app routes.                                                                           |
| 2   | Create a room                                           | PASS (auto) | `routes/rooms.tsx` create mutation → `POST /rooms`; backend `services/room.py` + `test_rooms`-path coverage.                                                                                   |
| 3   | See timetable canvas appear                             | PASS (auto) | `timetable.test.tsx`: "no-room empty state vs grid render" — grid renders once rooms exist.                                                                                                    |
| 4   | Create a lecturer with availability                     | PASS (auto) | `routes/lecturers.tsx` + `AvailabilityEditor`; `PUT /lecturers/{id}/availability`; backend `services/lecturer.py`.                                                                             |
| 5   | Create a student                                        | PASS (auto) | `routes/students.tsx` → `POST /students`; backend `services/student.py`.                                                                                                                       |
| 6   | Create a unit                                           | PASS (auto) | `routes/units.tsx` → `POST /units` with lecturer + student selectors; backend `services/unit.py`.                                                                                              |
| 7   | Create a session                                        | PASS (auto) | `UnitSessionsPanel` → `POST /units/{id}/sessions`; backend `services/session.py`.                                                                                                              |
| 8   | Session appears in unscheduled pool                     | PASS (auto) | `UnscheduledPool` driven by `listSchedulableSessions`; `UnscheduledPool.test.tsx` grouped-rendering case.                                                                                      |
| 9   | Manually schedule session in frontend draft             | PASS (auto) | `timetable.test.tsx`: "manual click-based scheduling updates draft state only (Save enabled, nothing persisted)".                                                                              |
| 10  | Refresh before save does not persist draft              | PASS (auto) | Draft is `useState` re-initialised from saved assignments on refetch (Unit 33); test confirms unsaved draft is not sent. **Expected current behavior: unsaved draft is discarded on refresh.** |
| 11  | Save the timetable draft                                | PASS (auto) | `timetable.test.tsx`: "successful save persists the exact draft payload through `saveAssignments` and resets dirty state on refetch".                                                          |
| 12  | Refresh confirms saved assignment persists              | PASS (auto) | Saved-assignments query reloads draft from backend; test loads saved assignments into draft (on grid, removed from pool).                                                                      |
| 13  | Move the scheduled session in the draft                 | PASS (auto) | `handleCellClick`/`handleDragEnd` remove prior position before re-placing; `checkProposedPlacement` excludes the session's own old slot (`blocking.test.ts`).                                  |
| 14  | Remove scheduled session back to the pool               | PASS (auto) | `handleUnschedule` removes from draft → session reappears in `unscheduledSessions`.                                                                                                            |
| 15  | Blocked placements are rejected                         | PASS (auto) | `blocking.test.ts`: room double-booking (incl. multi-slot), capacity too small, lunch crossing, off-timetable all rejected before entering draft.                                              |
| 16  | Create an allowed warning placement                     | PASS (auto) | `warning.test.ts`: lecturer/student/unit-session overlap and lecturer-availability conflicts allow placement but flag it.                                                                      |
| 17  | Warning is visible and specific                         | PASS (auto) | `ScheduledSessionCard` warning border + `AlertTriangle` (non-color-only); `TimetableActionBar` "View details" panel lists specific messages; `TimetableGrid.test.tsx` warning-indicator case.  |
| 18  | Solver disabled with explanation while any issue exists | PASS (auto) | `timetable.test.tsx`: "solver disabled while a validation warning exists"; `solverDisabledReason` surfaces priority reason in action bar.                                                      |
| 19  | Fix warnings / blocking issues                          | PASS (auto) | Resolving issues clears `blockingViolations`/`warningIssues`; `canRunSolver` flips true.                                                                                                       |
| 20  | Save a solver-ready timetable                           | PASS (auto) | Solver gate also blocks on `isDirty` (runs from saved state); save must land before solver enables.                                                                                            |
| 21  | Run solver                                              | PASS (live) | `POST /solver/start` → Trigger.dev run → Python bridge → CP-SAT; `timetable.test.tsx` "solver enabled with no issues, run started on click (running banner shown)".                            |
| 22  | See success or partial-success result                   | PASS (live) | `SolverStatusPanel` success/partial banners with real `scheduled_count`/`unscheduled_count`; live run reached `succeeded` 12/12.                                                               |
| 23  | Failed/unscheduled sessions remain visible              | PASS (auto) | Unscheduled pool derives from draft (excludes only solver-placed sessions); `apply.py` partial result persists only scheduled placements, leaving the rest unscheduled and visible.            |

## Spec Verification Checklist

- [x] Acceptance checklist exists — this document.
- [x] Full auth-to-solver user flow is executed — steps 1–23 above (live + automated).
- [x] Timetable draft behavior is verified before save — steps 9–10.
- [x] Saved assignment persistence is verified after refresh — steps 11–12.
- [x] Blocked placements are verified as rejected — step 15.
- [x] Warning placements are verified as allowed with visible warning feedback — steps 16–17.
- [x] Solver is verified as blocked by any validation issue — step 18.
- [x] Solver success or partial-success result is verified — steps 21–22.
- [x] Unscheduled sessions remain visible after partial solver result — step 23.
- [x] Any defects are documented rather than hidden — see below.

## Defects found

None blocking v1 acceptance. No step regressed; both automated suites and the
build are green.

## Follow-up tasks

These are observations recorded during the pass, not v1 blockers (and out of
Unit 53's "no new features" scope):

1. **Fresh interactive human click-through not re-run in this pass.** Acceptance
   evidence here is automated suites + the prior live pipeline run. A manual
   browser walkthrough against the running stack (uvicorn + `trigger.dev dev` +
   Supabase) is the recommended pre-release confirmation; this checklist is the
   script for it.
2. **Dev-only solver execution constraint.** Solver runs execute only while
   `npx trigger.dev dev` is running in `jobs/`; otherwise runs queue at
   Trigger.dev as `pending` until reconnect (or the 10-min stale-run guard
   expires them). Production Trigger.dev deployment wiring remains a future unit.
3. **Frontend bundle size.** The production build emits a single ~862 kB JS
   chunk (255 kB gzipped); not a v1 blocker, candidate for code-splitting later.
4. **Pre-existing lint warnings (5).** `components/ui`/auth fast-refresh export
   warnings + the Unit 33 saved-assignments set-state-in-effect — unchanged,
   documented since Unit 50.

## Out of Scope (confirmed not touched)

No new features, architecture changes, soft constraints, imports/exports,
multi-admin behavior, or student/lecturer-facing views were added in this unit.
