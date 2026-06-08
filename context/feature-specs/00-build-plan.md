# 00 Build Plan

## Build Planning Rules

This build plan follows these implementation rules:

- Each unit produces one visible, testable, or reviewable result.
- Each unit stays within one system boundary: `frontend/`, `backend/`, `backend/solver/`, `backend/constraints/`, `jobs/`, or deployment/config.
- Connections between layers are always handled in separate integration units.
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

## 31. Backend Assignment Persistence and Protected Manual Scheduling API

**System boundary:** `backend/`

**What it builds:**

- Timetable assignment persistence model.
- Assignment service functions.
- Assignment migration.
- Invariant enforcement:
  - scheduled sessions must have day, start slot, and room;
  - unscheduled sessions must not have day, start slot, or room.
- Protected manual scheduling routes:
  - schedule session;
  - move scheduled session;
  - unschedule session;
  - list assignments.
- Room deletion behavior that unschedules affected sessions.

**Visible result:**

Authenticated API calls can schedule, move, unschedule, and list assignments.

**Dependencies required first:**

Units 9 and 25.

---

## 32. Frontend Assignment API Client

**System boundary:** `frontend/`

**What it builds:**

- Assignment API functions.
- Assignment DTO types.
- Schedule/move/unschedule request types.
- Assignment-specific API error parsing.

**Visible result:**

Frontend dev/test calls can schedule, move, unschedule, and list assignments.

**Dependencies required first:**

Units 6, 30, and 31.

---

## 33. Frontend Manual Scheduling Integration

**System boundary:** frontend/backend connection

**What it builds:**

- Select unscheduled session.
- Place selected session into a timetable cell through the backend.
- Move scheduled session through the backend.
- Remove scheduled session back to the unscheduled pool through the backend.
- Refresh assignments and unscheduled pool after mutations.

**Visible result:**

Manual scheduling persists after page refresh.

**Dependencies required first:**

Unit 32.

---

## 34. Frontend Drag-and-Drop Scheduling Shell

**System boundary:** `frontend/`

**What it builds:**

- dnd-kit installed just in time.
- Drag handle behavior.
- Drop target behavior.
- Accessible fallback path retained through manual controls.
- Local drag UI state only, such as active drag item and hovered drop target.
- No fake scheduling data and no invented assignments.

**Visible result:**

Real sessions can be dragged over real timetable cells visually, without persisting drops yet.

**Dependencies required first:**

Unit 33.

---

## 35. Frontend Drag-and-Drop Persistence Integration

**System boundary:** frontend/backend connection

**What it builds:**

- Drop unscheduled session onto grid through assignment API.
- Drag scheduled session to another cell through assignment API.
- Mutation loading state.
- Refetch behavior on failure.

**Visible result:**

Drag-and-drop scheduling persists to the backend.

**Dependencies required first:**

Unit 34.

---

## 36. Frontend Constraint Display Shell

**System boundary:** `frontend/`

**What it builds:**

- Timetable validation status area.
- Violation alert component.
- Invalid session card styling.
- Warning icon treatment.
- Violation details panel or popover.
- Solver blocked message area.

**Visible result:**

The timetable has the full UI surface required to show constraint violations, but shows no fake violations.

**Dependencies required first:**

Unit 35.

---

## 37. Backend Constraint Definitions and Conflict Graph

**System boundary:** `backend/constraints/`

**What it builds:**

- Centralized hard constraint definitions.
- Constraint type enum.
- Constraint severity enum.
- Structured violation object schema.
- Deterministic conflict graph generation.
- Student-overlap conflict derivation.
- Lecturer-overlap conflict derivation.
- Tests using real-format fixtures.

**Visible result:**

Backend tests can generate typed constraint definitions and conflict graphs from real-format fixture data.

**Dependencies required first:**

Units 14, 18, 25, and 31.

---

## 38. Backend Constraint Evaluation Service

**System boundary:** `backend/constraints/`

**What it builds:**

- Lecturer conflict validation.
- Student conflict validation.
- Room conflict validation.
- Room capacity validation.
- Lecturer availability validation.
- Duration boundary validation.
- Lunch crossing validation.
- Structured violation results.

**Visible result:**

