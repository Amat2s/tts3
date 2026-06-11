# 00 Build Plan

## Build Planning Rules

This build plan follows these implementation rules:

- Each unit produces one visible, testable, or reviewable result.
- Each unit stays within one system boundary: `frontend/`, `backend/`, `backend/solver/`, `backend/constraints/`, `jobs/`, or deployment/config.
- Connections between layers are always handled in separate integration units.
- Timetable manual scheduling uses frontend draft state first; backend persistence happens only through an explicit save action.
- User-facing timetable validation is owned by the frontend. Backend checks are defensive only until solver-specific constraint mirroring is introduced.
- Dependencies come first. No unit depends on a feature that has not already been built.
- Security comes before protected functionality. Auth and access control are established before protected API features are built and before connected app pages rely on protected data.
- Backend API routes come before frontend wiring.
- UI shells come before real data wiring.
- UI shells must use blank states, empty states, and structural placeholders only. Do not use mock application state.
- If temporary sample data is absolutely necessary for tests or isolated development, it must:
  - match the real DTO/domain format exactly;
  - live in a clearly named test fixture or dev-only file;
  - be removable without touching production feature code;
  - never become the source of truth for application state.
- Dependencies are introduced just in time. Install a package only in the unit where it first unlocks real behavior.
- Adjacent units that always get done in the same implementation session are merged.
- Units with no standalone visible, testable, or reviewable result are merged with adjacent units.

---

## 1. Repository, Frontend Bootstrap, and UI Foundation

**System boundary:** Project setup + `frontend/`

**What it builds:**

- Root repository structure.
- `frontend/` Vite + React + TypeScript app.
- TailwindCSS setup.
- `globals.css` with project CSS variables from `ui-context.md`.
- shadcn/ui initialization.
- Initial reusable UI components:
  - `Button`
  - `Input`
  - `Card`
  - `Table`
  - `Dialog`
  - `Alert`
  - `Badge`
  - `Select`
  - `Form`
- `.env.example` files.
- Basic README with local run commands.

**Visible result:**

The frontend app runs locally and displays a styled placeholder page using the real project theme.

**Dependencies required first:**

None.

---

## 2. Frontend Route Shell, App Layout, and Login Shell

**System boundary:** `frontend/`

**What it builds:**

- React Router setup.
- Top navigation shell.
- Page layout primitives.
- Placeholder routes:
  - `/timetable`
  - `/rooms`
  - `/lecturers`
  - `/students`
  - `/units`
  - `/login`
- `/login` page layout.
- Sign-in form shell.
- Loading and error display shells.
- Sign-out control location in the app shell.

**Visible result:**

You can navigate between blank app pages and view a complete login screen shell.

**Dependencies required first:**

Unit 1.

---

## 3. Backend Bootstrap, Database, Migrations, and Error Foundation

**System boundary:** `backend/`

**What it builds:**

- FastAPI app entrypoint.
- API router structure.
- Health check route.
- CORS for local frontend.
- Config loading.
- SQLAlchemy 2.0 engine/session setup.
- Database dependency.
- Alembic setup.
- First empty migration.
- Basic structured logging.
- Standard API error response primitives.

**Visible result:**

The backend runs locally, the health endpoint responds, migrations can run, and errors have a consistent base shape.

**Dependencies required first:**

Unit 1.

---

## 4. Backend Supabase Auth Boundary

**System boundary:** `backend/auth/`

**What it builds:**

- Supabase JWT verification.
- Current admin dependency.
- Protected route dependency.
- Auth error response shape.
- A small protected test endpoint or backend test proving unauthenticated requests are rejected.

**Visible result:**

The backend can reject unauthenticated requests before protected app functionality exists.

**Dependencies required first:**

Unit 3.

---

## 5. Frontend Supabase Auth and Protected Route Shell

**System boundary:** `frontend/`

**What it builds:**

- Supabase Auth client.
- Sign-in function.
- Sign-out function.
- Session-loading state.
- Auth hook or context.
- Protected route wrapper.
- Redirect unauthenticated users to `/login`.
- Redirect signed-in users to `/timetable` after login.

**Visible result:**

Users can sign in and sign out, and unauthenticated users cannot access protected frontend routes.