Backend tests return structured violations for invalid persisted timetable states.

**Dependencies required first:**

Unit 37.

---

## 39. Backend Constraint Validation API

**System boundary:** `backend/`

**What it builds:**

- Protected current timetable validation endpoint.
- Structured response containing violation list.
- No treatment of unscheduled sessions as violations.

**Visible result:**

Authenticated API calls return authoritative hard constraint violations.

**Dependencies required first:**

Units 4 and 38.

---

## 40. Frontend Constraint API Client

**System boundary:** `frontend/`

**What it builds:**

- Constraint validation API function.
- Violation DTO types.
- Constraint-specific API error parsing.

**Visible result:**

Frontend dev/test calls can fetch current validation results.

**Dependencies required first:**

Units 6, 36, and 39.

---

## 41. Frontend Constraint Validation Integration

**System boundary:** frontend/backend connection

**What it builds:**

- Timetable page fetches backend validation results.
- Invalid scheduled cards are highlighted.
- Violation details are displayed.
- Validation refreshes after schedule, move, unschedule, and drag/drop operations.

**Visible result:**

Invalid placements are allowed but visibly flagged using authoritative backend validation.

**Dependencies required first:**

Unit 40.

---

## 42. Frontend Solver UI Shell and Validation Gating

**System boundary:** `frontend/`

**What it builds:**

- Solver action bar.
- Solver button.
- Disabled state.
- Disabled explanation area.
- Running state display shell.
- Success alert shell.
- Partial-success warning shell.
- Failure alert shell.
- Scheduled/unscheduled count display shell.
- Solver button enabled only when authoritative validation returns no hard violations.

**Visible result:**

The timetable has a complete solver UI shell, and the solver button is gated by real backend validation.

**Dependencies required first:**

Unit 41.

---

## 43. Backend Solver Input Snapshot Builder

**System boundary:** `backend/solver/`

**What it builds:**

- Canonical solver input builder.
- Loads current persisted timetable state.
- Includes rooms, lecturers, students, sessions, assignments, and availability.
- Treats scheduled sessions as locked inputs.
- Treats unscheduled sessions as solver variables.
- Includes conflict graph.
- Tests using real-format fixtures.

**Visible result:**

Backend tests can compile solver input from persisted timetable data.

**Dependencies required first:**

Units 37 and 39.

---

## 44. Solver CP-SAT Module

**System boundary:** `backend/solver/`

**What it builds:**

- OR-Tools installed just in time.
- OR-Tools CP-SAT model.
- Room assignment variables.
- Start-slot variables.
- Locked session fixed constraints.
- Student no-overlap constraints.
- Lecturer no-overlap constraints.
- Room no-overlap constraints.
- Room capacity constraints.
- Lecturer availability constraints.
- Contiguous duration handling.
- Lunch boundary handling.
- Objective to maximize scheduled sessions.

**Visible result:**

Solver tests produce valid schedules from real-format fixture inputs.

**Dependencies required first:**

Unit 43.

---

## 45. Backend Solver Result Application Service

**System boundary:** `backend/solver/`

**What it builds:**

- Applies successful solver assignments.
- Leaves failed sessions unscheduled.
- Preserves locked scheduled sessions.
- Avoids corrupting existing timetable state on failure.
- Returns scheduled count, unscheduled count, and partial-success metadata.

**Visible result:**

Backend tests can apply solver results safely to persisted timetable state.

**Dependencies required first:**

Units 31 and 44.

---

## 46. Jobs Boundary and Trigger.dev Setup

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

Unit 45.

---

## 47. Async Solver Job

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

Unit 46.

---

## 48. Backend Solver Start and Status API

**System boundary:** `backend/`

**What it builds:**

- Protected production solver start endpoint.
- Runs authoritative validation before starting job.
- Rejects solver start if hard violations exist.
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

Units 39 and 47.

---

## 49. Frontend Solver API Client

**System boundary:** `frontend/`

**What it builds:**

- Start solver API function.
- Get solver status API function.
- Solver status DTO types.
- Solver-specific API error parsing.

**Visible result:**

Frontend dev/test calls can start and read solver job status.

**Dependencies required first:**

Units 6, 42, and 48.

---