**Dependencies required first:**

Units 2 and 4.

---

## 6. Frontend Authenticated API Base Client

**System boundary:** frontend/backend auth connection

**What it builds:**

- Shared frontend API client foundation.
- Access token attachment for backend requests.
- Base `401` handling.
- Base API error parsing.
- A small authenticated health/test call.

**Visible result:**

Authenticated frontend requests can reach protected backend endpoints.

**Dependencies required first:**

Unit 5.

---

## 7. Frontend Rooms Page Shell

**System boundary:** `frontend/`

**What it builds:**

- `/rooms` page structure.
- Page header.
- Empty room table shell.
- Empty state for no rooms.
- Create room dialog layout.
- Edit room dialog layout.
- Delete confirmation dialog layout.
- Form fields for:
  - room name;
  - capacity;
  - room type.

**Visible result:**

The rooms page is visually complete but displays no room records until real data exists.

**Dependencies required first:**

Unit 5.

---

## 8. Frontend Timetable No-Room and Grid Shell

**System boundary:** `frontend/`

**What it builds:**

- `/timetable` page header.
- Timetable action area shell.
- No-room empty state explaining that rooms must be added before the timetable canvas can render.
- Timetable grid component architecture.
- Monday-Friday day structure.
- Fixed time-slot row structure.
- Lunch divider.
- Blank room-column rendering path.
- Blank cell rendering.
- Grid styling using design tokens.

**Visible result:**

The timetable page correctly shows a no-room state and has a grid shell ready for real room data.

**Dependencies required first:**

Unit 5.

---

## 9. Backend Room Persistence and Protected API

**System boundary:** `backend/`

**What it builds:**

- Room SQLAlchemy model.
- Room Pydantic schemas.
- Room service functions.
- Room migration.
- Protected room CRUD routes:
  - list rooms;
  - create room;
  - update room;
  - delete room.
- Validation for:
  - required name;
  - positive capacity;
  - valid room type.

**Visible result:**

Authenticated API calls can create, list, update, and delete rooms.

**Dependencies required first:**

Unit 4.

---

## 10. Frontend Room API Client

**System boundary:** `frontend/`

**What it builds:**

- Frontend room API functions.
- Room DTO types matching backend response shapes.
- Room-specific API error parsing.

**Visible result:**

A frontend dev/test call can fetch rooms from the protected backend room API.

**Dependencies required first:**

Units 6, 7, and 9.

---

## 11. Frontend Rooms Page Integration

**System boundary:** frontend/backend connection

**What it builds:**

- TanStack Query setup introduced for room server state.
- `/rooms` list connected to real backend data.
- Create room mutation.
- Edit room mutation.
- Delete room mutation.
- Loading, success, and error states for room operations.

**Visible result:**

The rooms page persists real rooms to the database.

**Dependencies required first:**

Unit 10.

---

## 12. Frontend Timetable Room Integration

**System boundary:** frontend/backend connection

**What it builds:**

- Timetable page reads real room data.
- No-room state shown when the database has no rooms.
- Grid renders once at least one real room exists.
- Room columns come from backend room records.

**Visible result:**

Creating a room on `/rooms` causes the timetable canvas to appear on `/timetable`.

**Dependencies required first:**

Units 8 and 11.

---

## 13. Frontend Lecturer Page and Availability Shell

**System boundary:** `frontend/`

**What it builds:**

- `/lecturers` page structure.
- Empty lecturer table shell.
- Empty state.
- Create lecturer dialog or sheet.
- Edit lecturer dialog or sheet.
- Delete confirmation.
- Form fields for:
  - title;
  - first name;
  - last name.
- Availability editor UI.
- Day/time-slot availability controls.
- Blank initial availability state.
- Visual distinction between available and unavailable slots.

**Visible result:**

The lecturer page is visually complete and includes an availability editor, but displays no lecturer records until real data exists.

**Dependencies required first:**

Unit 5.

---

## 14. Backend Lecturer Persistence and Protected API

**System boundary:** `backend/`

**What it builds:**

- Lecturer SQLAlchemy model.
- Lecturer availability persistence model.
- Lecturer Pydantic schemas.
- Lecturer service functions.
- Migration for lecturers and availability.
- Protected lecturer CRUD routes.
- Availability update behavior.
- Structured lecturer validation errors.

**Visible result:**

Authenticated API calls can manage lecturers and availability.

**Dependencies required first:**

Unit 4.

---

## 15. Frontend Lecturer API Client

**System boundary:** `frontend/`

**What it builds:**

- Lecturer API functions.
- Lecturer DTO types.
- Availability DTO types.
- Lecturer-specific API error parsing.

**Visible result:**

A frontend dev/test call can fetch lecturers from the protected backend lecturer API.

**Dependencies required first:**

Units 6, 13, and 14.

---

## 16. Frontend Lecturer Page Integration

**System boundary:** frontend/backend connection

**What it builds:**

- `/lecturers` connected to real backend data.
- Create lecturer mutation.
- Edit lecturer mutation.
- Delete lecturer mutation.
- Availability save behavior.
- Loading and error states.

**Visible result:**

The lecturer page persists real lecturers and availability.

**Dependencies required first:**

Unit 15.

---

## 17. Frontend Student Page Shell

**System boundary:** `frontend/`

**What it builds:**

- `/students` page structure.
- Empty student table shell.
- Empty state.
- Create student dialog.
- Edit student dialog.
- Delete confirmation.
- Form fields for:
  - title;
  - first name;
  - last name;
  - year level.

**Visible result:**

The student page is visually complete but displays no student records until real data exists.

**Dependencies required first:**

Unit 5.

---

## 18. Backend Student Persistence and Protected API

**System boundary:** `backend/`

**What it builds:**

- Student SQLAlchemy model.
- Student Pydantic schemas.
- Student service functions.
- Student migration.
- Protected student CRUD routes.
- Structured validation errors.

**Visible result:**

Authenticated API calls can create, list, update, and delete students.

**Dependencies required first:**

Unit 4.

---

## 19. Frontend Student API Client

**System boundary:** `frontend/`

**What it builds:**

- Student API functions.
- Student DTO types.
- Student-specific API error parsing.

**Visible result:**

A frontend dev/test call can fetch students from the protected backend student API.

**Dependencies required first:**

Units 6, 17, and 18.

---

## 20. Frontend Student Page Integration

**System boundary:** frontend/backend connection

**What it builds:**

- `/students` connected to real backend data.
- Create student mutation.
- Edit student mutation.
- Delete student mutation.
- Loading and error states.

**Visible result:**

The student page persists real students.

**Dependencies required first:**

Unit 19.

---

## 21. Frontend Unit and Session Management Shell

**System boundary:** `frontend/`

**What it builds:**

- `/units` page structure.
- Empty unit list/table shell.
- Empty state.
- Create unit dialog or sheet.
- Edit unit dialog or sheet.
- Delete confirmation.
- Unit fields prepared for:
  - unit id (HIS101);
  - unit name (Ancient History);
  - lecturer selection;
  - student selection.
- Session section inside each unit.
- Add session button.
- Delete session button on each session box.
- Session fields prepared for:
  - session type;
  - duration;

**Visible result:**

The units page has the full unit and session management structure but displays no unit or session records until real data exists.

**Dependencies required first:**

Units 16 and 20.

---

## 22. Backend Unit Persistence and Protected API

**System boundary:** `backend/`

**What it builds:**

- Unit SQLAlchemy model.
- Unit relationship to lecturer.
- Unit/student relationship if unit-level student assignment is used.
- Unit Pydantic schemas.
- Unit service functions.
- Unit migration.
- Protected unit CRUD routes.
- Student assignment behavior for units if needed.
- Structured unit validation errors.

**Visible result:**

Authenticated API calls can create, list, update, and delete units.

**Dependencies required first:**

Units 14 and 18.

---

## 23. Frontend Unit API Client

**System boundary:** `frontend/`

**What it builds:**

- Unit API functions.
- Unit DTO types.
- Unit-specific API error parsing.

**Visible result:**

A frontend dev/test call can fetch units from the protected backend unit API.

**Dependencies required first:**

Units 6, 21, and 22.

---

## 24. Frontend Unit Page Integration