## 50. Frontend Async Solver Integration

**System boundary:** frontend/backend/jobs connection

**What it builds:**

- Solver UI calls production solver start endpoint.
- Solver UI reads solver status.
- Editing disabled while solver is running.
- Timetable refreshes on completion.
- Partial-success warning displays real counts.
- Failure state displays actionable message.

**Visible result:**

The full async solver flow works from the timetable page.

**Dependencies required first:**

Unit 49.

---

## 51. Backend Observability

**System boundary:** `backend/`

**What it builds:**

- Sentry backend setup.
- Structured exception logging.
- Correlation IDs or job IDs for solver-related logs.
- Safe log payloads.

**Visible result:**

Unexpected backend failures are captured and traceable.

**Dependencies required first:**

Unit 48.

---

## 52. Frontend Error Handling and Observability

**System boundary:** `frontend/`

**What it builds:**

- Consistent loading states.
- Consistent mutation error states.
- Form-level errors.
- Field-level errors.
- Timetable action errors.
- Solver action errors.
- Frontend Sentry setup.
- Error boundary.
- User-facing fallback UI for unexpected frontend crashes.

**Visible result:**

Users see specific, actionable errors, and unexpected frontend failures are captured and displayed gracefully.

**Dependencies required first:**

Unit 50.

---

## 53. Backend Constraint and Solver Test Suite

**System boundary:** `backend/` + `backend/solver/`

**What it builds:**

- Constraint logic tests.
- Conflict graph tests.
- Solver input compilation tests.
- Solver behavior tests.
- Result application tests.
- Required cases:
  - student conflict;
  - lecturer conflict;
  - lecturer unavailable slot;
  - room double-booking;
  - room capacity failure;
  - duration crossing lunch;
  - duration exceeding available block;
  - locked session respected by solver;
  - partial solver result;
  - failed solver run preserves existing timetable state.

**Visible result:**

A backend test command verifies core scheduling correctness.

**Dependencies required first:**

Units 38, 44, 45, and 47.

---

## 54. Frontend Timetable Interaction Test Suite

**System boundary:** `frontend/`

**What it builds:**

- Timetable no-room state tests.
- Room-created grid rendering tests.
- Unscheduled pool tests.
- Manual scheduling UI tests.
- Drag/drop outcome tests where practical.
- Violation display tests.
- Solver blocked/running/success/failure state tests.
- Test fixtures, if used, must match real DTO formats exactly and stay outside production feature state.

**Visible result:**

A frontend test command verifies key timetable UI behavior.

**Dependencies required first:**

Units 50 and 52.

---

## 55. Full V1 Acceptance Flow

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
9. Manually schedule the session.
10. Move the scheduled session.
11. Remove the scheduled session back to the pool.
12. Create an invalid placement.
13. See the violation displayed.
14. See the solver disabled with explanation.
15. Fix the violation.
16. Run the solver.
17. See success or partial-success result.
18. Confirm unscheduled sessions remain visible.

**Visible result:**

The full v1 product works end to end.

**Dependencies required first:**

Units 1-54.

---

## 56. Frontend Deployment to Vercel

**System boundary:** Deployment

**What it builds:**

- Vercel project.
- Production frontend environment variables.
- Production frontend build.
- Deployed frontend URL.

**Visible result:**

The frontend is accessible from a deployed URL.

**Dependencies required first:**

Unit 55.

---

## 57. Backend Deployment to Railway

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

Units 51 and 56.

---

## 58. Trigger.dev Production Wiring

**System boundary:** Deployment + `jobs/`

**What it builds:**

- Trigger.dev production environment.
- Production secrets.
- Deployed solver job worker.
- Production solver job execution test.

**Visible result:**

The deployed app can run solver jobs asynchronously.

**Dependencies required first:**

Units 47, 48, and 57.

---

## 59. Final V1 Scope Guard and Hardening Pass

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
- Confirms invalid states remain visible.
- Confirms solver-blocked states explain why.
- Confirms destructive changes require confirmation where relevant.
- Confirms all styling uses design tokens or Tailwind theme values.

**Visible result:**

The app matches the intended v1 scope and avoids accidental v2 complexity.

**Dependencies required first:**

Units 1-58.