**System boundary:** frontend/backend connection

**What it builds:**

- `/units` connected to real backend unit data.
- Create unit mutation.
- Edit unit mutation.
- Delete unit mutation.
- Lecturer selector connected to real lecturers.
- Student selector connected to real students.

**Visible result:**

The unit page persists real units.

**Dependencies required first:**

Units 16, 20, and 23.

---

## 25. Backend Session Persistence and Protected API

**System boundary:** `backend/`

**What it builds:**

- Session SQLAlchemy model.
- Session relationship to unit.
- Session Pydantic schemas.
- Session service functions.
- Session migration.
- Protected session routes scoped under units where practical:
  - list sessions for a unit;
  - create session for a unit;
  - update session;
  - delete session;
  - list schedulable sessions.
- Session fields:
  - session type;
  - duration.
- Session lecturer/student derivation from the parent unit for v1 scheduling.
- Duration validation.
- Schedulable-session calculation.
- Structured session validation errors.

**Visible result:**

Authenticated API calls can manage sessions under units and list schedulable sessions. Sessions are persisted as child records of units, using session type and duration, without introducing standalone session management routes or dialogs.

**Dependencies required first:**

Unit 22.

---

## 26. Frontend Session API Client

**System boundary:** `frontend/`

**What it builds:**

- Session API functions.
- Session DTO types.
- Schedulable-session DTO types.
- Session create/update request types.
- Session-specific API error parsing.
- API functions for:
  - listing sessions for a unit;
  - creating a session under a unit;
  - updating a session;
  - deleting a session;
  - listing schedulable sessions.
- DTO shape aligned to the Unit 21 inline session model:
  - session id;
  - unit id;
  - session type;
  - duration;
  - inherited/displayed lecturer details where returned;
  - inherited/displayed student count where returned.

**Visible result:**

A frontend dev/test call can fetch, create, update, and delete sessions through the protected backend session API, and can fetch schedulable sessions for the timetable flow.

**Dependencies required first:**

Units 6, 21, 24, and 25.

---

## 27. Frontend Session Management Integration

**System boundary:** frontend/backend connection

**What it builds:**

- Inline session boxes inside each unit connected to real backend session data.
- Add session button creates a new inline session record under the selected unit.
- Session type field connected to backend persistence.
- Duration field connected to backend persistence.
- Delete session button on each session box connected to backend deletion.
- Session updates saved through the backend session API.
- Session list inside each unit fetched from backend data.
- Schedulable status reflects backend response rules.
- Loading and error states for session creation, update, and deletion.

**Visible result:**

Sessions created inside units persist to the backend as inline unit child records. The `/units` page can manage unit sessions without separate session dialogs, and schedulable sessions are ready for the timetable unscheduled-pool phase.

**Dependencies required first:**

Units 24 and 26.

---

## 28. Frontend Unscheduled Pool Shell

**System boundary:** `frontend/`

**What it builds:**

- Unscheduled pool area under the timetable grid.
- Empty state when no schedulable sessions exist.
- Unit grouping layout.
- Session card component prepared for real session data.
- Deterministic unit color assignment logic.

**Visible result:**

The timetable page shows a correct empty unscheduled pool without fake sessions.

**Dependencies required first:**

Unit 12.

---

## 29. Frontend Unscheduled Pool Integration

**System boundary:** frontend/backend connection

**What it builds:**

- Unscheduled pool connected to real schedulable-session API data.
- Grouping by real unit.
- Session cards render real duration, lecturer, and student count.

**Visible result:**

Real schedulable sessions appear in the unscheduled pool.

**Dependencies required first:**

Units 27 and 28.

---

## 30. Frontend Scheduled Session Rendering Shell

**System boundary:** `frontend/`

**What it builds:**

- Scheduled session card component.
- Assignment-based placement rendering path.
- Duration-based vertical span rendering.
- Blank grid remains valid when there are no assignments.

**Visible result:**

The timetable can render scheduled sessions once real assignments exist, but does not invent any assignments.

**Dependencies required first:**

Unit 29.

---

## 31. Backend Saved Timetable Assignment Persistence and Protected Save API

**System boundary:** `backend/`

**What it builds:**

- Timetable assignment persistence model for the latest saved timetable state.
- Assignment service functions.
- Assignment migration.
- Protected assignment routes:
  - list saved assignments;
  - save full assignment set;
  - clear saved assignment set if useful for reset behavior.
- Defensive backend invariants only for impossible persisted states:
  - no room double-booking;
  - room capacity must be sufficient;
  - sessions must not cross lunch;
  - sessions must not run off the timetable;
  - scheduled sessions must have day, start slot, and room.
- Backend save behavior that accepts warning-invalid assignments, including lecturer conflicts, student conflicts, unit/session overlap warnings, and lecturer availability warnings.
- Room deletion behavior that unschedules affected saved assignments.

**Visible result:**

Authenticated API calls can load and save the current timetable assignment set. The backend protects the database from impossible assignment states, but it does not provide user-facing validation or block warning-level conflicts.

**Dependencies required first:**

Units 9 and 25.

---

## 32. Frontend Assignment API Client

**System boundary:** `frontend/`

**What it builds:**

- Assignment DTO types aligned with the backend saved-assignment API.
- API functions for:
  - listing saved assignments;
  - saving the current assignment set;
  - clearing saved assignments if supported.
- Assignment-specific API error parsing.
- Save-response types for successful saves and defensive backend rejections.

**Visible result:**

Frontend dev/test calls can load and save timetable assignments through the protected backend API.

**Dependencies required first:**

Units 6, 30, and 31.

---

## 33. Frontend Timetable Draft Assignment State

**System boundary:** `frontend/`

**What it builds:**

- Frontend draft timetable state for unsaved manual scheduling edits.
- Saved assignment loading from the backend on `/timetable`.
- Draft initialization from saved assignments.
- Dirty/clean state tracking.
- Save timetable button in the timetable action bar.
- Save mutation using the assignment API client.
- Unsaved changes messaging.
- Refresh behavior after successful save.

**Visible result:**

The timetable can load saved assignments, maintain a separate unsaved frontend draft, and save the draft to the database only when the admin clicks the save button.

**Dependencies required first:**

Unit 32.

---

## 34. Frontend Manual Scheduling Controls

**System boundary:** `frontend/`

**What it builds:**

- Select unscheduled session for placement.
- Place selected session into a timetable cell in frontend draft state.
- Move scheduled session within frontend draft state.
- Remove scheduled session back to the unscheduled pool in frontend draft state.
- Update unscheduled pool derivation from draft assignments.
- No immediate backend mutation on each placement, move, or removal.
- Save button remains the only persistence action for manual scheduling edits.

**Visible result:**

Manual scheduling works inside the frontend draft and can be saved explicitly to the backend.

**Dependencies required first:**

Unit 33.

---

## 35. Frontend Blocking Validation Engine

**System boundary:** `frontend/validation`

**What it builds:**

- Central frontend validation module for blocking placement checks.
- Blocking validation result type.
- Pure helper functions for proposed drops and full draft validation.
- Blocking rules:
  - room duplication / room double-booking;
  - room capacity too small;
  - session duration crosses lunch;
  - session duration runs off the timetable.
- Drop prevention behavior for blocking violations.
- Automatic unscheduling behavior when data changes make an existing draft or saved assignment violate a blocking rule.
- Unit tests or fixture-based checks for blocking rules where practical.

**Visible result:**

The frontend prevents impossible placements before they enter the timetable draft and automatically removes sessions from the timetable when changed data makes them impossible to keep scheduled.

**Dependencies required first:**

Units 33 and 34.

---

## 36. Frontend Warning Validation Engine

**System boundary:** `frontend/validation`

**What it builds:**

- Central frontend validation module for warning-level conflicts.
- Warning violation type and severity enum.
- Warning rules:
  - lecturer overlap conflict;
  - student overlap conflict;
  - unit/session overlap conflict where applicable from existing session and unit data;
  - lecturer availability conflict;
  - any other non-blocking hard conflict already represented by current v1 data.
- Full-draft warning evaluation.
- Warning placements are allowed to remain scheduled.
- Solver-blocked flag derived from all blocking and warning issues.

**Visible result:**

The frontend can identify allowed-but-invalid timetable states and produce structured warnings that block solver execution without blocking manual placement.

**Dependencies required first:**

Unit 35.

---

## 37. Frontend Validation Display and Solver Gate Shell

**System boundary:** `frontend/`

**What it builds:**

- Timetable validation status area.
- Blocking rejection feedback for failed drop/place attempts.
- Warning alert component.
- Invalid/warning session card styling.
- Warning icon treatment.
- Violation details panel or popover.
- Solver blocked message area.
- Solver button shell disabled whenever frontend validation has any blocking or warning issue.

**Visible result:**

The timetable clearly distinguishes blocked placement attempts from allowed warning placements, and the solver action area explains why the solver cannot run.

**Dependencies required first:**

Unit 36.

---

## 38. Frontend Drag-and-Drop Scheduling Shell

**System boundary:** `frontend/`

**What it builds:**

- dnd-kit installed just in time.
- Drag unscheduled session cards over timetable cells.
- Drag scheduled session cards to other cells.
- Drag scheduled sessions back to the unscheduled pool if supported by the interaction design.
- Drop target highlighting.
- Local drag UI state only.
- Blocking validation checked before a drop is accepted into the frontend draft.
- Warning validation recalculated after accepted drops.
- Accessible non-drag fallback retained from manual controls.
- No backend mutation on drop.

**Visible result:**

Real sessions can be dragged and scheduled in the frontend draft with immediate blocking/warning validation, without saving until the admin clicks save.

**Dependencies required first:**

Units 34 and 37.

---

## 39. Frontend Drag-and-Drop Save Integration

**System boundary:** frontend/backend connection

**What it builds:**

- Save button persists the current drag/drop-edited draft assignment set.
- Save loading state.
- Save success state.
- Defensive backend save rejection handling for impossible states.
- Refetch saved assignments after successful save.
- Preserve frontend draft safely if save fails.
- No authoritative backend validation display endpoint.

**Visible result:**

The admin can drag sessions locally, review warnings, and explicitly save the timetable draft to the database.

**Dependencies required first:**

Units 32 and 38.

---

## 40. Backend Solver Constraint Mirror

**System boundary:** `backend/constraints/`

**What it builds:**

- Backend constraint definitions that mirror the frontend validation model for solver use.
- Constraint type enum.
- Constraint severity enum using the same concepts as frontend:
  - blocking;
  - warning.
- Conflict graph generation for solver input.
- Student-overlap conflict derivation.
- Lecturer-overlap conflict derivation.
- Unit/session overlap derivation where applicable.
- Tests using real-format fixtures.
- No user-facing validation API.

**Visible result:**

Backend tests can generate solver-ready constraint structures that match the frontend validation rules, without becoming the source of user-facing validation.

**Dependencies required first:**

Units 14, 18, 25, and 31.

---

## 41. Backend Solver Input Snapshot Builder

**System boundary:** `backend/solver/`

**What it builds:**

- Canonical solver input builder.
- Loads current saved timetable state.
- Includes rooms, lecturers, students, units, sessions, saved assignments, and availability.
- Treats saved scheduled sessions as locked inputs if they have no current frontend-resolved issues when the solver is started.
- Treats unscheduled sessions as solver variables.
- Includes backend constraint mirror and conflict graph.
- Tests using real-format fixtures.

**Visible result:**

Backend tests can compile solver input from saved timetable data and mirrored constraints.

**Dependencies required first:**

Unit 40.

---

## 42. Solver CP-SAT Module

**System boundary:** `backend/solver/`

**What it builds:**

- OR-Tools installed just in time.
- OR-Tools CP-SAT model.
- Room assignment variables.
- Start-slot variables.
- Locked saved-assignment fixed constraints.
- Student no-overlap constraints.
- Lecturer no-overlap constraints.
- Unit/session overlap constraints where applicable.
- Room no-overlap constraints.
- Room capacity constraints.
- Lecturer availability constraints.
- Contiguous duration handling.
- Lunch boundary handling.
- Objective to maximize the number of scheduled sessions.

**Visible result:**

Solver tests produce valid schedules from real-format fixture inputs.

**Dependencies required first:**

Unit 41.

---

## 43. Backend Solver Result Application Service

**System boundary:** `backend/solver/`

**What it builds:**

- Applies successful solver assignments to saved timetable state.
- Leaves failed sessions unscheduled.
- Preserves locked scheduled sessions.
- Avoids corrupting existing timetable state on failure.
- Returns scheduled count, unscheduled count, and partial-success metadata.

**Visible result:**

Backend tests can apply solver results safely to persisted timetable state.

**Dependencies required first:**

Units 31 and 42.

---

## 44. Jobs Boundary and Trigger.dev Setup

**System boundary:** `jobs/`

**What it builds:**

- Trigger.dev installed just in time.
- Trigger.dev setup.
- Basic job registration.
- Environment wiring.
- Basic job logging.
- No solver business logic inside the job definition.

**Visible result:**

A minimal Trigger.dev job can run and log completion.

**Dependencies required first:**

Unit 43.

---

## 45. Async Solver Job

**System boundary:** `jobs/`

**What it builds:**

- Trigger.dev solver job.
- Receives solver input reference or snapshot reference.
- Calls backend solver service.
- Applies result through backend-controlled logic.
- Logs start, completion, failure, duration, scheduled count, and unscheduled count.
- Leaves existing timetable unchanged on failure.

**Visible result:**

The solver can run asynchronously outside request handlers.

**Dependencies required first:**

Unit 44.

---

## 46. Backend Solver Start and Status API

**System boundary:** `backend/`

**What it builds:**

- Protected production solver start endpoint.
- Starts only from saved timetable state.
- Assumes the frontend has already blocked solver execution when validation issues exist.
- Performs defensive backend checks before starting the job to protect solver integrity.
- Triggers async solver job.
- Returns job/status identifier.
- Protected solver status endpoint.
- Status values:
  - pending;
  - running;
  - succeeded;
  - failed.
- Scheduled count.
- Unscheduled count.
- Partial-success metadata.
- Failure message shape.

**Visible result:**

Authenticated API calls can safely start an async solver run and read its status.

**Dependencies required first:**

Units 40 and 45.

---

## 47. Frontend Solver API Client

**System boundary:** `frontend/`

**What it builds:**

- Start solver API function.
- Get solver status API function.
- Solver status DTO types.
- Solver-specific API error parsing.

**Visible result:**

Frontend dev/test calls can start and read solver job status.

**Dependencies required first:**

Units 6, 37, and 46.

---

## 48. Frontend Async Solver Integration

**System boundary:** frontend/backend/jobs connection

**What it builds:**

- Solver UI calls production solver start endpoint only when the frontend validation engine reports no blocking or warning issues.
- Solver UI reads solver status.
- Editing disabled while solver is running.
- Timetable refreshes on completion.
- Partial-success warning displays real counts.
- Failure state displays actionable message.
- Solver result updates the saved assignment state and resets the frontend draft from the latest saved data.

**Visible result:**

The full async solver flow works from the timetable page while preserving frontend-owned user-facing validation.

**Dependencies required first:**

Unit 47.

---

## 49. Backend Observability

**System boundary:** `backend/`

**What it builds:**

- Sentry backend setup.
- Structured exception logging.
- Correlation IDs or job IDs for solver-related logs.
- Safe log payloads.

**Visible result:**

Unexpected backend failures are captured and traceable.

**Dependencies required first:**

Unit 46.

---

## 50. Frontend Error Handling and Observability

**System boundary:** `frontend/`

**What it builds:**

- Consistent loading states.
- Consistent mutation error states.
- Form-level errors.
- Field-level errors.
- Timetable action errors.
- Save errors.
- Solver action errors.
- Frontend Sentry setup.
- Error boundary.
- User-facing fallback UI for unexpected frontend crashes.

**Visible result:**

Users see specific, actionable errors, and unexpected frontend failures are captured and displayed gracefully.

**Dependencies required first:**

Unit 48.

---

## 51. Backend Constraint and Solver Test Suite

**System boundary:** `backend/` + `backend/solver/`

**What it builds:**

- Backend constraint mirror tests.
- Conflict graph tests.
- Solver input compilation tests.
- Solver behavior tests.
- Result application tests.
- Required cases:
  - student conflict;
  - lecturer conflict;
  - lecturer unavailable slot;
  - unit/session overlap;
  - room double-booking;
  - room capacity failure;
  - duration crossing lunch;
  - duration exceeding available block;
  - locked session respected by solver;
  - partial solver result;
  - failed solver run preserves existing timetable state.

**Visible result:**

A backend test command verifies solver-side scheduling correctness.

**Dependencies required first:**

Units 40, 42, 43, and 45.

---

## 52. Frontend Timetable Validation and Interaction Test Suite

**System boundary:** `frontend/`

**What it builds:**

- Timetable no-room state tests.
- Room-created grid rendering tests.
- Unscheduled pool tests.
- Manual scheduling draft-state tests.
- Blocking validation tests.
- Warning validation tests.
- Automatic unscheduling tests for data changes that violate blocking rules.
- Drag/drop outcome tests where practical.
- Save button tests.
- Solver blocked/running/success/failure state tests.
- Test fixtures, if used, must match real DTO formats exactly and stay outside production feature state.

**Visible result:**

A frontend test command verifies key timetable UI, validation, save, and solver-gating behavior.

**Dependencies required first:**

Units 48 and 50.

---

## 53. Full V1 Acceptance Flow

**System boundary:** Full app verification

**What it builds:**

A complete manual acceptance pass:

1. Sign in.
2. Create a room.
3. See timetable canvas appear.
4. Create a lecturer with availability.
5. Create a student.
6. Create a unit.
7. Create a session.
8. See the session appear in the unscheduled pool.
9. Manually schedule the session in the frontend draft.
10. Save the timetable draft.
11. Refresh and confirm saved assignment persists.
12. Move the scheduled session in the draft.
13. Remove the scheduled session back to the pool.
14. Attempt a blocked placement and confirm it is rejected.
15. Create an allowed warning placement.
16. See the warning displayed.
17. See the solver disabled with explanation.
18. Fix the warning.
19. Save the valid timetable.
20. Run the solver.
21. See success or partial-success result.
22. Confirm unscheduled sessions remain visible.

**Visible result:**

The full v1 product works end to end.

**Dependencies required first:**

Units 1-52.

---

## 54. Frontend Deployment to Vercel

**System boundary:** Deployment

**What it builds:**

- Vercel project.
- Production frontend environment variables.
- Production frontend build.
- Deployed frontend URL.

**Visible result:**

The frontend is accessible from a deployed URL.

**Dependencies required first:**

Unit 53.

---

## 55. Backend Deployment to Railway

**System boundary:** Deployment

**What it builds:**

- Railway backend service.
- Production backend environment variables.
- Supabase connection.
- Alembic migration command.
- Production CORS.

**Visible result:**

The deployed frontend can call the deployed backend.

**Dependencies required first:**

Units 49 and 54.

---

## 56. Trigger.dev Production Wiring

**System boundary:** Deployment + `jobs/`

**What it builds:**

- Trigger.dev production environment.
- Production secrets.
- Deployed solver job worker.
- Production solver job execution test.

**Visible result:**

The deployed app can run solver jobs asynchronously.

**Dependencies required first:**

Units 45, 46, and 55.

---

## 57. Final V1 Scope Guard and Hardening Pass

**System boundary:** Full app verification

**What it builds:**

- Confirms no blob storage is introduced.
- Confirms no Redis/caching infrastructure is introduced.
- Confirms no soft constraints are introduced.
- Confirms no student-facing views are introduced.
- Confirms no lecturer-facing views are introduced.
- Confirms no multi-admin collaboration is introduced.
- Confirms no timetable version history is introduced.
- Confirms no user-defined constraint rules are introduced.
- Confirms frontend owns all user-facing validation.
- Confirms blocked placements are rejected immediately.
- Confirms warning placements remain visible and block the solver.
- Confirms solver-blocked states explain why.
- Confirms timetable edits persist only through explicit save.
- Confirms destructive changes require confirmation where relevant.
- Confirms all styling uses design tokens or Tailwind theme values.

**Visible result:**

The app matches the intended v1 scope and avoids accidental v2 complexity.

**Dependencies required first:**

Units 1-56.
