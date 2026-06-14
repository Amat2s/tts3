# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Unit 60 complete — **post-v1 backend: session types and hidden session-student allocations.** Session types are reduced to only `lecture` and `tutorial`, and a hidden, system-owned `session_student_allocations` table now records which students attend which session (lectures include every enrolled unit student; tutorials evenly divide enrolled students, each student in exactly one tutorial). There is no API route to view or edit allocations — they are internal validation/solver data only and the UI must never display tutorial membership. New model `SessionStudentAllocation` (`models/session_allocation.py`; FK→`sessions.id` and `students.id` both cascade-delete, unique `(session_id, student_id)`, indexes on each FK); `Session` gains an `allocations` relationship (`cascade="all, delete-orphan"`, `passive_deletes`) and its `SessionType` enum drops `lab`/`workshop`. New service `services/session_allocation.py` — `rebalance_unit_session_allocations(db, unit_id)` is the sole writer: it reconciles lecture allocations (every enrolled student) and tutorial allocations (deterministic, stable, minimal-movement even split — dedup existing valid placements, place unassigned into the smallest group, then move only the surplus needed to reach base/base+1 group sizes; never truly random) by diffing a computed target membership against existing rows; plus read helpers `allocation_counts` / `allocated_student_ids`. The function flushes within the caller's transaction and does **not** commit (atomicity: data mutation + allocation refresh succeed or fail together). Trigger points wired: `create_unit` (always) and `update_unit` (when `student_ids` changes); `create_student` (rebalances every auto-enrolled matching-year unit) and `delete_student` (captures affected unit ids, then rebalances after cascade removes the student's rows); `create_session` (always), `update_session` (when `session_type` changes), `delete_session` (rebalances the unit so a removed tutorial's students redistribute). Response shapes: `SchedulableSessionResponse` and `AssignmentResponse` now derive `student_count` from allocation rows and expose `allocated_student_ids: list[str]` (internal validation payload only); `list_schedulable_sessions`, `list_assignments`, and `save_assignments` use the new count helpers. Defensive capacity checks in `save_assignments` now use the allocated per-session count (lecture = enrolled unit count, tutorial = allocated group size) instead of total unit enrolment, so a tutorial fits a room sized to its group and zero-student sessions stay valid/schedulable. Migration `0011_session_allocations_and_session_types` (head now `0011`): creates the allocations table (+ unique constraint + both FK indexes), remaps any existing `lab`/`workshop` sessions to `tutorial`, then rebuilds the `sessiontype` Postgres enum down to `lecture`/`tutorial` (rename-aside → recreate → recast-via-text → drop-old). Solver modeling is intentionally unchanged (Unit 68 consumes the allocations later) per spec scope. Tests: new `tests/test_session_allocations.py` (17 tests — enum reduction, lecture allocation incl. zero-student, tutorial exactly-once + even balance + no-tutorials, idempotent/stable rebalance, add-student/add-tutorial minimal movement, remove-tutorial reassignment, student create/delete triggers, session-type-change trigger, schedulable + assignment DTO counts, zero-student schedulability, capacity uses group size). Backend **249 tests green** (17 new). No frontend or new package changes (per spec scope).
- Unit 59 complete — **post-v1 backend: unit teaching team and session-level lecturer.** Lecturer ownership moved from one lecturer per unit to a `unit_lecturers` teaching team plus a per-session `Session.lecturer_id`; all schedulability, display, and conflict sourcing now use the session lecturer. Migration `0010_unit_lecturers_team_and_session_lecturer` (head now `0010`) creates the `unit_lecturers` join table (composite PK ⇒ unique `(unit_id, lecturer_id)`, both FKs cascade), populates it from each `units.lecturer_id`, adds nullable `sessions.lecturer_id` (FK → `lecturers.id`), backfills it from each session's parent-unit lecturer, then drops `units.lecturer_id`. `sessions.lecturer_id` is intentionally left **nullable**: a session may exist without a lecturer (then it is simply not schedulable) — required so the optional-lecturer schema and schedulable-exclusion logic remain meaningful. Models: `Unit` drops `lecturer_id`/`lecturer`, gains a `lecturers` m2m via `unit_lecturers`; `Session` gains `lecturer_id` + `lecturer` relationship (lazy selectin). Schemas: `UnitCreate`/`UnitUpdate` replace `lecturer_id` with `lecturer_ids` (create requires ≥1; update may replace the team, ≥1 if supplied); `UnitResponse` now exposes `lecturers: LecturerSummary[]` (no more single `lecturer`/`lecturer_id`); `SessionCreate`/`SessionUpdate` accept optional `lecturer_id`; `SessionResponse` adds `lecturer_id` + `lecturer: LecturerSummary | None`. Services: `create_unit`/`update_unit` validate every lecturer id and persist the team, and `update_unit` rejects removing a lecturer still assigned to one or more of the unit's sessions with a structured `422` (`lecturer_still_assigned`) instead of silently unsetting; `create_session` resolves the lecturer (explicit ⇒ must be in team; omitted + exactly one team lecturer ⇒ auto-assign; omitted + multiple ⇒ reject `lecturer_required`) and rejects out-of-team lecturers (`lecturer_not_in_team`); `update_session` validates a new lecturer belongs to the team; `list_schedulable_sessions` now filters on `Session.lecturer_id IS NOT NULL` and uses `session.lecturer` for display. Assignment responses (`services/assignment.py`) now source `lecturer_display_name` from `session.lecturer`. The solver snapshot **DB loader** (`solver/snapshot.py`) was mechanically updated to read `session.lecturer_id` per session and skip lecturer-less sessions — the CP-SAT model and the pure `build_snapshot_from_data` builder are unchanged (full session-lecturer solver integration remains scheduled for Unit 68 per its spec). Tests: new `tests/test_unit_team_and_session_lecturer.py` (17 tests — team create/update validation, the removal-guard, session defaulting/membership for create & update, schedulable exclusion + session-lecturer display, assignment display sourcing); existing solver/apply/job/year-level fixtures updated to the new team + session-lecturer shape. Backend **232 tests green** (17 new). No frontend, CP-SAT model, or new package changes (per spec scope).
- Unit 58 complete — **post-v1 backend foundation: derived unit year levels and enrolment sync.** Units now derive a stored `year_level` from the first digit of their code (must be 1/2/3), students are restricted to years 1–3, and new-student/new-unit enrolment is synced through the existing `unit_students` join table (no second enrolment model). New: pure domain helper `backend/services/year_level.py` (`parse_unit_year_level`, `InvalidUnitCodeError`). Model changes: `Unit.year_level` (NOT NULL) + `ck_unit_year_level` check, `Student` gains a `ck_student_year_level` check and a `units` back-relationship over `unit_students`. Schemas: `UnitCreate`/`UnitUpdate` validate the code through the parser and never accept `year_level` from the client (`student_ids` default changed to `None` to distinguish "omitted" from explicit `[]`); `UnitResponse` adds `year_level`; `StudentResponse` adds `units` (new `EnrolledUnitSummary`) and a computed `unit_count`; student year validation tightened from 1–5 to 1–3. Services: `create_unit` derives/stores the year and, when `student_ids` is omitted, defaults to all students in that year (explicit list respected verbatim); `update_unit` recomputes the year on code change without replacing the student list; `create_student` auto-enrols into all matching-year units in the same transaction; `update_student` preserves enrolments (year change never silently drops memberships). Migration `0009_unit_year_level_and_year_constraints` adds the column, backfills by parsing each existing code (fails loudly on an invalid first digit), enforces NOT NULL, and adds both check constraints (head is now `0009`). Query-invalidation expectations for later frontend units documented in `api/units.py`. Tests: new `tests/test_year_level_and_enrolment.py` (parser success/failure, schema validation, unit-create year derivation + default/explicit enrolment, student-create sync, update preservation, DB + schema year constraints, response shapes); existing solver test fixtures updated to set `year_level`. Backend **215 tests green** (30 new). No frontend, solver, or new package changes (per spec scope).
- Unit 57 complete — final v1 scope guard and hardening pass (release-candidate verification). Full-app scope/architecture/UX/safety review only; **no v1 defects were found, so no corrective code changes were required** — the only change in this unit is this tracker update. The Scope Guard Checklist and the Verification Checklist both fully pass, and backend **185 tests**, frontend **43 tests**, and the frontend production build are all green. Result: **hardened v1 release candidate**. (Full breakdown in the Completed section below.)
- Unit 56 in progress — Trigger.dev production wiring for the async solver job. Resolved the production execution gap: a deployed Trigger.dev worker is a Node-only container with no Python/backend/DB, so the local `python -m solver.job_cli` spawn bridge cannot run in production. Added an HTTP execution bridge — the `solver-job` task now calls the deployed backend's new internal endpoint `POST /solver/internal/execute` (authorized by the shared `SOLVER_INTERNAL_TOKEN` as a Bearer token, NOT a Supabase admin JWT; fails closed with 503 when unset, constant-time compare) when `SOLVER_EXECUTE_URL` is set, and falls back to the local Python spawn bridge for dev when it is not. The endpoint runs `run_solver_job`, so all solver business logic and result application stay in the backend; status flows back to the frontend through the existing `SolverRun` row + `GET /solver/status/{id}` polling. Config: `solver_internal_token` in `backend/config.py`; `require_internal_token` dependency in `backend/auth/deps.py`; `SolverExecuteRequest` schema; `execute_solver_run` service. Worker: `jobs/src/trigger/solverJob.ts` refactored into `runViaBackendHttp` / `runViaLocalBridge` / `logFinalResult` with a mode-tagged start log. Docs: new `docs/trigger-dev-deployment.md` (execution model, secrets, manual steps, smoke test, failure-safety, logs, checklist); `docs/railway-deployment.md`, `jobs/README.md`, `jobs/trigger.config.ts`, and both `.env.example` files updated. Verified: backend import smoke, jobs `tsc --noEmit`, and 185 backend tests (5 new for the token guard + execute delegation) all green. Remaining items are manual (create the Trigger.dev production env, generate the shared secret, set `SOLVER_INTERNAL_TOKEN`/`TRIGGER_SECRET_KEY` on Railway and `SOLVER_EXECUTE_URL`/`SOLVER_EXECUTE_TOKEN` on Trigger.dev, `trigger.dev deploy`, run the production smoke + failure-safety checks) and cannot be performed from the repo
- Unit 55 in progress — backend Railway deployment config and documentation prepared in-repo (`backend/railway.json` with Nixpacks build + uvicorn `$PORT` start command + `/health` healthcheck; `docs/railway-deployment.md` covering env vars, the deliberate Alembic migration process, CORS rules, security, manual steps, and the verification checklist); pinned `python-dotenv` in `backend/requirements.txt` because `alembic/env.py` imports it (otherwise production migrations fail in a clean env); backend app import + route smoke (`/health`, `/auth/verify`) and Alembic head (`0008`) re-verified locally. Remaining items are manual (create the Railway service, set Root Directory to `backend`, configure server env vars, deploy, run `alembic upgrade head` deliberately, record the deployed URL, point Vercel `VITE_API_BASE_URL` at it, run health/auth/CORS checks) and cannot be performed from the repo
- Unit 54 in progress — frontend Vercel deployment config and documentation prepared in-repo (`frontend/vercel.json` with Vite build + SPA rewrites; `docs/vercel-deployment.md` covering env vars, security rules, and the verification checklist); production build re-verified green locally. Remaining items are manual (create the Vercel project, set Root Directory to `frontend`, configure public env vars, deploy, record the deployed URL, run the redirect/auth checks) and cannot be performed from the repo
- Unit 53 complete — full v1 acceptance pass executed and documented (`docs/v1-acceptance-flow.md`); all 23 acceptance steps PASS via live pipeline + automated coverage; backend 180 tests, frontend 43 tests, production build, and backend app-import smoke all green; no v1-blocking defects; follow-ups recorded (fresh interactive click-through, production Trigger.dev deploy, bundle code-splitting, pre-existing lint warnings)
- Unit 52 complete — frontend timetable validation and interaction test suite (Vitest + React Testing Library; pure validation-helper tests, presentational component tests, and a TimetablePage integration suite covering draft state, manual scheduling, save behavior, solver gating, and automatic unscheduling; 43 frontend tests)
- Unit 51 complete — backend constraint and solver test suite (dedicated fixture-driven suite covering the constraint mirror, conflict graph, snapshot builder, CP-SAT solver, result application, and failure safety; 36 new tests, 180 backend tests total)
- Unit 50 complete — frontend error handling and observability (Sentry + app error boundary + standardized timetable/solver error states)
- Unit 49 complete — backend observability (Sentry + correlation IDs + structured logs)
- Unit 48 complete — frontend async solver integration
- Unit 47 complete — frontend solver API client
- Unit 46 complete - backend solver start and status API
- Unit 45 complete — async solver job
- Unit 44 complete — jobs boundary and Trigger.dev setup
- Unit 43 complete — backend solver result application service
- Unit 42 complete — backend solver CP-SAT module
- Unit 41 complete — backend solver input snapshot builder
- Unit 40 complete — backend solver constraint mirror
- Unit 39 complete — frontend drag-and-drop save integration
- Unit 38 complete — frontend drag-and-drop scheduling shell
- Unit 37 complete — frontend validation display and solver gate shell
- Unit 36 complete — frontend warning validation engine
- Unit 35 complete — frontend blocking validation engine
- Unit 34 complete — frontend manual scheduling controls
- Unit 32 complete — frontend assignment API client
- Unit 31 complete — backend saved timetable assignment persistence and protected save API
- Unit 30 complete — frontend scheduled session rendering shell
- Unit 29 complete — frontend unscheduled pool integration (real schedulable-session data)
- Unit 28 complete — frontend unscheduled pool shell
- Unit 27 complete — frontend session management integration
- Unit 26 complete — frontend session API client
- Unit 25 complete — backend session persistence and protected API
- Unit 24 complete — frontend unit page integration
- Unit 23 complete — frontend unit API client
- Unit 22 complete — backend unit persistence and protected API
- Unit 21 complete — frontend unit and session management shell
- Codebase consistency fixes applied (slots, architecture invariants, unit field naming)

## Current Goal

- Post-v1 work is progressing through the backend adjustments build plan: Unit 58 added three-year operation (derived unit year levels + year-matched enrolment sync), Unit 59 added unit teaching teams + session-level lecturers, and Unit 60 reduced session types to lecture/tutorial and introduced hidden session-student allocations (lecture = all enrolled, tutorial = even split). Next post-v1 backend units build on this foundation (Unit 61 availability replace-all save, Unit 68 solver allocation + session-lecturer integration) ahead of the frontend alignment and redesign units (62–67, 69–71).
- The v1 build is feature-complete and has passed the final scope guard + hardening pass (Unit 57): the app is a **hardened v1 release candidate** with no outstanding defects. v1 acceptance was executed and documented at Unit 53; Unit 57 re-verified the full scope-guard and verification checklists against the current code and re-ran the suites (backend 185, frontend 43, build green). Deployment wiring is prepared in-repo across Units 54 (Vercel), 55 (Railway), and 56 (Trigger.dev production), each with the repo-side config + docs done and only manual dashboard/CLI operations remaining. Candidate follow-ups (out of v1 scope): execute the manual deploy steps, a fresh interactive human click-through against the running stack, WebSocket live solver progress (architecture-context lists Realtime), and frontend bundle code-splitting.

## Completed

- **Unit 1: Repository, Frontend Bootstrap, and UI Foundation**
  - Scaffolded `frontend/` with Vite + React + TypeScript
  - Installed TailwindCSS v4 with `@tailwindcss/vite` plugin
  - Configured `vite.config.ts` with Tailwind plugin and `@` path alias
  - Configured `tsconfig.app.json` with strict mode and `@/*` path alias
  - Wrote `src/index.css` with all v1 design tokens from `ui-context.md`:
    - page backgrounds, surface colors, text colors
    - accent colors (maroon primary, gold secondary)
    - border colors, focus ring, state colors
    - timetable grid tokens, unit card tokens, solver accent tokens
  - Loaded Inter, Cormorant Garamond, and JetBrains Mono via Google Fonts
  - Initialized shadcn/ui (`base-nova` style, Tailwind v4, CSS variables)
  - Added shadcn/ui base components: Button, Input, Card, Table, Dialog, Alert, Badge, Select, Form, Label
  - Installed `@base-ui/react` (required by `base-nova` style components)
  - Removed default Vite demo UI; `App.tsx` renders only the styled foundation screen
  - Foundation page shows: app title (serif), description, status badges, feature checklist card
  - No mock data, no routing, no auth, no backend code
  - Root `README.md` with project description and frontend run instructions
  - Root `.gitignore`
  - `frontend/.env.example`
  - `docs/` placeholder

- **Unit 2: Frontend Route Shell, App Layout, and Login Shell**
  - Installed `react-router-dom`
  - Created `BrowserRouter` + `Routes` in `App.tsx` with all v1 routes
  - Root `/` redirects to `/timetable`
  - Created shared layout components in `src/components/layout/`:
    - `AppFrame` — top-level page wrapper with `TopNav` and `<main>` content area
    - `TopNav` — horizontal header with brand name, nav links, sign-out placeholder (disabled)
    - `PageHeader` — page title, description, optional right-side action slot
    - `EmptyState` — centered empty state with icon, title, description, optional action
  - Created placeholder pages in `src/routes/`:
    - `/timetable` — TimetablePage with empty state
    - `/rooms` — RoomsPage with empty state
    - `/lecturers` — LecturersPage with empty state
    - `/students` — StudentsPage with empty state
    - `/units` — UnitsPage with empty state
    - `/login` — LoginPage with complete form shell (email, password, submit, loading state, error state)
  - Login form prevents default submission and shows a 1-second loading state; no Supabase calls
  - Created `/signup` page shell — same design as login: email, password, confirm password, loading state, error state
  - TopNav refactored: title is larger (`text-xl font-bold`, serif, maroon) and anchored left; sign-out button anchored right; nav links (`Timetable, Units, Lecturers, Students, Rooms`) absolutely centered on the page
  - AppFrame `main` fills full viewport width — `max-w-7xl` constraint removed
  - All pages use Unit 1 design tokens; no hardcoded hex values
  - Active nav link styled with maroon soft background
  - Build succeeds with zero TypeScript errors

- **Unit 3: Backend Bootstrap, Database, Migrations, and Error Foundation**
  - Created `backend/` structure: `api/`, `db/`, `models/`, `schemas/`, `services/`, `auth/`, `log/`, `alembic/`
  - `config.py` — Pydantic `Settings` with `DATABASE_URL` and `CORS_ORIGINS` loaded from `.env`
  - `main.py` — FastAPI app with CORS middleware (allows local frontend at `http://localhost:5173`), `AppError` exception handler, and `api_router` mounted
  - `api/health.py` — `GET /health` returns `{"status": "ok"}`
  - `api/errors.py` — `ErrorDetail`, `ErrorResponse` Pydantic models; `error_response()` helper; `AppError` exception; `app_error_handler` FastAPI exception handler
  - `api/router.py` — top-level `api_router` that includes the health router
  - `db/session.py` — SQLAlchemy 2.0 `engine`, `SessionLocal`, and `Base` (DeclarativeBase)
  - `db/deps.py` — `get_db()` FastAPI dependency yielding a `Session`
  - `log/setup.py` — `configure_logging()` using structlog with JSON output and ISO timestamps (named `log/` not `logging/` to avoid shadowing the Python stdlib)
  - `alembic.ini` — Alembic config pointing to `alembic/` script location; URL overridden by env var in `env.py`
  - `alembic/env.py` — reads `DATABASE_URL` from environment, imports `Base.metadata` as `target_metadata`
  - `alembic/script.py.mako` — standard Alembic migration template
  - `alembic/versions/0001_baseline.py` — empty baseline migration (no domain tables)
  - `requirements.txt` — FastAPI, Uvicorn, pydantic-settings, SQLAlchemy 2.0, Alembic, psycopg2-binary, structlog
  - `backend/.env.example` — documents required environment variables
  - No domain models, no auth, no CRUD routes, no solver code added

- **Unit 4: Backend Supabase Auth Boundary**
  - Added `PyJWT[crypto]>=2.8.0` to `requirements.txt`
  - Added `supabase_url` field to `config.py` `Settings`
  - Created `backend/auth/jwt.py` — `decode_supabase_token()` verifies RS256/ES256 Supabase JWTs via `PyJWKClient` fetching keys from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`; JWKS client caches keys across requests
  - Created `backend/auth/deps.py` — `CurrentAdmin` model and `get_current_admin` FastAPI dependency; extracts Bearer token, verifies JWT, raises `AppError` 401 on missing or invalid tokens
  - Created `backend/api/protected.py` — `GET /auth/verify` test endpoint requiring `get_current_admin`; returns `{"authenticated": true, "user_id": "..."}` for valid tokens
  - Registered protected router in `api/router.py`
  - Updated `.env.example` with `SUPABASE_URL`
  - No product CRUD routes, no frontend auth code, no RBAC added

- **Unit 5: Frontend Supabase Auth and Protected Routes**
  - Installed `@supabase/supabase-js`
  - Created `frontend/src/lib/supabase.ts` — Supabase browser client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Created `frontend/src/lib/auth/context.tsx` — `AuthProvider` initialises session via `getSession()`, subscribes to `onAuthStateChange`, exposes `session`, `loading`, and `signOut` via `useAuth()`
  - Created `frontend/src/components/auth/ProtectedRoute.tsx` — shows blank loading screen during session init, redirects unauthenticated users to `/login`, renders children when authenticated
  - Updated `frontend/src/routes/login.tsx` — real Supabase email/password sign-in; controlled email/password inputs; loading and error states; redirects to `/timetable` on success; redirects already-authenticated users to `/timetable`
  - Updated `frontend/src/components/layout/TopNav.tsx` — sign-out button calls `useAuth().signOut()`; ProtectedRoute handles post-signout redirect
  - Updated `frontend/src/App.tsx` — `AuthProvider` wraps all routes; five app routes wrapped in `ProtectedRoute`
  - Updated `frontend/.env.example` — added `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Build succeeds with zero TypeScript errors
  - No authenticated API client, no TanStack Query, no Zustand, no mock data added

- **Unit 5/2: Signup Functionality**
  - Wired controlled inputs (email, password, confirmPassword) in `frontend/src/routes/signup.tsx`
  - Added client-side validation: required fields, password/confirm match
  - Calls `supabase.auth.signUp()` on submit; loading state disables form during request
  - Friendly error messages mapped from Supabase error strings
  - Post-signup: redirects to `/timetable` if session returned; shows "check your email" success screen if email confirmation is required
  - Redirects already-authenticated users to `/timetable`
  - Added `Sign in` link on signup page; added `Create one` link on login page
  - Build succeeds with zero errors

- **Unit 6: Frontend Authenticated API Base Client**
  - Renamed `VITE_API_URL` → `VITE_API_BASE_URL` in `frontend/.env.example`
  - Created `frontend/src/lib/api/client.ts` — `apiRequest<T>` generic helper: reads `VITE_API_BASE_URL`, retrieves Supabase access token via `getSession()`, attaches `Authorization: Bearer`, sends/parses JSON, handles empty responses, normalizes backend errors into `ApiRequestError`, handles `401` consistently
  - Created `frontend/src/lib/api/auth.ts` — `verifyAuth()` calls `GET /auth/verify` (Unit 4 protected endpoint); exports `VerifyResponse` type
  - Updated `frontend/src/routes/timetable.tsx` — dev-only `useEffect` calls `verifyAuth()` on mount; renders inline status line (idle / loading / ✓ authenticated / ✗ error) via `import.meta.env.DEV` guard; stripped in production build
  - No TanStack Query, Zustand, CRUD, mock data, or product API clients added
  - Build succeeds with zero TypeScript errors

- **Unit 7: Frontend Rooms Page Shell**
  - Replaced placeholder `RoomsPage` with full management-page layout
  - Page header with title, description, and `Create room` primary action
  - Bordered table panel with column headers: Name, Capacity, Type, Actions
  - Inline empty state (icon + text) inside `TableBody` when no rooms exist — no fake rows
  - `RoomForm` component with Name (`Input`), Capacity (`Input[type=number]`), Room type (`Select`) fields
  - Create room `Dialog` — opens via header button, form shell, disabled Create CTA
  - Edit room `Dialog` — state-controlled, row-level trigger wired when real data exists
  - Delete confirmation `Dialog` — state-controlled, destructive CTA, explains session impact
  - All styling via design tokens, no hardcoded hex values
  - No backend calls, API clients, TanStack Query, or CRUD behavior
  - Build succeeds with zero TypeScript errors

- **Unit 8: Frontend Timetable No-Room State and Grid Shell**
  - Updated `/timetable` route to full workspace layout
  - Page header with revised description; reserved action/status bar (`TimetableActionBar`)
  - No-room empty state rendered when `ROOMS` array is empty (default — no room API yet)
  - Created `frontend/src/features/timetable/slots.ts` — centralized `DAYS`, `TIME_SLOTS`, `AM_SLOTS`, `PM_SLOTS`, `LUNCH_LABEL`; Monday–Friday; AM slots 9:00–11:00, PM slots 13:00–16:00
  - Created `frontend/src/features/timetable/GridCell.tsx` — blank cell (h-14, w-32), hover treatment via `--grid-cell-hover`, day-boundary border via `--grid-line-strong`, all tokens from `ui-context.md`
  - Created `frontend/src/features/timetable/TimetableGrid.tsx` — accepts `RoomColumn[]`; renders day headers, room sub-headers, AM rows, lunch divider (`--grid-lunch-bg`), PM rows; returns null when rooms empty
  - Created `frontend/src/features/timetable/TimetableActionBar.tsx` — reserved shell for future validation and solver controls
  - No room API, fake rooms, fake sessions, fake assignments, drag-and-drop, or solver behavior added
  - Build succeeds with zero TypeScript errors

- **Unit 9: Backend Room Persistence and Protected API**
  - Created `backend/models/room.py` — `RoomType` enum (`lecture`, `tutorial`) and `Room` SQLAlchemy model with `id`, `name` (unique), `capacity`, `room_type`, `created_at`, `updated_at`
  - Created `backend/schemas/room.py` — `RoomCreate`, `RoomUpdate`, and `RoomResponse` Pydantic schemas; validators reject blank names and non-positive capacity values
  - Created `backend/services/room.py` — `list_rooms`, `get_room`, `create_room`, `update_room`, `delete_room`; raises `AppError` 404 on not-found, 409 on name uniqueness conflict
  - Created `backend/api/rooms.py` — `GET /rooms`, `POST /rooms`, `PUT /rooms/{room_id}`, `DELETE /rooms/{room_id}`; all routes require `get_current_admin`; returns `RoomResponse` schemas
  - Updated `backend/api/router.py` — registered rooms router
  - Created `backend/alembic/versions/0002_create_rooms.py` — creates `rooms` table and `roomtype` Postgres enum; revises `0001`
  - Updated `backend/models/__init__.py` — imports `Room` so `Base.metadata` includes the table
  - Updated `backend/alembic/env.py` — imports `models` package so all models are registered for future `--autogenerate`
  - No frontend API client, no UI integration, no assignment or solver behavior added

- **Unit 10: Frontend Room API Client**
  - Created `frontend/src/lib/api/rooms.ts` — `Room` DTO type, `RoomCreate` and `RoomUpdate` input types, `RoomType` union, and four API functions: `listRooms`, `createRoom`, `updateRoom`, `deleteRoom`
  - All functions use `apiRequest` from the Unit 6 authenticated base client; auth token is attached consistently through that shared helper
  - `parseRoomError` helper adds room-specific messages for 409 (duplicate name) and 422 (validation) errors before re-throwing
  - No TanStack Query, no rooms page data wiring, no mock data added
  - Build succeeds with zero errors

- **Unit 11: Frontend Rooms Page Integration**
  - Installed `@tanstack/react-query`
  - Added `QueryClientProvider` wrapping the app root in `src/App.tsx`
  - Rewrote `src/routes/rooms.tsx` with full backend integration:
    - `useQuery(['rooms'], listRooms)` — loading, error, and empty states driven by real backend data
    - `useMutation` for create, edit, delete — each invalidates `['rooms']` on success
    - Controlled form state (`name`, `capacity`, `room_type`) for create and edit dialogs
    - Required field validation gates submit buttons; buttons show loading text while mutations run
    - Per-dialog error messages surface mutation errors to the user
    - Delete requires confirmation; delete dialog shows room name and error state
    - Room type values corrected to match backend enum (`lecture`, `tutorial`)
    - Row-level Edit and Delete action buttons wired to real room data
    - No mock data, no Zustand, no timetable integration, no optimistic updates
  - Build succeeds with zero TypeScript errors

- **Unit 12: Frontend Timetable Room Integration**
  - Replaced static `ROOMS: RoomColumn[]` placeholder in `src/routes/timetable.tsx` with `useQuery(['rooms'], listRooms)` from the room API client
  - Loading state: centered "Loading rooms…" panel shown while rooms fetch
  - Error state: backend error message shown in error panel
  - No-room state: empty state with `CalendarDays` icon and link to `/rooms` for navigation
  - Grid state: `TimetableGrid` rendered with real `Room[]` records; `Room` satisfies `RoomColumn` structurally (`id` + `name`)
  - `queryKey: ['rooms']` matches the rooms page cache — creating a room on `/rooms` invalidates and refetches, causing the timetable to render the grid automatically
  - Removed dev-only auth verify code from Unit 6 (no longer needed)
  - No new packages, no Zustand, no localStorage, no fake data
  - Build succeeds with zero TypeScript errors

- **Unit 12/2: Timetable Table UI Adjustments**
  - Updated `slots.ts`: all 8 time slot labels now show start–end times in `H:MM-H:MM` format; added 4th AM slot `s4` (`12:00-12:50`); PM slots renumbered s5–s8 with labels `1:30-2:20` through `4:30-5:20`
  - `TimetableGrid.tsx`: removed `overflow-x-auto` wrapper and `min-w-max`; grid is now `w-full`; day headers use `flex: rooms.length` to span proportionally; room sub-headers and `GridCell` use `flex-1` so columns distribute across available width without horizontal scroll
  - Time label column widened from `4rem` to `6rem` to accommodate longer `HH:MM-HH:MM` labels
  - All time labels, day headers, room sub-headers, and lunch row use `userSelect: 'none'` and `onContextMenu` prevention; global app text selection and right-click are unaffected
  - `GridCell.tsx`: replaced `shrink-0 w-32` with `flex-1`; cells resize proportionally
  - Build succeeds with zero TypeScript errors

- **Units 13/17: Frontend Lecturer and Student Page Shells**
  - Created `frontend/src/features/lecturers/AvailabilityEditor.tsx` — self-contained availability grid; Mon–Fri columns, AM slots (s1–s4), lunch divider, PM slots (s5–s8); click to toggle unavailable (maroon-soft highlight); legend and instructions; blank initial state
  - Rewrote `frontend/src/routes/lecturers.tsx` — full management shell: page header with "Add lecturer" action; table with Title/First name/Last name/Actions columns; inline empty state; Create/Edit/Delete/Availability dialogs; `LecturerFormFields` (title, first name, last name); all submit buttons disabled pending API integration; availability dialog uses `AvailabilityEditor` with disabled "Save availability" CTA
  - Rewrote `frontend/src/routes/students.tsx` — full management shell: page header with "Add student" action; table with Title/First name/Last name/Year level/Actions columns; inline empty state; Create/Edit/Delete dialogs; `StudentFormFields` (title, first name, last name, year level); all submit buttons disabled pending API integration; no lecturer availability controls
  - No API calls, no mock data, no TanStack Query, no persistence; build succeeds with zero TypeScript errors

- **Unit 14/18: Backend Lecturer and Student Persistence and Protected API**
  - Created `backend/models/lecturer.py` — `LecturerTitle` enum (`Dr.`, `Prof.`, `A/Prof.`, `Mr.`, `Ms.`), `AvailabilityDay` enum (Monday–Friday), `AvailabilitySlot` enum (`s1`–`s8`, matching timetable slots), `Lecturer` SQLAlchemy model, `LecturerAvailability` model with unique constraint on `(lecturer_id, day, slot)` and `delete-orphan` cascade
  - Created `backend/models/student.py` — `StudentTitle` enum (`Mr.`, `Ms.`, `Mx.`), `Student` SQLAlchemy model with `year_level` integer field
  - Created `backend/schemas/lecturer.py` — `AvailabilityEntry`, `LecturerCreate`, `LecturerUpdate`, `LecturerAvailabilitySet`, `LecturerResponse` (includes `unavailable_slots`); validators enforce non-blank names
  - Created `backend/schemas/student.py` — `StudentCreate`, `StudentUpdate`, `StudentResponse`; validators enforce non-blank names and year level 1–5
  - Created `backend/services/lecturer.py` — `list_lecturers`, `get_lecturer`, `create_lecturer`, `update_lecturer`, `delete_lecturer`, `set_availability` (replaces all unavailability records via ORM relationship)
  - Created `backend/services/student.py` — `list_students`, `get_student`, `create_student`, `update_student`, `delete_student`
  - Created `backend/api/lecturers.py` — `GET /lecturers`, `POST /lecturers`, `PUT /lecturers/{id}`, `DELETE /lecturers/{id}`, `PUT /lecturers/{id}/availability`; all protected by `get_current_admin`
  - Created `backend/api/students.py` — `GET /students`, `POST /students`, `PUT /students/{id}`, `DELETE /students/{id}`; all protected by `get_current_admin`
  - Created `backend/alembic/versions/0003_create_lecturers_and_students.py` — creates `lecturertitle`, `availabilityday`, `availabilityslot`, `studenttitle` Postgres enums; creates `lecturers`, `lecturer_availability`, `students` tables
  - Updated `backend/models/__init__.py` — registers `Lecturer`, `LecturerAvailability`, `Student`
  - Updated `backend/api/router.py` — registered lecturer and student routers
  - No frontend API clients, unit/session relationships, constraint evaluation, or solver behavior added

- **Unit 15/19: Frontend Lecturer and Student API Clients**
  - Created `frontend/src/lib/api/lecturers.ts` — `LecturerTitle`, `AvailabilityDay`, `AvailabilitySlot`, `AvailabilityEntry`, `Lecturer`, `LecturerCreate`, `LecturerUpdate`, `LecturerAvailabilitySet` types; `listLecturers`, `createLecturer`, `updateLecturer`, `deleteLecturer`, `setLecturerAvailability` functions; `parseLecturerError` helper for 409/422
  - Created `frontend/src/lib/api/students.ts` — `StudentTitle`, `Student`, `StudentCreate`, `StudentUpdate` types; `listStudents`, `createStudent`, `updateStudent`, `deleteStudent` functions; `parseStudentError` helper for 422
  - All functions use the Unit 6 `apiRequest` authenticated base client; token attachment and 401 handling delegated to base client
  - DTO types match backend `LecturerResponse` and `StudentResponse` schemas exactly; `AvailabilitySlot` union matches backend enum (s1–s3, s5–s8, no s4)
  - `/lecturers` and `/students` pages remain unconnected to real data
  - Build succeeds with zero TypeScript errors

- **Unit 16/20: Frontend Lecturer and Student Page Integrations**
  - Updated `AvailabilityEditor` to controlled component — accepts `value: AvailabilityEntry[]` and `onChange` props; no internal state
  - Rewrote `frontend/src/routes/lecturers.tsx` with full TanStack Query integration:
    - `useQuery({ queryKey: ['lecturers'], queryFn: listLecturers })` — loading, error, empty states driven by real backend data
    - `useMutation` for create, edit, delete, availability save — each invalidates `['lecturers']` on success
    - Availability dialog initialises from lecturer's `unavailable_slots`; saves via `setLecturerAvailability`
    - Per-dialog error messages surface mutation failures; loading text on buttons while mutations run
    - Removed local `Lecturer`, `LecturerTitle` type definitions; imported from `@/lib/api/lecturers`
    - No mock data, no Zustand, no student API calls
  - Rewrote `frontend/src/routes/students.tsx` with full TanStack Query integration:
    - `useQuery({ queryKey: ['students'], queryFn: listStudents })` — loading, error, empty states
    - `useMutation` for create, edit, delete — each invalidates `['students']` on success
    - Per-dialog error messages; loading text on buttons while mutations run
    - Removed local `Student`, `StudentTitle` type definitions; imported from `@/lib/api/students`
    - No mock data, no Zustand, no lecturer API calls, no availability controls
  - Query keys `['lecturers']` and `['students']` are separate and never cross-invalidate
  - Build succeeds with zero TypeScript errors

- **Unit 21: Frontend Unit and Session Management Shell**
  - Rewrote `frontend/src/routes/units.tsx` — full management shell: page header with "Create unit" action; table with Code/Name/Sessions/Actions columns; inline empty state (BookOpen icon + text)
  - Create unit `Dialog` — opens via header button; fields for unit code (e.g. HIS101), unit name (e.g. Ancient History), disabled lecturer selector (placeholder), disabled student selector (placeholder); session section with add button, inline session boxes, empty session state; Create CTA disabled until code and name are filled
  - Edit unit `Dialog` — same form structure as create; Save changes CTA disabled until required fields filled
  - Delete unit `Dialog` — confirms that the unit and all its sessions will be removed; destructive CTA
  - `SessionBox` component — compact card with session type `Select` (Lecture/Tutorial/Lab/Workshop) and duration `Select` (1–4 slots); delete button removes the box from local shell state
  - Session state is local to the form only (add/delete interaction only); no persistence, no backend calls, no TanStack Query wiring
  - Lecturer and student selectors are disabled with placeholder text; no real data connected
  - No fake unit, session, lecturer, or student records displayed
  - Fixed `@base-ui/react` Select `onValueChange` type (`string | null`) with `?? ''` nullish coalescing
  - Build succeeds with zero TypeScript errors

- **Unit 22: Backend Unit Persistence and Protected API**
  - Created `backend/models/unit.py` — `Unit` SQLAlchemy model (`id`, `code` unique, `name`, `lecturer_id` FK); `unit_students` many-to-many join table (unit→student, both cascade on delete); `lazy="selectin"` on `lecturer` and `students` relationships to avoid N+1 on list
  - Created `backend/schemas/unit.py` — `LecturerSummary`, `StudentSummary` (lightweight nested types); `UnitCreate` (code, name, lecturer_id, student_ids); `UnitUpdate` (all optional); `UnitResponse` (includes nested lecturer and students); validators enforce non-blank code and name
  - Created `backend/services/unit.py` — `list_units`, `get_unit`, `create_unit`, `update_unit`, `delete_unit`; validates lecturer exists (422), all student IDs exist (422), unique unit code (409 on conflict); excludes self on code uniqueness check during update
  - Created `backend/api/units.py` — `GET /units`, `POST /units`, `PUT /units/{unit_id}`, `DELETE /units/{unit_id}`; all routes require `get_current_admin`; returns `UnitResponse` schemas
  - Created `backend/alembic/versions/0005_create_units.py` — creates `units` table (with FK to `lecturers`, unique constraint on `code`) and `unit_students` join table; revises `0004`
  - Updated `backend/models/__init__.py` — registers `Unit` and `unit_students`
  - Updated `backend/api/router.py` — registered units router
  - No frontend code, no session model, no session routes added

- **Unit 23: Frontend Unit API Client**
  - Created `frontend/src/lib/api/units.ts` — `LecturerSummary`, `StudentSummary` nested types; `Unit` DTO; `UnitCreate`, `UnitUpdate` request types; `listUnits`, `createUnit`, `updateUnit`, `deleteUnit` API functions; `parseUnitError` helper for 409 (duplicate code) and 422 (validation) errors
  - All functions use the Unit 6 `apiRequest` authenticated base client; token attachment and 401 handling delegated to base client
  - DTO types match backend `UnitResponse` schema exactly; `LecturerSummary` and `StudentSummary` match backend nested types; `LecturerTitle` imported from existing `lecturers.ts` to avoid duplication
  - No server-owned unit data in Zustand; `/units` page not connected to real data; no session API client added
  - Build succeeds with zero TypeScript errors

- **Unit 24: Frontend Unit Page Integration**
  - Rewrote `frontend/src/routes/units.tsx` with full TanStack Query integration:
    - `useQuery({ queryKey: ['units'], queryFn: listUnits })` — loading, error, empty states driven by real backend data
    - `useQuery({ queryKey: ['lecturers'], queryFn: listLecturers })` — powers lecturer selector
    - `useQuery({ queryKey: ['students'], queryFn: listStudents })` — powers student selector
    - `useMutation` for create, edit, delete — each invalidates `['units']` on success; per-dialog error messages; loading text on CTA buttons
  - Lecturer selector: real `Select` populated from lecturer records; shows `Title First Last`; required for form validity
  - Student selector: scrollable checkbox list populated from student records; tracks `student_ids[]`; shows selected count
  - Create, edit, delete dialogs fully wired to backend mutations; delete dialog shows unit code and name for confirmation
  - Edit dialog initialises from real unit data (`code`, `name`, `lecturer_id`, `student_ids` extracted from `unit.students`)
  - Session section kept as non-persistent shell: add/remove session boxes work locally; no backend calls; placeholder text notes next phase
  - `isFormValid` requires `code`, `name`, and `lecturer_id`; sessions not required
  - `/lecturers` and `/students` routes not muddled; units page only reads from those query caches
  - No mock data, no Zustand, no session API calls
  - Build succeeds with zero TypeScript errors

- **Unit 25: Backend Session Persistence and Protected API**
  - Created `backend/models/session.py` — `SessionType` enum (`lecture`, `tutorial`, `lab`, `workshop`); `Session` SQLAlchemy model (`id`, `unit_id` FK with CASCADE, `session_type`, `duration`, `created_at`, `updated_at`); back-populates `unit.sessions`
  - Updated `backend/models/unit.py` — added `sessions` relationship with `cascade="all, delete-orphan"` so deleting a unit removes its child sessions
  - Created `backend/schemas/session.py` — `SessionCreate` (session_type, duration 1–4 validated); `SessionUpdate` (both optional, same duration guard); `SessionResponse`; `SchedulableSessionResponse` (includes derived lecturer display name, student count)
  - Created `backend/services/session.py` — `list_sessions_for_unit`, `create_session`, `update_session`, `delete_session`, `list_schedulable_sessions`; schedulable filter requires unit to have a lecturer; student count derived from parent unit; no assignment behavior
  - Created `backend/api/sessions.py` — two routers: `unit_sessions_router` (`GET/POST /units/{unit_id}/sessions`) and `sessions_router` (`GET /sessions/schedulable`, `PUT /sessions/{session_id}`, `DELETE /sessions/{session_id}`); all routes require `get_current_admin`
  - Created `backend/alembic/versions/0006_create_sessions.py` — creates `sessiontype` Postgres enum and `sessions` table; revises `0005`
  - Updated `backend/models/__init__.py` — registers `Session`
  - Updated `backend/api/router.py` — registered both session routers

- **Unit 26: Frontend Session API Client**
  - Created `frontend/src/lib/api/sessions.ts` — `SessionType` union (`lecture | tutorial | lab | workshop`); `Session` DTO; `SessionCreate`, `SessionUpdate` request types; `SchedulableSession` DTO (includes derived lecturer display name, student count); `listUnitSessions`, `createUnitSession`, `updateSession`, `deleteSession`, `listSchedulableSessions` API functions; `parseSessionError` helper for 404/422
  - All functions use the Unit 6 `apiRequest` authenticated base client; token attachment and 401 handling delegated to base client
  - Paths match Unit 25 backend routes exactly: `/units/{unitId}/sessions` for unit-scoped routes, `/sessions/{sessionId}` for top-level, `/sessions/schedulable` for schedulable listing
  - No TanStack Query hooks, no Zustand, no `/units` page wiring, no mock data
  - Build succeeds with zero TypeScript errors

- **Unit 27: Frontend Session Management Integration**
  - Rewrote `frontend/src/routes/units.tsx` with full session persistence:
    - `UnitTableRow` component — per-unit `useQuery(['unit-sessions', unit.id], listUnitSessions)` shows live session count in Sessions column; counts update automatically after mutations
    - `UnitSessionsPanel` component — rendered inside the edit unit dialog; fetches sessions with `['unit-sessions', unitId]`; "Add session" button calls `createUnitSession` with default `{session_type: 'lecture', duration: 1}`; invalidates query on success; loading and error states on both query and mutation
    - `SessionBoxLive` component — inline session box with per-session `updateMutation` (fires on session type or duration select change) and `deleteMutation` (requires inline delete/cancel confirmation before firing); `Loader2` spinner shown while update is in progress; both errors displayed inline below the box
    - `UnitFormFields` — sessions section removed (sessions require an existing unit); create dialog updated description to note sessions are added after creation
    - `SessionType` values use backend enum strings (`lecture`/`tutorial`/`lab`/`workshop`); `DURATION_OPTIONS` values are integers 1–4
    - All session mutations invalidate `['unit-sessions', unitId]`; unit mutations still invalidate `['units']`
    - No Zustand, no localStorage, no mock sessions
  - Build succeeds with zero TypeScript errors

- **Unit 28: Frontend Unscheduled Pool Shell**
  - Created `frontend/src/features/timetable/unitColors.ts` — `getUnitColor(identifier)` deterministic helper; hashes identifier string into one of 6 color variant names (maroon, gold, blue, green, purple, stone); no hex values
  - Created `frontend/src/features/timetable/UnscheduledSessionCard.tsx` — compact card prepared for `SchedulableSession` DTO; displays session type, unit code, unit name, duration, lecturer display name, student count; left-border accent driven by unit color variant tokens; `minWidth: 180px`, `maxWidth: 240px`; no drag-and-drop
  - Created `frontend/src/features/timetable/UnitGroup.tsx` — groups session cards under a unit label row (code, name, session count); accepts `UnitColorVariant` and `SchedulableSession[]`
  - Created `frontend/src/features/timetable/UnscheduledPool.tsx` — pool panel with heading, helper text, empty state (`CalendarPlus` icon, "No schedulable sessions yet", link to `/units`), and unit-bucket rendering when sessions provided; `buildUnitBuckets` groups sessions by `unit_id`; no backend calls
  - Updated `frontend/src/routes/timetable.tsx` — `UnscheduledPool` imported and rendered below `TimetableGrid` only in the rooms-exist grid state; all other states (loading, error, no-room) unchanged
  - No drag-and-drop, no TanStack Query wiring for sessions, no mock data, no backend calls
  - Build succeeds with zero TypeScript errors

- **Unit 29: Frontend Unscheduled Pool Integration**
  - Added `useQuery({ queryKey: ['schedulable-sessions'], queryFn: listSchedulableSessions })` in `timetable.tsx`; sessions query runs independently from the rooms query so pool and grid states are decoupled
  - `UnscheduledPool` updated to accept `isLoading`, `isError`, `error` props; renders spinner loading state, error message, empty state, or grouped session cards depending on query state
  - `buildUnitBuckets` now sorts buckets by unit code (alphabetical) and sorts sessions within each bucket by session type order (lecture → tutorial → lab → workshop) then by duration
  - `['schedulable-sessions']` query key is invalidated on `createMutation`, `editMutation`, and `deleteMutation` success in `units.tsx`, so the pool refreshes automatically after unit/session changes
  - No mock data, no Zustand, no scheduling/assignment/drag-drop behavior added
  - Build succeeds with zero TypeScript errors

- **Unit 30: Frontend Scheduled Session Rendering Shell**
  - Created `frontend/src/features/timetable/assignment.ts` — `SlotId` union (`s1`–`s7`, no `s8`); `TimetableAssignment` frontend rendering model with all fields needed to place and display a session (assignment_id optional, session_id, unit_id, unit_code, unit_name, session_type, duration, lecturer_display_name, student_count, day, start_slot, room_id); aligns with future Unit 32 backend DTO
  - Created `frontend/src/features/timetable/ScheduledSessionCard.tsx` — `position: absolute inset-x-0 top-0`, height `calc(N * 3.5rem)` where N = duration; left-border 4px accent (vs 3px on unscheduled cards); shows unit code, abbreviated session type, lecturer name (truncated), student count (duration > 1 only); uses `getUnitColor` + same BG/accent token maps as `UnscheduledSessionCard`; `z-index: 10` to overlay subsequent slot rows; `overflow: hidden`; distinct from unscheduled cards by layout, width behavior, and content
  - Updated `frontend/src/features/timetable/GridCell.tsx` — added `position: relative` (`className="relative h-14 …"`); accepts `assignment?: TimetableAssignment`; renders `ScheduledSessionCard` when assignment is present; suppresses hover state when a card is rendered
  - Updated `frontend/src/features/timetable/TimetableGrid.tsx` — accepts `assignments?: TimetableAssignment[]` (defaults to `[]`); `buildAssignmentMap` indexes assignments by `"${day}:${roomId}:${slotId}"`; each `GridCell` receives `assignment={assignmentMap.get(key)}` — undefined when no assignment starts at that cell; grid renders blank as before when `assignments=[]`
  - Updated `frontend/src/routes/timetable.tsx` — passes `assignments={[]}` to `TimetableGrid`; no backend calls, no fake data
  - No drag-and-drop, no assignment API client, no backend calls, no mock assignments in production UI
  - Build succeeds with zero TypeScript errors

- **Unit 31: Backend Saved Timetable Assignment Persistence and Protected Save API**
  - Created `backend/models/assignment.py` — `TimetableAssignment` SQLAlchemy model; `session_id` FK with CASCADE on session delete; `room_id` FK with CASCADE on room delete (satisfies room-deletion unschedule requirement); reuses existing Postgres `availabilityday`/`availabilityslot` enum types via `create_type=False`; unique constraint on `session_id` (one assignment per session); unique constraint on `(day, start_slot, room_id)` for same-start-slot double-booking guard at DB level
  - Created `backend/alembic/versions/0007_create_assignments.py` — creates `timetable_assignments` table; references existing Postgres enum types without recreation
  - Created `backend/schemas/assignment.py` — `AssignmentItem` (session_id, day, start_slot, room_id); `AssignmentSaveRequest` (list of AssignmentItem); `AssignmentResponse` (all joined display fields per spec: assignment_id, session_id, unit_id, unit_code, unit_name, session_type, duration, lecturer_display_name, student_count, day, start_slot, room_id, timestamps)
  - Created `backend/services/assignment.py` — `list_assignments` (eager-loads session→unit→lecturer/students via selectinload); `save_assignments` (replace-all transaction with full defensive validation); `clear_assignments` (optional clear); defensive checks reject: duplicate session in request, session/room not found, room capacity < student count, session crossing lunch, session running off timetable, room double-booking (multi-slot overlap detection, not just same-start-slot); warning-level conflicts (lecturer/student/availability) are not checked and are allowed through
  - Created `backend/api/assignments.py` — `GET /assignments` (list), `POST /assignments` (save/replace), `DELETE /assignments` (clear); all routes require `get_current_admin`
  - Updated `backend/models/__init__.py` — registered `TimetableAssignment`
  - Updated `backend/api/router.py` — registered assignments router
  - Room deletion cascade: handled by `ondelete="CASCADE"` FK constraint in migration; no service-layer changes needed; Postgres removes orphaned assignments automatically when a room is deleted

- **Unit 32: Frontend Assignment API Client**
  - Created `frontend/src/lib/api/assignments.ts` — `AssignmentResponse` DTO (all display fields matching backend `AssignmentResponse`); `AssignmentItem` (session_id, day, start_slot, room_id — save request per-assignment); `AssignmentSaveRequest` (wraps list of `AssignmentItem`); `listAssignments()` (`GET /assignments`); `saveAssignments(input)` (`POST /assignments`); `clearAssignments()` (`DELETE /assignments`)
  - `AvailabilityDay` and `AvailabilitySlot` imported from `@/lib/api/lecturers` (canonical source, avoids duplication); `SessionType` imported from `@/lib/api/sessions`
  - `parseAssignmentSaveError` handles backend defensive rejections (404, 409, 422) as save errors; not normal validation UX
  - All functions use `apiRequest` from authenticated base client; no draft state, no drag-drop, no validation logic added
  - Build succeeds with zero TypeScript errors

- **Unit 33: Frontend Timetable Draft Assignment State**
  - Added `useQuery(['assignments'], listAssignments)` in `timetable.tsx` to load saved assignments from the backend
  - Added `useState<TimetableAssignment[]>` draft initialized from saved assignments via `useEffect`; draft resets clean whenever saved assignments refetch
  - `isDirty: boolean` and `saveError: string | null` state tracks unsaved changes and save failure independently
  - `useMutation(saveAssignments)` sends the complete draft as `AssignmentSaveRequest` on save; on success invalidates `['assignments']` (triggering refetch and draft reset); on error preserves draft and surfaces `saveError`
  - `TimetableGrid` now receives `assignments={draft}` instead of `[]` — scheduled cards render from the draft set
  - `TimetableActionBar` rewritten with props (`isDirty`, `isSaving`, `saveError`, `onSave`): Save Timetable button (enabled when dirty, spinner while saving); unsaved-changes label visible when dirty; save error shown inline; placeholder text shown when clean and no error
  - `toTimetableAssignment` helper converts `AssignmentResponse` → `TimetableAssignment` (field-aligned, no casting needed)
  - Build succeeds with zero TypeScript errors

- **Unit 34: Frontend Manual Scheduling Controls**
  - `pendingSessionId: string | null` state in `timetable.tsx` — shared selection for both fresh placement (from pool) and move (from grid)
  - `handleSelectSession` toggles pending: clicking same session again cancels selection; clicking a different session switches it
  - `handleCellClick(day, slotId, roomId)` places the pending session — removes any existing draft entry for that session_id first (handles move), builds a new `TimetableAssignment` from the schedulable sessions list, appends to draft, sets `isDirty`, clears pending
  - `handleUnschedule(sessionId)` removes the session from draft, sets `isDirty`, also clears pending if the removed session was pending
  - `unscheduledSessions` derived in `timetable.tsx` — `schedulableSessions` filtered to exclude any session_id already present in `draft`; pool receives this filtered list
  - `ScheduledSessionCard` — added `×` unschedule button (top-right, stopsPropagation); card body click calls `onMoveSelect`; `isPending` shows outline ring and reduced opacity
  - `GridCell` — `isDropTarget = !!pendingSessionId && !assignment`; drop-target cells show hover highlight and pointer cursor; click fires `onCellClick`; passes `isPending`, `onUnschedule`, `onMoveSelect` to `ScheduledSessionCard`
  - `TimetableGrid` — added `pendingSessionId`, `onCellClick`, `onUnschedule`, `onMoveSelect` props; each GridCell closure captures its `day`, `slot.id`, `room.id`
  - `UnscheduledSessionCard` — added `isSelected` (outline ring) and `onClick` props; `cursor-pointer`
  - `UnitGroup` — passes `pendingSessionId` and `onSelectSession` through to each card
  - `UnscheduledPool` — passes `pendingSessionId` and `onSelectSession` through to each `UnitGroup`
  - `TimetableActionBar` — added `isPendingPlacement` prop; shows placement hint in accent color when a session is selected; hint message overrides normal status text (not the save error)
  - `pendingSessionId` also cleared when `savedAssignments` refetch resets the draft
  - Build succeeds with zero TypeScript errors

- **Unit 35: Frontend Blocking Validation Engine**
  - Created `frontend/src/lib/validation/blocking.ts` — pure validation helpers; `BlockingIssueType` union (`room_double_booking`, `room_capacity_too_small`, `session_crossing_lunch`, `session_off_timetable`); `BlockingIssue` interface (type, severity: `'blocking'`, affected_session_ids, optional affected_room_id / affected_day / affected_slot, human-readable message)
  - `checkProposedPlacement(proposed, existingDraft, rooms)` — checks a single proposed assignment against the current draft and room data before it enters the draft; excludes the pending session's own old position so moves don't self-conflict; returns all blocking issues found
  - `checkDraftForBlockingViolations(draft, rooms)` — checks all current draft assignments for off-timetable, lunch-crossing, room-capacity, and room-double-booking violations
  - `getBlockingViolatorIds(draft, rooms)` — returns a `Set<string>` of session IDs that violate any blocking rule; used for automatic unscheduling
  - `isOffTimetable`: `SLOT_INDEX[startSlot] + duration > 7` (7 total slots); `crossesLunch`: occupied indices span both AM (indices 0–2) and PM (indices 3–6); `rangesOverlap`: standard interval overlap test
  - `timetable.tsx`: added `blockingError: string | null` state; added `draftRef` (synced via effect) so data-change effects can read the latest draft without dependency array issues; `handleCellClick` now calls `checkProposedPlacement` before placing — sets `blockingError` and returns early on any blocking issue, clears it and places on success; `handleSelectSession` and `handleUnschedule` clear `blockingError`
  - Auto-unschedule effect runs when `rooms` or `schedulableSessions` query data changes: builds a validation copy of the draft with current session student counts, finds violators via `getBlockingViolatorIds`, removes them from draft, sets `isDirty = true`; no-op when draft is empty
  - `TimetableActionBar`: added `blockingError?: string | null` prop; shown in error style with "Cannot place session: …" prefix; priority below `saveError`, above pending placement hint
  - Build succeeds with zero TypeScript errors

- **Unit 36: Frontend Warning Validation Engine**
  - Created `frontend/src/lib/validation/warning.ts` — pure warning validation helpers; `WarningIssueType` union (`lecturer_overlap`, `unit_session_overlap`, `lecturer_unavailable`); `WarningIssue` interface (type, severity: `'warning'`, affected_session_ids, optional affected_lecturer_id / affected_student_ids / affected_day / affected_slot, human-readable message)
  - `checkDraftForWarnings(draft, lecturers?)` — checks all draft assignments for three warning rules: (1) lecturer overlap: two assignments with the same `lecturer_display_name` on the same day with overlapping slots; (2) unit/session overlap: two assignments from the same `unit_id` on the same day with overlapping slots (detects student conflicts via unit enrollment); (3) lecturer unavailable: assignment occupies a slot marked unavailable by the lecturer; returns all warning issues found
  - `getWarningSessionIds(draft, lecturers?)` — returns `Set<string>` of session IDs with any warning, used for grid visual flagging
  - `ScheduledSessionCard`: added `hasWarning?: boolean` prop; when true, changes border color to `--state-warning` and shows `AlertTriangle` icon (h-3 w-3) alongside the unschedule button for accessible non-color-only indicator
  - `GridCell`: added `hasWarning?: boolean` prop; passes through to `ScheduledSessionCard`
  - `TimetableGrid`: added `warningSessionIds?: Set<string>` prop; computes `hasWarning` per cell using `warningSessionIds.has(assignment.session_id)` and passes to `GridCell`
  - `TimetableActionBar`: added `warningCount?: number` and `canRunSolver?: boolean` props; shows amber warning summary with `AlertTriangle` icon when warnings exist ("N scheduling warnings — solver blocked until resolved"); updated placeholder text
  - `timetable.tsx`: added `useQuery(['lecturers'], listLecturers)` for availability data; computes `warningIssues` and `warningSessionIds` inline from draft + lecturers; computes `canRunSolver = !hasBlockingViolations && warningIssues.length === 0`; passes `warningSessionIds` to `TimetableGrid`, `warningCount` and `canRunSolver` to `TimetableActionBar`
  - Warning placements remain scheduled and saveable; solver gate (`canRunSolver`) is false whenever any blocking or warning issue exists
  - Build succeeds with zero TypeScript errors

- **Unit 37: Frontend Validation Display and Solver Gate Shell**
  - `TimetableActionBar`: replaced `warningCount` prop with `violationMessages: string[]` and `warningMessages: string[]`; added `onRunSolver?: () => void` prop
  - Added **Run Solver** button shell (using `--solver-accent` blue); enabled only when `canRunSolver` is true; HTML `title` attribute carries the full blocked reason for browser tooltip
  - Solver blocked reason message in status area: "N blocking violations and N scheduling warnings must be resolved before running the solver" — uses error color when violations present, warning color when warnings only
  - Added expandable **violation detail panel** (toggled via "View details (N)" / "Hide details" chevron button); renders below the main action bar row with `--bg-muted` background; lists blocking violations with `XCircle` icon and warning issues with `AlertTriangle` icon, grouped by severity
  - `timetable.tsx`: changed from computing just `hasBlockingViolations: boolean` to `blockingViolations: BlockingIssue[]` (full array); passes `.map(v => v.message)` and `warningIssues.map(i => i.message)` to the action bar
  - Verification checklist: blocking rejection visible ✓; warning cards marked ✓; warning detail messages accessible via "View details" ✓; solver disabled when any issue exists ✓; solver disabled state explains why ✓; no backend validation API added ✓
  - Build succeeds with zero TypeScript errors

- **Unit 38: Frontend Drag-and-Drop Scheduling Shell**
  - Installed `@dnd-kit/core` and `@dnd-kit/utilities` (already present in package.json)
  - `GridCell`: added `useDroppable` with id `${day}:${roomId}:${slotId}`; `disabled: !!assignment` so occupied start-slot cells don't accept drops; `isOver` drives drop-target highlight; highlight logic combines DnD `isOver` and existing click-mode `isClickDropTarget && hovered`
  - `UnscheduledSessionCard`: added `useDraggable` with `id={session.session_id}`; spreads `{...listeners}` and `{...attributes}` on card div; `isDragging` reduces opacity to 0.3; CSS transform intentionally not applied (DragOverlay handles visual movement)
  - `ScheduledSessionCard`: added `useDraggable` with `id={assignment.session_id}`; spreads `{...listeners}` and `{...attributes}` on card div; `isDragging` reduces opacity to 0.3; X (unschedule) button gets `onPointerDown={stopPropagation}` to prevent drag starting from the unschedule button
  - `timetable.tsx`: `DndContext` wraps the full timetable canvas (action bar + grid + pool); `PointerSensor` with `activationConstraint: { distance: 5 }` prevents accidental drags; `KeyboardSensor` for accessibility; `activeSessionId` state tracks dragged session for overlay; `handleDragStart` sets `activeSessionId`, clears `pendingSessionId` and `blockingError`; `handleDragEnd` parses droppable id (`day:roomId:slotId`), calls `checkProposedPlacement`, rejects with `blockingError` on blocking violations, updates draft on success; `handleDragCancel` clears `activeSessionId`; `DragOverlay` with `dropAnimation={null}` renders `DragPreviewCard` while dragging
  - `DragPreviewCard`: private component in `timetable.tsx`; renders session info (unit code, type, unit name, duration, lecturer) matching unscheduled card size; uses same design token maps
  - Warning recalculation is automatic — warning state is derived from draft on every render; no extra wiring needed
  - Manual click-based scheduling controls remain fully functional alongside drag-and-drop
  - Build succeeds with zero TypeScript errors

- **Unit 39: Frontend Drag-and-Drop Save Integration**
  - No new code required — all Unit 39 scope was already delivered by Units 33 and 38 combined
  - Drag/drop changes mark draft dirty: `handleDragEnd` sets `setIsDirty(true)` after every successful placement
  - Save sends the complete draft: `saveMutation` maps `draft` to `AssignmentItem[]` and calls `saveAssignments`
  - Save loading state: `isSaving={saveMutation.isPending}` passed to `TimetableActionBar`; spinner shown while pending
  - Successful save refetches: `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['assignments'] })`
  - Dirty-state reset: `useEffect` on `savedAssignments` calls `setIsDirty(false)` and `setSaveError(null)` when the refetch lands
  - Failed save preserves draft: `onError` only sets `saveError`; draft state is untouched
  - Backend defensive rejections visible as save errors: `parseAssignmentSaveError` parses 404/409/422 responses into readable messages; `saveError` displayed in `TimetableActionBar`
  - Build succeeds with zero TypeScript errors

- **Unit 40: Backend Solver Constraint Mirror**
  - Created `backend/constraints/types.py` — `ConstraintType` enum (8 values: room_double_booking, room_capacity, lunch_crossing, off_timetable, lecturer_overlap, student_overlap, unit_session_overlap, lecturer_availability); `ConstraintSeverity` enum (blocking, warning); `CONSTRAINT_SEVERITY` dict mapping each type to its severity (mirrors frontend blocking/warning split); `SessionInput`, `RoomInput`, `LecturerInput`, `AssignedSession` frozen dataclasses for ORM-detached solver input; `SolverConstraint` dataclass for violation output
  - Created `backend/constraints/graph.py` — slot order constants (s1–s7, AM/PM boundary at index 3); `ConflictEdge` and `ConflictGraph` dataclasses; `ConflictGraph.neighbors()` and `conflicts_between()` methods; `derive_lecturer_overlap_conflicts`, `derive_student_overlap_conflicts`, `derive_unit_session_overlap_conflicts` structural derivation functions; `build_conflict_graph` aggregator; assignment-based violation checks: `check_room_double_booking`, `check_room_capacity`, `check_lunch_crossing`, `check_off_timetable`, `check_lecturer_overlap`, `check_student_overlap`, `check_unit_session_overlap`, `check_lecturer_availability`; `compile_assignment_violations` aggregator
  - Created `backend/constraints/__init__.py` — re-exports all public symbols
  - Created `backend/tests/__init__.py` and `backend/tests/test_constraints.py` — 38 pytest fixture-based tests covering all constraint types, conflict graph construction, positive and negative cases
  - Added `pytest>=8.0.0` to `backend/requirements.txt`
  - No user-facing validation API added; no solver CP-SAT model; module is pure Python with no SQLAlchemy dependencies
  - All 38 tests pass

- **Unit 41: Backend Solver Input Snapshot Builder**
  - Created `backend/solver/types.py` — `RoomSnapshot`, `SessionSnapshot`, `AvailabilitySnapshot`, `LockedAssignment`, `TimetableConstants`, `SolverInputSnapshot` frozen dataclasses; `ORDERED_DAYS` (Monday–Friday), `ORDERED_SLOTS` (s1–s7), `AM_SLOTS`, `PM_SLOTS`, `AM_PM_BOUNDARY_INDEX` (3), `SESSION_TYPE_ORDER`; `TIMETABLE_CONSTANTS` singleton with all schedule grid constants
  - Created `backend/solver/snapshot.py` — `SnapshotIntegrityError` for defensive rejections; `build_snapshot_from_data(rooms, sessions, availability, saved_assignments)` pure builder (no DB access); `build_solver_input_snapshot(db)` DB loader using SQLAlchemy selectinload; `_validate_saved_assignments` defensive checks (missing session, missing room, invalid slot, lunch crossing, off timetable, room capacity, room double-booking); `_extract_conflict_pairs` per-category deduplication from Unit 40 conflict graph; all output collections sorted deterministically (rooms by name, sessions by unit_code/type_order/id, availability by lecturer_id, assignments by day/room/slot/session_id, conflict pairs sorted)
  - Created `backend/solver/__init__.py` — re-exports all public symbols
  - Created `backend/tests/test_snapshot.py` — 41 fixture-based tests covering: DTO fields, timetable constants (Monday–Friday, s1–s7, AM/PM blocks, lunch gap), snapshot population from all input types, locked assignment extraction, unscheduled session derivation, all three conflict graph types, deterministic ordering for all collections, all 7 defensive integrity checks (missing session, missing room, invalid slot, lunch crossing, off timetable, room capacity, room double-booking including multi-slot overlap), valid edge cases (empty snapshot, no students, AM-only, PM-only)
  - No CP-SAT model, no solver API, no new packages; builder does not query frontend draft state or create/modify assignments
  - All 41 tests pass

- **Unit 42: Backend Solver CP-SAT Module**
  - Added `ortools>=9.15.6755` to `backend/requirements.txt` (installed in backend venv; only this unit uses it)
  - Extended `backend/solver/types.py` with output DTOs — `SolverStatus` enum (`optimal`, `feasible`, `infeasible`, `unknown`); `GeneratedAssignment` frozen dataclass (session_id, day, start_slot, room_id, duration); `SolverRunResult` (status, generated_assignments, locked_assignments preserved from input, unscheduled_session_ids, scheduled_count, unscheduled_count, timed_out, concise message)
  - Created `backend/solver/model.py` — `solve_timetable(snapshot, time_limit_seconds=30.0)` entry function; accepts only a `SolverInputSnapshot`, never touches the DB/API/ORM/frontend draft
  - Modeling: one optional BoolVar per feasible (day, start slot, room) candidate per unscheduled session plus a `scheduled` BoolVar with `sum(candidates) == scheduled` (optional placement → partial results; a session with zero candidates is forced unscheduled, never dropped); candidates violating static hard constraints are never created — room capacity, lunch crossing (must fit AM or PM block), off-timetable, lecturer unavailability (hard for solver even though warning-only in frontend), overlap with locked room occupancy, and overlap with a locked conflict partner's time cells
  - Locked saved assignments are fixed occupied intervals: no variables, excluded at candidate level, returned unchanged; locked-vs-locked warning conflicts (e.g. saved placement during lecturer unavailability) are tolerated and cannot make the model infeasible
  - Constraints: per-(day, room, slot) `AddAtMostOne` for room no-overlap; lecturer/student/unit-session conflict pairs (merged + deduped from the snapshot's three pair lists) enforced as per-time-cell `sum(occ_a) + sum(occ_b) <= 1` between unscheduled pairs; duration contiguity inherent in candidate construction
  - Objective: maximize count of scheduled previously-unscheduled sessions; no soft preferences
  - Determinism: `num_search_workers = 1`, `random_seed = 0`, deterministic model-build order from sorted snapshot collections; explicit timeout via `max_time_in_seconds` with `timed_out` flag (true when search stopped without optimality proof)
  - Updated `backend/solver/__init__.py` — re-exports `solve_timetable`, `DEFAULT_TIME_LIMIT_SECONDS`, `SolverStatus`, `GeneratedAssignment`, `SolverRunResult`
  - Created `backend/tests/test_solver.py` — 24 deterministic fixture tests: result shape, empty snapshot, single placement, locked preservation, locked room occupancy blocking, locked conflict partner blocking, saved warning-state tolerance, room capacity (direct + failure), room no-overlap, lecturer no-overlap (partial + spread), student no-overlap, unit/session overlap in isolation, availability forced placement, fully unavailable lecturer, duration-4 PM-only start, duration exceeding available block, lunch-crossing prevention, objective maximization, explicit partial result, determinism (two runs equal), input snapshot not mutated; shared `assert_valid_solution` helper re-checks every hard constraint on solver output
  - No DB result application, no snapshot builder changes, no Trigger.dev job, no solver API, no frontend changes
  - All 103 backend tests pass

- **Unit 43: Backend Solver Result Application Service**
  - Created `backend/solver/apply.py` — `apply_solver_result(db, result)` service that applies a `SolverRunResult` to the saved timetable assignment state; lives inside `backend/solver/` with a clean solver-facing boundary and is **not** wired to any request handler or job
  - Structured internal result object `SolverResultApplication` (status, scheduled_count, unscheduled_count, is_partial, newly_scheduled_session_ids, remaining_unscheduled_session_ids, preserved_locked_count, concise message) for future solver job/API status surfacing; `ApplicationStatus` enum (`applied`, `partial`, `failed`); `SolverResultApplicationError` (code + message) raised after rollback
  - Locked preservation: the existing rows in `timetable_assignments` are treated as the authoritative locked solver inputs — they are never deleted or mutated; generated placements are inserted alongside them. `preserved_locked_count` reflects the actual saved rows
  - Persistence: generated assignments for previously unscheduled sessions are inserted in a single transaction (`db.commit()`); no `duration` column on the assignment row (duration derives from the session, per Unit 31)
  - Failure safety: a result whose status is not `OPTIMAL`/`FEASIBLE` (or a missing/invalid result object) triggers `db.rollback()` and raises `SolverResultApplicationError` (`solver_failed` / `invalid_result`) without mutating saved state; persistence errors roll back and raise `persistence_failed`
  - Defensive validation (backend safety, runs before commit, rolls back on first violation): duplicate generated session, unknown session id, unknown room id, invalid slot id (must be `s1`-`s7`), invalid day, lunch crossing, off-timetable, room capacity < student count, generated overwriting a locked saved assignment (`would_overwrite_locked`), and room double-booking — generated-vs-locked and generated-vs-generated — all surfaced as `blocking_integrity_violation`
  - Partial-success metadata: `is_partial = unscheduled_count > 0`; status `partial` when sessions remain unscheduled, `applied` otherwise
  - Diagnostic logging via `structlog.get_logger` (`solver_result_applied`, `solver_result_apply_rejected`, `solver_result_apply_failed`) bound with solver status and counts
  - Updated `backend/solver/__init__.py` — re-exports `apply_solver_result`, `ApplicationStatus`, `SolverResultApplication`, `SolverResultApplicationError`
  - Created `backend/tests/conftest.py` — isolated in-memory SQLite `db` fixture (FK enforcement enabled) so DB-backed services can be tested without Postgres; no new package required
  - Created `backend/tests/test_apply.py` — 19 tests using real ORM models + real solver DTOs: happy-path persistence, metadata counts, locked preservation, partial result, failed-result no-mutation (infeasible + unknown), invalid result object, all defensive checks (duplicate, unknown session/room, invalid slot, lunch crossing, off-timetable, capacity, overwrite-locked, double-book vs locked + vs each other), transaction rollback leaves no partial state, empty-result no-op
  - No CP-SAT modeling, snapshot builder, Trigger.dev job, solver API route, or frontend changes added
  - All 122 backend tests pass

- **Unit 44: Jobs Boundary and Trigger.dev Setup**
  - Created top-level `jobs/` — a standalone Node/TypeScript Trigger.dev v3 project sitting beside `frontend/` and `backend/` (Trigger.dev is Node-based, so it cannot live inside the Python `backend/` package); this matches the `jobs/` boundary in `architecture-context.md`
  - `jobs/package.json` — declares `@trigger.dev/sdk ^3.3.17` (resolved + installed 3.3.17) and dev deps `trigger.dev` (CLI), `typescript`, `@types/node`; scripts `login`, `dev`, `deploy`, `typecheck`
  - `jobs/trigger.config.ts` — `defineConfig` with `runtime: "node"`, `logLevel: "info"`, `maxDuration: 60`, `dirs: ["./src/trigger"]`; `project` is a placeholder ref (`proj_REPLACE_WITH_YOUR_PROJECT_REF`) that must be replaced with the dashboard project ref before `npm run dev` connects
  - `jobs/src/trigger/testJob.ts` — minimal registered `test-job` task; typed `TestJobPayload` (message, correlationId, timestamp) + `TestJobResult`; emits structured `test_job_started` / `test_job_completed` logs via `logger.info` and returns a completion object; contains **no** solver logic, no timetable queries, no DB access, no result persistence — comments document the orchestration-only boundary
  - `jobs/tsconfig.json` — strict TypeScript, `noEmit`, ES2022/Bundler resolution; `npm run typecheck` passes clean
  - `jobs/.env.example` — documents `TRIGGER_ACCESS_TOKEN` (non-interactive auth) and `TRIGGER_SECRET_KEY` (only for backend-triggered tasks, future); notes the project ref lives in `trigger.config.ts` and that backend service URL/token for solver orchestration are intentionally omitted this unit
  - `jobs/README.md` — boundary rules, env table, local dev commands (`npm install` → `npm run login` → `npm run dev`), how the Trigger.dev dev server differs from running FastAPI, and an explicit "not yet implemented" list (async solver job, start/status API, job-driven persistence, deployment wiring)
  - `jobs/.gitignore` — ignores `node_modules/`, `.trigger/`, `dist/`, `.env`
  - Updated `context/code-standards.md` File Organization — reconciled `backend/jobs/` → top-level `jobs/` with rationale
  - No solver job wired, no solver start/status API, no frontend changes, no backend Python changes

- **Unit 45: Async Solver Job**
  - Created `backend/solver/job.py` — backend-side execution of the async solver job; `SolverJobStatus` enum (`completed`/`partial`/`failed`); frozen `SolverJobPayload` (solver_run_id, correlation_id, optional admin_workspace_id + snapshot_id; `from_dict` parser) — a stable *reference*, never frontend draft state; `SolverJobResult` dataclass (status, solver_run_id, correlation_id, solver_status, sessions_attempted/scheduled/unscheduled, is_partial, timed_out, duration_seconds, started_at, completed_at, message, failure_code, newly_scheduled/remaining_unscheduled ids; `to_dict` for JSON); `run_solver_job(db, payload, *, time_limit_seconds=30.0)` runs the full pipeline `build_solver_input_snapshot` (Unit 41) → `solve_timetable` (Unit 42) → `apply_solver_result` (Unit 43) from **saved** DB state only
  - Failure safety: every step wrapped; snapshot/solve/apply exceptions roll back defensively and return a `failed` `SolverJobResult` (never raises to the caller); the Unit 43 service already rolls back unapplicable results (`solver_failed`). Saved assignment state is guaranteed unchanged on failure. Failure codes: `snapshot_integrity`, `snapshot_error`, `solver_error`, `solver_failed`, `apply_error`
  - Structured logging via `structlog`: `solver_job_started` (bound solver_run_id + correlation_id, started_at), `solver_job_completed` (status, solver_status, duration_seconds, sessions attempted/scheduled/unscheduled, is_partial, timed_out), `solver_job_failed` (step, failure_code, detail)
  - Job contains **no** solver modeling logic — it orchestrates the three backend services; `sessions_attempted = len(snapshot.unscheduled_session_ids)`
  - Created `backend/solver/job_cli.py` — thin process boundary (`python -m solver.job_cli`) the Node Trigger.dev task invokes; self-bootstraps `sys.path` with the backend dir; routes structlog to **stderr** so stdout carries only the result; reads `SolverJobPayload` JSON (stdin or argv[1]), opens a real `SessionLocal`, runs the job, prints `SolverJobResult` JSON on stdout; **always** emits a structured JSON failure doc on stdout even for a malformed payload (`invalid_payload`) or backend setup/import/connection error (`bridge_setup_error`) so the caller can always parse an outcome; exit 0 on completed/partial, 1 on failed; no business logic
  - Updated `backend/solver/__init__.py` — re-exports `run_solver_job`, `SolverJobPayload`, `SolverJobResult`, `SolverJobStatus`
  - Created `jobs/src/trigger/solverJob.ts` — registered `solver-job` Trigger.dev task; typed `SolverJobPayload` (solverRunId, correlationId, optional adminWorkspaceId/snapshotId) + `SolverJobResult`; owns job lifecycle (`solver_job_started`/`solver_job_completed`/`solver_job_failed` logs, timing) and spawns the Python bridge via `child_process` using `python -m solver.job_cli` with `cwd=BACKEND_DIR` + `PYTHONPATH=BACKEND_DIR` (the `-m` form keeps cwd—not `solver/`—on sys.path so stdlib `types` isn't shadowed by `solver/types.py`); validates `BACKEND_DIR`/script exist up front and surfaces Python **stderr** + exit code in the failure result when stdout has no parseable JSON; scans stdout for the last JSON line (robust to log pollution); `BACKEND_DIR` must be an absolute path and `PYTHON_BIN` may be absolute / relative-to-BACKEND_DIR / a PATH command; maps snake_case result doc → camelCase TS result; passes only stable references across the boundary; `maxDuration: 120` (CP-SAT default 30s + headroom); contains no solver/DB logic
  - Verified end-to-end against the real database: the bridge solved 8 sessions optimally, emitted clean stdout JSON, and persisted the generated assignments (`status: completed`)
  - Created `backend/tests/test_solver_job.py` — 13 tests: payload parsing (minimal/full/missing-field), empty DB no-op, end-to-end single-session schedule + persistence, locked preservation + new placement, partial result (room too small → forced unscheduled), payload echo, timing metadata, JSON-serializable result, and three failure paths via monkeypatch (solver exception, unapplicable `UNKNOWN` status, snapshot exception) each asserting `failed` status + saved state preserved
  - Updated `jobs/.env.example` (documented `BACKEND_DIR` / `PYTHON_BIN` bridge vars; backend reads its own `DATABASE_URL`) and `jobs/README.md` (async solver job section, pipeline diagram, boundary properties)
  - No solver start/status API, no frontend solver client/polling/UI, no production Trigger.dev deployment, no soft constraints, no new packages
  - All 135 backend tests pass; `jobs/` `npm run typecheck` passes clean

- **Unit 46: Backend Solver Start and Status API**
  - Created `backend/models/solver_run.py` - persisted `solver_runs` model with explicit API statuses (`pending`, `running`, `succeeded`, `failed`), Trigger job id, correlation id, admin requester id, scheduled/unscheduled counts, partial-success flag, failure code/message, and timestamps
  - Created `backend/alembic/versions/0008_create_solver_runs.py` - adds the `solverrunstatus` enum and `solver_runs` table with status/created indexes
  - Created `backend/schemas/solver.py` - frontend-friendly `SolverRunStatusResponse` that exposes run id, status, optional job id, timestamps, counts, partial-success metadata, and sanitized failure message only
  - Created `backend/services/trigger_client.py` - stdlib-only Trigger.dev dispatch client using `TRIGGER_SECRET_KEY`, optional `TRIGGER_API_URL`, and `TRIGGER_SOLVER_TASK_ID` (`solver-job` default); posts a JSON payload packet to `/api/v1/tasks/{taskId}/trigger` and returns the run id; no new backend package added
  - Created `backend/services/solver_run.py` - start/status service: rejects active `pending`/`running` runs, builds the solver input snapshot from saved DB state for defensive integrity checks, handles no-work/all-scheduled cases as harmless `succeeded` runs, requires rooms when there is unscheduled work, queues only stable references (`solverRunId`, `correlationId`, `adminWorkspaceId`, `snapshotId`) and never frontend draft assignments, marks trigger failures as failed, and returns structured `AppError` responses
  - Created `backend/api/solver.py` and registered it in `backend/api/router.py` - protected `POST /solver/start` and `GET /solver/status/{solver_run_id}` endpoints using the existing `get_current_admin` auth dependency
  - Updated `backend/solver/job.py` - records async job lifecycle into `solver_runs`: `running` on start, `succeeded` on completed/partial job result (with `partial_success` metadata), `failed` on failed result; maps the Unit 45 job statuses to the Unit 46 API statuses without exposing raw Trigger.dev internals
  - Updated `backend/config.py` and `backend/.env.example` - optional Trigger settings (`trigger_api_url`, `trigger_secret_key`, `trigger_solver_task_id`) with safe defaults except the secret key, which is required only when starting a real job
  - Fixed `backend/log/setup.py` - uses `structlog.stdlib.LoggerFactory()` with `add_logger_name`, matching production logging processors and preventing solver-service logs from breaking after the FastAPI app configures logging
  - Updated `backend/tests/conftest.py` - SQLite test fixture now uses `StaticPool` so FastAPI's sync endpoint thread and the test thread share the same isolated in-memory database
  - Created `backend/tests/test_solver_api.py` - 9 route-level tests using a lightweight ASGI caller: start auth, status auth, saved-state-only start payload, Trigger dispatch, active-run rejection, no-work status, defensive integrity failure, trigger failure persistence, status response shape, and structured 404
  - No frontend solver client/polling/UI, no CP-SAT logic changes, no soft constraints, no deployment wiring, no new Python package
  - All 144 backend tests pass

- **Unit 47: Frontend Solver API Client**
  - Created `frontend/src/lib/api/solver.ts` — frontend API client layer for the protected backend solver endpoints (Unit 46); API-client layer only, no solver UI, no polling, no Zustand solver state
  - `SolverRunStatus` union (`pending` | `running` | `succeeded` | `failed`) mirrors the backend `SolverRunStatus` enum; `SolverRunId` alias type for run identifiers
  - `SolverRunStatusResponse` DTO matches the backend `SolverRunStatusResponse` JSON shape exactly: `solver_run_id`, `status`, `job_id` (nullable), `created_at`, `updated_at`, `scheduled_count` (nullable), `unscheduled_count` (nullable), `partial_success`, `failure_message` (nullable) — backend snake_case field names used consistently with existing API-client conventions
  - `startSolverRun()` — `POST /solver/start` with **no request body**; the backend solves the *saved* timetable state, so no frontend draft assignment payload is ever transmitted; the shared Unit 6 `apiRequest` base client attaches the Supabase auth token
  - `getSolverRunStatus(runId)` — `GET /solver/status/{runId}` (run id `encodeURIComponent`-escaped); also routed through the authenticated base client
  - `parseSolverError` + `readSolverError` — solver-specific structured-error parsing; reads the backend `{ error: { code, message } }` envelope (stored on `ApiRequestError.detail` by the base client) and maps the five backend codes (`solver_run_active`, `solver_integrity_failed`, `solver_no_rooms`, `solver_job_trigger_failed`, `solver_run_not_found`) onto specific user-facing messages covering solver-already-running, saved-state-not-usable / defensive-check-failed, job-trigger-failed, and run-not-found; unknown errors are re-thrown unchanged (nothing swallowed silently)
  - `SolverErrorCode` union documents the backend error-code contract for later integration; all types and functions exported build-safe for the future solver UI/polling unit
  - No new package required; no TanStack Query polling, no Run Solver button behavior, no editing-disabled state, no timetable refresh, no assignment-save changes, no backend changes, no mock solver data
  - Frontend build (`npm run build`) succeeds with zero TypeScript errors

- **Unit 48: Frontend Async Solver Integration**
  - Created `frontend/src/features/timetable/useSolverRun.ts` — solver run lifecycle hook owning the full async flow against **saved** timetable state (never sends draft); `useMutation(startSolverRun)` seeds the status cache with the start response (so the initial state shows before the first poll) and tracks `activeRunId`; `useQuery(['solver-status', activeRunId])` enabled only when a run is tracked, with a function-form `refetchInterval` that polls every 2000ms while `pending`/`running` and returns `false` on `succeeded`/`failed` (TanStack Query tears the interval down on unmount); a terminal-transition `useEffect` (guarded by `handledRunRef`) fires `onSucceeded`/`onFailed` exactly once per run via callback refs; exposes `runStatus`, `isActive`, `isStarting`, `startError`, `start`, `dismiss`
  - Created `frontend/src/features/timetable/SolverStatusPanel.tsx` — running / success / partial-success / failure / start-error banner using the solver tokens (`--solver-running-bg`, `--solver-success-bg`, `--solver-partial-bg`, `--solver-failure-bg`); shows real `scheduled_count`/`unscheduled_count` from the backend run status; partial result reached when `partial_success` or `unscheduled_count > 0`; non-running states are dismissible (`onDismiss`); not color-only (icons: Loader2/CheckCircle2/AlertTriangle/XCircle), `role="status"` `aria-live="polite"`
  - `timetable.tsx` — added `useSolverRun({ onSucceeded })`; `onSucceeded` invalidates `['assignments']` and `['schedulable-sessions']`, which (via the existing saved-assignments effect) refetches saved state and resets the draft from the latest saved data; a failed run refetches nothing so saved state stays stable; `editingDisabled = solver.isStarting || solver.isActive`
  - Solver start gating consolidated into a single `solverDisabledReason` (and `canRunSolver = reason === null`) covering, in priority order: run in progress → no rooms → required data still loading (`rooms`/`schedulableSessions`/`savedAssignments` undefined) → blocking/warning validation counts → unsaved draft changes (`isDirty`, since the solver runs from saved state). All editing handlers (`handleSelectSession`, `handleCellClick`, `handleUnschedule`, `handleSave`, `handleDragStart`) early-return when `editingDisabled`; added `handleRunSolver` guarded by `canRunSolver`
  - `TimetableActionBar` — `canRunSolver`/`solverDisabledReason` now required; added `editingDisabled` and wired `onRunSolver`; Run Solver button shows a `Loader2` + "Solving…" running indicator and is disabled (with the reason as its `title`) whenever a run is active; Save button additionally disabled while `editingDisabled`; status line shows "Editing is disabled while the solver runs." during a run, otherwise the disabled reason (error/warning/muted colored by severity); the "View details" violation/warning panel is unchanged
  - Editing lockout threaded through the grid/pool: `editingDisabled` passed to `TimetableGrid` → `GridCell` (droppable `disabled`, click-placement off) → `ScheduledSessionCard` (draggable `disabled`, move-select off, unschedule button hidden), and `UnscheduledPool` → `UnitGroup` → `UnscheduledSessionCard` (draggable `disabled`, click off, dimmed)
  - Polling runs only while active, stops on terminal status, and cleans up on unmount; partial-success warning shows real counts; failed runs keep timetable/draft stable and surface an actionable message; sessions the solver cannot place stay in the unscheduled pool (derived from draft, which excludes only solver-placed sessions); no backend validation API added
  - Frontend build (`npm run build`) succeeds with zero TypeScript errors; no new lint errors introduced (the 5 pre-existing lint problems — protected `components/ui/*` fast-refresh warnings and the Unit 33 saved-assignments set-state-in-effect — are unchanged)

- **Solver run pipeline fixes (post-Unit 48 debugging, 2026-06-12)**
  - Diagnosed the 502 from `POST /solver/start`: the backend's own `solver_job_trigger_failed` `AppError` (status 502), raised because `TRIGGER_SECRET_KEY` was only set in `jobs/.env` — the backend reads `backend/.env`, so `trigger_solver_job` failed with "secret key is not configured" on every start. Added `TRIGGER_SECRET_KEY` / `TRIGGER_API_URL` / `TRIGGER_SOLVER_TASK_ID` to `backend/.env` (and they remain documented in `backend/.env.example`)
  - Fixed payload double-encoding in `backend/services/trigger_client.py`: the trigger request sent `payload` as a pre-serialized JSON **string** (`json.dumps(payload)` + `options.payloadType`); Trigger.dev delivered it to the task verbatim as a string, so `payload.solverRunId` was `undefined`, the bridge payload lost all fields (`JSON.stringify` drops `undefined`), and `job_cli` failed with `invalid_payload` — leaving the `solver_runs` row stuck in `pending`. The client now sends `payload` as a plain JSON object
  - Hardened `jobs/src/trigger/solverJob.ts`: the task now parses a string payload defensively and returns a structured `invalid_payload` failure when `solverRunId`/`correlationId` are missing, instead of silently bridging an empty payload
  - Hardened `backend/services/solver_run.py`: `_reject_active_run` now expires active runs older than `STALE_RUN_CUTOFF` (10 min) as `failed` / `stale_run` instead of blocking all future solver starts forever when a job dies without reporting back (the task itself is capped at 120s)
  - Verified end-to-end against the live stack (uvicorn + `trigger.dev dev` + Supabase): `start_solver_run` → Trigger.dev run → Python bridge → CP-SAT → `apply_solver_result` → status write-back; run reached `succeeded` with 12/12 sessions scheduled and assignments persisted
  - Operational note: dev-environment solver runs execute only while `npx trigger.dev dev` is running in `jobs/`; if it is down, runs queue at Trigger.dev and the run stays `pending` until it reconnects (or is expired by the stale-run guard)

- **Unit 49: Backend Observability**
  - Created `backend/observability/` package (new boundary; documented in `code-standards.md` File Organization and `architecture-context.md` Stack). Layers exception capture + correlation context on top of the existing `backend/log/` structlog foundation rather than replacing it
  - `observability/sentry.py` — `configure_sentry()` initialises Sentry only when `SENTRY_DSN` is set; the SDK import is lazy and every path is defensive, so the backend runs normally when the DSN is absent **or** `sentry-sdk` is not installed (emits `sentry_disabled` / `sentry_unavailable` / `sentry_enabled` structured logs). `send_default_pii=False` and `traces_sample_rate=0.0`; `LoggingIntegration(level=INFO, event_level=None)` keeps log records as breadcrumbs but never auto-promotes them to events — so the many expected `logger.error`/`logger.warning` solver/validation failures are not mistaken for crashes. `capture_unexpected_exception(exc, **tags)` is a no-op when disabled, isolates tags via `new_scope` where available, and never raises
  - `observability/request_context.py` — `RequestContextMiddleware` (pure ASGI, never reads the request body) mints or reuses an `X-Request-ID` per HTTP request, binds it into structlog contextvars (so every log line carries `request_id`), stashes it on `scope["state"]` for exception handlers, and echoes it back as a response header; `get_request_id(request)` resolves it from `request.state`
  - `observability/safe_logging.py` — safe log payload conventions: `MAX_LOGGED_IDS` (20) and `id_sample()` for bounded id logging; module documents the rule that logs prefer counts/IDs and never include tokens, secrets, database URLs, or full student payloads
  - `log/setup.py` — added `structlog.contextvars.merge_contextvars` as the first processor so middleware-bound `request_id` flows into all logs without each call site passing it
  - `main.py` — calls `configure_sentry()` after `configure_logging()`; adds `RequestContextMiddleware` (outermost of our middleware); the catch-all `Exception` handler now logs `unhandled_exception` (with request_id, method, path, error_type) and calls `capture_unexpected_exception` before returning the generic 500 (internals never leak to the caller)
  - `api/errors.py` — `app_error_handler` now logs expected `AppError`s at **warning** level (`app_error` with code/status/path/method); these structured product errors are returned normally and never sent to Sentry
  - `services/assignment.py` — added `assignment_save_requested` (count), `assignment_save_succeeded` (saved_count), and `assignments_cleared` logs; all defensive blocked-placement rejections route through a `_reject_save()` helper that emits a warning-level `assignment_save_rejected` with the code plus IDs/counts (session_id, room_id, capacity, student_count, day, slot) — never full student lists or payloads
  - `services/solver_run.py` — added `solver_start_requested` (admin id), `solver_start_rejected` for the not-solver-ready paths (snapshot-integrity, no-rooms, run-already-active — each with the API error code), `solver_start_no_work` for the harmless succeeded cases, `solver_run_queued` (solver_run_id, correlation_id, job_id, sessions_attempted), `solver_start_trigger_failed`, `solver_run_expired_stale`, and `solver_status_lookup` (found/status) — correlation via solver_run_id + correlation_id
  - Async solver job lifecycle (`solver_job_started`/`completed`/`failed` with duration + counts, bound to solver_run_id/correlation_id) and solver result application logs (`solver_result_applied`/`apply_rejected`/`apply_failed`) already existed from Units 45/43 and satisfy the remaining logging-events scope
  - `config.py` — added `sentry_dsn: str | None = None` and `environment: str = "development"`; `.env.example` documents `SENTRY_DSN` and `ENVIRONMENT` with the no-secret-logging note
  - `requirements.txt` — added `sentry-sdk>=2.0.0` (installed `sentry-sdk 2.62.0` in the backend venv); no other new package
  - Out of scope (not implemented, per spec): frontend Sentry, frontend error boundaries, new API/solver/validation behavior, deployment configuration
  - Verified: all 144 backend tests pass; app imports cleanly with Sentry disabled (no DSN); middleware confirmed to bind `request_id` into logs, echo the `X-Request-ID` response header, and reuse an inbound id

- **Unit 50: Frontend Error Handling and Observability**
  - Installed `@sentry/react` (only new frontend dependency this unit)
  - Created `frontend/src/lib/observability/sentry.ts` — `initSentry()` initialises Sentry only when `VITE_SENTRY_DSN` is set; every path is defensive so the app runs normally when the DSN is absent and no setup/capture call ever throws; `tracesSampleRate: 0` + `sendDefaultPii: false` (crash reporting only, no PII/tracing in v1); `captureUnexpectedError()` no-op when disabled; `isSentryEnabled()` accessor
  - `frontend/src/main.tsx` — calls `initSentry()` before `createRoot` mounts the app
  - Created `frontend/src/components/error/ErrorBoundary.tsx` — app-level class error boundary; `getDerivedStateFromError` flips to fallback, `componentDidCatch` reports to Sentry via `captureUnexpectedError` (with component stack); reload handler calls `window.location.reload()`
  - Created `frontend/src/components/error/AppErrorFallback.tsx` — safe fallback screen for unexpected crashes; explains something unexpected happened, **no** stack traces, single Reload action, token-driven (serif title, `--state-error` accent, surface card) preserving the academic visual language
  - `frontend/src/App.tsx` — wrapped the full app shell with `<ErrorBoundary>` (outermost, around `QueryClientProvider`/`BrowserRouter`/`AuthProvider`/routes)
  - Created `frontend/src/lib/errors.ts` — `getErrorMessage(error, fallback)` shared helper that normalises `ApiRequestError`/`Error`/unknown into a user-facing string; centralises query/mutation error messaging
  - Created `frontend/src/components/error/ErrorState.tsx` — shared inline error panel for API/load failures; `--state-error` border + `--state-error-bg`, `AlertTriangle` icon (not color-only), `role="alert"`, optional title + `onRetry` "Try again" action; documented as system/API errors only (never validation feedback)
  - Timetable assignment-load failure: `timetable.tsx` now reads `isError`/`error`/`refetch` from the `['assignments']` query and renders an `ErrorState` banner ("Saved timetable could not be loaded") with a retry action above the canvas — previously this error was silent
  - Save failure: `saveMutation.onError` now uses `getErrorMessage` with an actionable fallback ("Your timetable changes were not saved. Please try again."); still surfaced via `TimetableActionBar` `saveError`
  - Solver start failure: already surfaced via `SolverStatusPanel` `startError` (Unit 48); unchanged
  - Solver status polling failure: `useSolverRun` now exposes `statusError` (set only while a run is tracked and the poll errors; TanStack Query keeps retrying on its interval); `SolverStatusPanel` renders a warning banner ("Solver status could not be refreshed") that keeps editing locked while the run continues on the backend
  - Solver completion-refresh failure: the `onSucceeded` `['assignments']` invalidation/refetch failure is covered by the same assignment-load `ErrorState` banner
  - Validation distinction preserved: blocking violations and warning issues remain product state in `TimetableActionBar` (error/warning colors, "View details" panel) and are never routed through Sentry, the error boundary, or `ErrorState`
  - Verification checklist (all met): Sentry configured from env vars ✓; app runs with DSN absent ✓; app-level error boundary exists ✓; crashes show safe fallback without stack traces ✓; assignment-load errors visible + actionable ✓; save errors visible + actionable ✓; solver start/status errors visible + actionable ✓; validation warnings not treated as crashes ✓; blocking validation stays product feedback ✓; all new UI token-driven with no hardcoded hex ✓; frontend build succeeds ✓
  - Updated `frontend/.env.example` — documented `VITE_SENTRY_DSN` (optional; app runs without it; public client key) and `VITE_ENVIRONMENT`
  - Out of scope (not implemented, per spec): backend observability, new validation/assignment/solver/drag-drop behavior, styling outside established tokens
  - `npm run build` succeeds with zero TypeScript errors; `npm run lint` shows only the 5 pre-existing problems (3 `components/ui`/auth fast-refresh warnings + the Unit 33 saved-assignments set-state-in-effect) — no new lint errors introduced

- **Unit 51: Backend Constraint and Solver Test Suite**
  - Created `backend/tests/test_constraint_and_solver_suite.py` — a single cohesive, fixture-driven suite (36 tests) that verifies backend solver correctness independently of frontend UX validation; fixtures use the same DTO/domain shapes the solver input builder and result-application service consume in production (no frontend draft state, no production mock state); solver runs use an explicit small time limit (`SOLVE_LIMIT = 10.0`) and the module's deterministic settings
  - **Constraint mirror** (Unit 40 `constraints/`): assignment-based checks for lecturer conflict, student conflict, lecturer unavailable slot, unit/session overlap, room double-booking (incl. multi-slot overlap), room capacity failure, lunch crossing, and off-timetable boundary — each with a positive (flagged) and negative (not-flagged) case asserting product outcomes (constraint type + severity + affected sessions)
  - **Conflict graph** (Unit 40 `build_conflict_graph`): determinism across repeated builds, per-category edge coverage (unit/student edges present, no spurious lecturer edge for distinct lecturers), and neighbor lookup — the one place structural output *is* the product
  - **Snapshot builder** (Unit 41 `build_snapshot_from_data`): compiles real-format `RoomSnapshot`/`SessionSnapshot`/`AvailabilitySnapshot`/`LockedAssignment` into a `SolverInputSnapshot`, extracting locked assignments, deriving the unscheduled set, and emitting lecturer/unit conflict pairs; plus a determinism check
  - **CP-SAT solver** (Unit 42 `solve_timetable`): unscheduled session successfully scheduled; locked saved assignment respected (returned unchanged, never re-solved); room capacity failure leaves session unscheduled; solver never emits a lunch-crossing placement; duration exceeding available block stays unscheduled; lecturer/student/unit-session conflicts force partial results; lecturer-unavailable forces exact placement; explicit partial result when not all sessions fit; determinism across two runs
  - **Result application** (Unit 43 `apply_solver_result`, DB-backed via the `db` SQLite fixture + real ORM models): successful assignments persisted as real `timetable_assignments` rows; partial result persists only the scheduled placements with `is_partial` metadata
  - **Failure safety**: failed (`INFEASIBLE`) run rejected with `solver_failed` and saved assignments byte-for-byte unchanged; `UNKNOWN`/timed-out result with a generated placement never persists it; defensive rejection (generated placement double-booking an existing saved row) rolls back with `blocking_integrity_violation` and corrupts nothing
  - All 12 required spec cases are covered and labelled inline; assertions verify product outcomes (scheduled/persisted/rejected), not solver internals
  - No new dependencies (pytest already present from Unit 40); no pytest config file needed — `python -m pytest` run from `backend/` discovers `tests/` and is the backend test command; no frontend/browser/deployment changes, no new solver features, constraints, soft constraints, or user-facing validation
  - Verified: full backend suite is green — **180 tests pass** (144 prior + 36 new)

- **Unit 52: Frontend Timetable Validation and Interaction Test Suite**
  - Added the frontend test toolchain (only new dev dependencies this unit): `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`. Created `frontend/vitest.config.ts` (jsdom environment, globals, `src/test/setup.ts` setup file, `css: false`, Tailwind plugin intentionally omitted) and `frontend/src/test/setup.ts` (jest-dom matchers + RTL `cleanup` after each test). Added `test` (`vitest run`) and `test:watch` scripts to `frontend/package.json` — the frontend test command is `npm test`
  - Created `frontend/src/test/fixtures.ts` — factories producing objects shaped exactly like the real API DTOs (`Room`, `SchedulableSession`, `AssignmentResponse`, `Lecturer`, `SolverRunStatusResponse`) and the `TimetableAssignment` rendering model; kept under `src/test/`, outside production feature state, so no test data can leak into the app
  - **Pure validation-helper tests** (high-value, zero brittleness): `frontend/src/lib/validation/blocking.test.ts` asserts all four blocking rules reject before entering the draft (room double-booking incl. multi-slot overlap, room capacity too small, crossing lunch, running off the timetable), that a move excludes the session's own old position, and that `getBlockingViolatorIds` (the auto-unschedule source) flags capacity and double-booking violators; `frontend/src/lib/validation/warning.test.ts` asserts the warning rules allow placement but flag it (lecturer conflict, student/unit-session overlap, lecturer-availability conflict) and do not fire across different days
  - **Presentational component tests** (visible UI outcomes): `SolverStatusPanel.test.tsx` covers the idle/starting/running/success/partial/failure/start-error/status-error display states; `TimetableGrid.test.tsx` covers no-room (renders no grid), weekday/room/lunch rendering, a scheduled card rendered from assignment data, and the non-color-only warning indicator; `UnscheduledPool.test.tsx` covers empty/loading/error/grouped rendering
  - **TimetablePage integration suite** (`frontend/src/routes/timetable.test.tsx`): mocks the API client modules (`rooms`/`sessions`/`assignments`/`lecturers`/`solver`), `@/lib/supabase`, and the `AppFrame` shell; wraps the page in a real `QueryClientProvider` + `MemoryRouter`. Covers: no-room empty state vs grid render; saved assignments loading into draft state (on the grid, removed from the pool); manual click-based scheduling updating draft state only (Save enabled, nothing persisted); successful save persisting the exact draft payload through `saveAssignments` and resetting the dirty state on refetch; failed save leaving the draft visible and unsaved with the error surfaced; solver disabled while a validation warning exists (and not started); solver enabled with no issues and a run started on click (running banner shown); and automatic unscheduling — when a session's student count grows past the room capacity (driven via `queryClient.setQueryData`), the draft assignment is removed and the session returns to the unscheduled pool
  - Drag/drop outcome is exercised through the equivalent, reliable click-based scheduling path rather than brittle low-level pointer simulation, per the spec's guidance
  - Verified: `npm test` → **43 frontend tests pass** (6 files); `npm run build` succeeds with zero TypeScript errors (test files type-check under `tsc -b` and are excluded from the bundle); `npm run lint` shows only the 5 pre-existing problems (4 `components/ui`/auth fast-refresh exports + the Unit 33 saved-assignments set-state-in-effect) — no new lint errors from the test suite
  - Out of scope (per spec, not added): backend tests, new validation rules, new API routes, new solver behavior, new product features, or mocked production state

- **Unit 53: Full V1 Acceptance Flow**
  - Verification/documentation unit only — no new features, architecture, soft constraints, imports/exports, multi-admin behavior, or student/lecturer-facing views added (confirmed against spec Out of Scope)
  - Created `docs/v1-acceptance-flow.md` — the v1 acceptance checklist/report: environment, date (2026-06-13), test account/context (single Supabase admin, no sensitive credentials), per-step pass/fail for all 23 acceptance steps with evidence sources, spec verification checklist (all 10 items checked), defects, and follow-ups
  - Executed automated evidence for this pass: backend `python -m pytest` → **180 passed**; frontend `npm test` → **43 passed** (6 files); frontend `npm run build` → success, zero TS errors; backend `import main` smoke → `TTS3 API` loads cleanly with Sentry init
  - Each acceptance step mapped to verifying coverage: steps 1, 21, 22 confirmed against the prior **live** stack run (uvicorn + `trigger.dev dev` + Supabase, solver reached `succeeded` 12/12 — recorded post-Unit 48); steps 2–20 and 23 confirmed via the Unit 52 `timetable.test.tsx` integration suite + validation-helper tests (draft state, manual scheduling, save behavior, refresh-discards-draft, blocking rejection, warning allow+flag, solver gating, partial result, auto-unschedule) and backend service coverage
  - No v1-blocking defects found; both suites and the build are green
  - Follow-ups (out of Unit 53 scope, recorded not hidden): fresh fully-interactive human click-through against the running browser app; production Trigger.dev deployment wiring (dev runs require `trigger.dev dev` up, else queue as `pending`); frontend bundle code-splitting (~862 kB / 255 kB gzip single chunk); 5 pre-existing lint warnings unchanged

- **Unit 55: Backend Deployment to Railway** (config + docs done in-repo; deploy + migrations are manual)
  - Created `backend/railway.json` — pins `builder: NIXPACKS`; `deploy.startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT` (Railway injects `$PORT`; `main:app` with `backend/` as working dir per the established import convention); `healthcheckPath: /health`, `healthcheckTimeout: 100`, `restartPolicyType: ON_FAILURE`, `restartPolicyMaxRetries: 10`
  - Deliberate migrations honored: the start command does **not** run Alembic; `docs/railway-deployment.md` documents running `railway run alembic upgrade head` once after config and verifying with `railway run alembic current` (head `0008_create_solver_runs`); production schema must not be modified outside Alembic
  - Pinned `python-dotenv>=1.0.1` in `backend/requirements.txt` — `alembic/env.py` imports `dotenv`, which was only transitively present in the local `.venv`; without an explicit pin the production migration command fails in a clean Nixpacks build (real gap closed, in scope as the production migration process)
  - Created `docs/railway-deployment.md` — deployment guide: monorepo Root Directory must be `backend`; server-side env var table (`DATABASE_URL`, `SUPABASE_URL`, `CORS_ORIGINS`, `ENVIRONMENT`, optional `SENTRY_DSN`, optional Trigger.dev vars; `PORT` auto-injected); `CORS_ORIGINS` is a JSON list set to the exact Vercel origin (+ optional explicit local dev origin) with an explicit no-`["*"]`-in-production rule (app sends `allow_credentials=True`); deliberate migration process; security "must NOT expose to frontend" list (`DATABASE_URL`, service role key, Trigger secret, backend Sentry DSN, JWT secrets); manual setup steps; verification checklist mapped to the spec; deployed-URL placeholder
  - Verified in-repo: backend imports cleanly via the venv (`main.app` = `TTS3 API`); `/health` and `/auth/verify` routes present; `alembic heads` reports `0008 (head)` — matching the documented head
  - Out of scope (not done, per spec): Trigger.dev worker deployment, new backend features, solver/architecture changes, Redis/cache infra, multi-tenant behavior
  - Remaining (manual, cannot be done from repo): create the Railway service + connect repo, set Root Directory `backend`, add server env vars, deploy and confirm `/health`, run `alembic upgrade head` deliberately and check `alembic current`, record the deployed URL in `docs/railway-deployment.md`, set Vercel `VITE_API_BASE_URL` to the live backend URL and redeploy the frontend, confirm `CORS_ORIGINS` contains the Vercel origin, and run the health/protected-endpoint/CORS verification on the live URL

- **Unit 54: Frontend Deployment to Vercel** (config + docs done in-repo; deploy is manual)
  - Created `frontend/vercel.json` — pins `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist`, `installCommand: npm install`, and an SPA fallback rewrite (`/(.*)` → `/index.html`) so React Router deep links resolve; static assets are served before rewrites so hashed `/assets/*` are unaffected
  - Created `docs/vercel-deployment.md` — deployment guide: monorepo Root Directory must be `frontend`; documents the four public env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, optional `VITE_SENTRY_DSN`/`VITE_ENVIRONMENT`); explicit security "must NOT configure" list (service role key, `DATABASE_URL`, Trigger.dev secrets, backend Sentry DSN, JWT secrets); manual setup steps; verification checklist; placeholder for the deployed URL
  - Noted the `VITE_API_BASE_URL` cross-dependency: dev uses `/api` proxy, Vercel needs an absolute backend URL; until Unit 55 deploys the backend, API-backed pages will fail (Supabase auth still works) — documented as a temporary limitation per spec
  - Re-verified production build locally: `npm run build` → success, single ~862 kB / 255 kB-gzip chunk (pre-existing code-split follow-up), zero TS errors
  - No backend deploy, DB migrations, Trigger.dev production wiring, new features, or auth-provider changes (spec Out of Scope honored)
  - Remaining (manual, cannot be done from repo): create Vercel project + connect repo, set Root Directory `frontend`, add env vars (Production scope), deploy, record deployed URL in `docs/vercel-deployment.md`, run signed-out redirect + login/signup + deep-link verification on the live URL

- **Unit 57: Final V1 Scope Guard and Hardening Pass** (verification + hardening only — no features added)
  - Verification/hardening unit per spec: a full scope, architecture, UX, and safety pass confirming the app matches the intended v1 product without accidental v2 complexity. **No v1 defects were found, so no corrective code changes were required** — the only change in this unit is this progress-tracker update (honoring the user's "only change things if you need to" and the spec's no-dumping-ground rule)
  - **Scope Guard Checklist — all confirmed NOT introduced** (verified via repo-wide greps + review of `frontend/src/App.tsx` routes, `backend/models/`, and `backend/api/router.py`):
    - blob/object storage — none (no `supabase.storage`, `@vercel/blob`, or S3 usage; only out-of-scope mentions in context docs)
    - Redis/caching infrastructure — none
    - soft constraints — none; `backend/solver/model.py` objective is `Maximize(sum(scheduled_vars))` with an explicit "No soft preferences" comment
    - student-facing views — none; routes are exactly `/login`, `/signup`, and admin-protected `/timetable`, `/rooms`, `/lecturers`, `/students`, `/units`
    - lecturer-facing views — none (the `/lecturers` route is admin CRUD, which is in scope)
    - multi-admin collaboration / multi-tenant organizations / RBAC — none
    - timetable version history — none (Alembic `revision`/`down_revision` IDs are migration-chain metadata, not a versioning feature)
    - user-defined constraint rules — none (constraints are hardcoded / developer-defined)
    - automatic student allocation — none
    - file imports/exports (CSV/Excel/upload/download) — none
  - **Verification Checklist — all pass**:
    1. Frontend-owned validation architecture preserved — `routes/timetable.tsx` holds the draft in local state initialized from saved backend assignments; validation lives in `lib/validation/`
    2. Blocked placements rejected immediately — `handleCellClick`/`handleDragEnd` call `checkProposedPlacement` and return early on any blocking issue, so blocked placements never enter the draft
    3. Warning placements remain visible and block solver — warnings are computed from the draft, flagged on cards (`warningSessionIds`), and folded into solver gating
    4. Any validation issue blocks solver — `solverDisabledReason` is non-null when any blocking violation, warning, or unsaved-dirty state exists (`canRunSolver` false)
    5. Edits persist only through explicit save — draft → DB only via `handleSave`/`saveMutation`; refetch resets the draft from saved state
    6. Backend defensive checks ≠ normal UX validation — `services/assignment.py` `_reject_save` is defensive ("does not change behavior"); warning-level conflicts are deliberately allowed through; `backend/api/` imports `constraints` nowhere and there is no validation/constraints router (invariant 13)
    7. Solver uses the backend constraint mirror — `solver/snapshot.py` calls `constraints.graph.build_conflict_graph`, extracts the lecturer/student/unit conflict pairs, and `solver/model.py` enforces them as no-overlap constraints
    8. No accidental v2 features present (see Scope Guard above)
    9. No blob storage / Redis / soft constraints / version history / role views introduced (see Scope Guard above)
    10. Destructive changes require confirmation — rooms/lecturers/students/units each have a wired delete confirmation `Dialog`; the room dialog communicates the cascade impact ("Any sessions scheduled in this room will need to be rescheduled")
    11. All styling uses tokens — **zero hardcoded hex** across `frontend/src/**/*.{ts,tsx}`; all colors resolve through `var(--token)`
    12. Progress tracker and docs match implementation — confirmed; deployment env docs present (`docs/railway-deployment.md`, `docs/vercel-deployment.md`, `docs/trigger-dev-deployment.md`, `docs/v1-acceptance-flow.md`; `.env.example` for `frontend/`, `backend/`, and `jobs/`)
    13. V1 acceptance flow passes — backend **185 passed** (`python -m pytest`), frontend **43 passed** (6 files, `npm test`), frontend production build **success** (zero TS errors); no v1-blocking defects
  - Additional hygiene confirmed: no `TODO`/`FIXME`/`HACK`/`@ts-ignore`/`@ts-expect-error` markers and no `any` types in source
  - Only non-blocking follow-up unchanged (not a v1 defect): the single ~862 kB / 255 kB-gzip JS chunk (frontend bundle code-splitting), plus the standing manual deploy steps (Units 54–56) and a fresh interactive human click-through
  - Conclusion: the app is a **hardened v1 release candidate**

- **Unit 58: Backend Year-Level Derivation and Enrolment Sync**
  - Added `backend/services/year_level.py` — pure helper `parse_unit_year_level(code)` (first digit, must be 1/2/3, whitespace-stripped) and structured `InvalidUnitCodeError(ValueError)`; reused by schemas, services, and the migration backfill
  - `backend/models/unit.py` — added NOT NULL `year_level` column, `ck_unit_year_level` check constraint (`year_level IN (1,2,3)`), and `back_populates="units"` on the `students` relationship
  - `backend/models/student.py` — added `ck_student_year_level` check constraint and a `units` relationship over the existing `unit_students` join table (`back_populates="students"`, referenced by table name to avoid a cross-module import)
  - `backend/schemas/unit.py` — `UnitCreate`/`UnitUpdate` validate `code` via the parser (422 on invalid first digit) and never accept `year_level`; `student_ids` default changed to `None` so the service can distinguish "omitted" from explicit `[]`; `UnitResponse` includes `year_level`
  - `backend/schemas/student.py` — added `EnrolledUnitSummary` (id/code/name/year_level); `StudentResponse` includes `units` and a computed `unit_count`; year-level validation tightened from 1–5 to 1–3 on create and update
  - `backend/services/unit.py` — `create_unit` derives and stores the year level and defaults enrolment to all students in that year when `student_ids` is omitted (explicit list, including empty, respected verbatim); `update_unit` recomputes `year_level` on code change without replacing the selected student list
  - `backend/services/student.py` — `create_student` auto-enrols the new student into all matching-year units in the same transaction; `update_student` preserves enrolments (a year change never silently drops memberships)
  - `backend/api/units.py` — documented later-frontend query-invalidation expectations (`['units']`, `['students']`, `['schedulable-sessions']`, indirectly `['assignments']`)
  - Migration `backend/alembic/versions/0009_unit_year_level_and_year_constraints.py` — adds the column nullable, backfills by parsing each existing code (fails loudly on an invalid first digit), enforces NOT NULL, then adds both year-level check constraints; head is now `0009`
  - Tests: new `backend/tests/test_year_level_and_enrolment.py` (parser success/failure, schema code validation, unit-create year derivation + default/explicit enrolment, student-create auto-enrolment, update preservation, DB + schema year constraints, response shapes); updated existing solver test fixtures to set `year_level`; backend **215 tests green** (30 new)
  - No frontend, solver, or new dependency changes (per spec scope)

- **Unit 59: Backend Unit Teaching Team and Session-Level Lecturer**
  - `backend/models/unit.py` — added the `unit_lecturers` join table (composite PK on `(unit_id, lecturer_id)`, both FKs `ondelete="CASCADE"`); removed `Unit.lecturer_id`/`lecturer`; added a `lecturers` many-to-many relationship (lazy selectin); `students`/`sessions` relationships unchanged
  - `backend/models/session.py` — added nullable `lecturer_id` FK (→ `lecturers.id`) and a `lecturer` relationship (lazy selectin); kept nullable so a session can exist without a lecturer (then it is not schedulable)
  - `backend/models/__init__.py` — registered `unit_lecturers`
  - `backend/schemas/unit.py` — `UnitCreate`/`UnitUpdate` replace `lecturer_id` with `lecturer_ids` (create requires ≥1, update requires ≥1 when supplied); `UnitResponse` now exposes `lecturers: LecturerSummary[]`
  - `backend/schemas/session.py` — `SessionCreate`/`SessionUpdate` accept optional `lecturer_id`; `SessionResponse` adds `lecturer_id` + `lecturer: LecturerSummary | None` (imports `LecturerSummary` from `schemas.unit`)
  - `backend/services/unit.py` — `_require_lecturers` validates+dedupes the team (422 on unknown); `create_unit` persists the team; `update_unit` may replace the team but rejects removing a lecturer still assigned to one or more of the unit's sessions with a structured `422` (`lecturer_still_assigned`), never silently unsetting
  - `backend/services/session.py` — `create_session` resolves the lecturer (explicit ⇒ must be in team `lecturer_not_in_team`; omitted + one team lecturer ⇒ auto-assign; omitted + multiple ⇒ reject `lecturer_required`); `update_session` validates a new lecturer belongs to the team; `list_schedulable_sessions` filters `Session.lecturer_id IS NOT NULL` and uses `session.lecturer` for display
  - `backend/services/assignment.py` — `_build_response` and eager-load queries source the lecturer from `session.lecturer` (not `unit.lecturer`)
  - `backend/solver/snapshot.py` — DB loader reads `session.lecturer_id` per session and skips lecturer-less sessions; CP-SAT model and pure `build_snapshot_from_data` builder unchanged (full solver integration deferred to Unit 68)
  - Migration `backend/alembic/versions/0010_unit_lecturers_team_and_session_lecturer.py` — creates `unit_lecturers`, backfills it from `units.lecturer_id`, adds nullable `sessions.lecturer_id`, backfills each session from its parent unit's lecturer, then drops `units.lecturer_id`; head is now `0010`
  - Tests: new `backend/tests/test_unit_team_and_session_lecturer.py` (17 tests); updated `test_apply.py`, `test_solver_api.py`, `test_solver_job.py`, `test_constraint_and_solver_suite.py`, and `test_year_level_and_enrolment.py` fixtures to the new team + session-lecturer shape; backend **232 tests green** (17 new)
  - No frontend, CP-SAT model, or new dependency changes (per spec scope)

## In Progress

- Unit 55 — in-repo deliverables complete (`backend/railway.json`, `docs/railway-deployment.md`, `python-dotenv` pinned in `backend/requirements.txt`); blocked on the manual Railway dashboard/CLI steps, the deliberate production migration run, and live-URL verification, which must be done by a human.
- Unit 54 — in-repo deliverables complete (`frontend/vercel.json`, `docs/vercel-deployment.md`); blocked on the manual Vercel dashboard/CLI steps and live-URL verification, which must be done by a human.

## Next Up

- With the final scope guard and hardening pass complete (Unit 57 — hardened v1 release candidate), the remaining work is operational, not feature work: complete the Unit 55 manual Railway steps (service creation, Root Directory `backend`, server env vars, deploy, deliberate `alembic upgrade head`, URL capture, point Vercel `VITE_API_BASE_URL` at the live backend, run health/auth/CORS verification) alongside the remaining Unit 54 manual Vercel steps, so the deployed frontend and backend work end to end. Remaining post-v1 directions unchanged: interactive click-through, production Trigger.dev wiring, WebSocket live solver progress, frontend bundle code-splitting.

## Open Questions

- None from Unit 3.

## Consistency Fixes

- **Stale constraint enum test assertion**: commit ed2cd7e renamed `ConstraintType.LECTURER_AVAILABILITY`'s value to `lecturer_unavailable` (matching the frontend `WarningIssueType` naming) but left `test_constraints.py` asserting the old `lecturer_availability` string; the test now asserts `lecturer_unavailable`.
- **Slot renaming (s5-s8 → s4-s7)**: PM slots are now s4-s7 (s1-s3 AM, s4-s7 PM). Updated `slots.ts`, `lecturers.ts` (frontend), `backend/models/lecturer.py`, and created migration `0004_rename_availability_slots.py` to rename the Postgres enum values in existing databases.
- **architecture-context.md invariant #1**: Updated to state that students are optional (aligns with project-overview.md).
- **Unit field naming**: Standardised on `id` (DB primary key), `code` (course code e.g. HIS101), `name` (unit name). Updated `units.tsx` form state and specs 21/22/24.

## Architecture Decisions

- **Frontend-owned validation and explicit save workflow**: Manual scheduling now edits a frontend draft first. The admin explicitly saves the timetable to persist assignments. The frontend owns all user-facing validation: blocking rules reject impossible placements, warning rules allow placements but block solver execution. Backend assignment validation is defensive only until backend constraints are mirrored later for solver use.
- **Validation severity split**: `blocking` means the placement cannot enter/remain in the timetable draft. `warning` means the placement remains visible but invalid/warning-styled and blocks solver execution.
- **Blocking placement rules**: room double-booking, room capacity too small, crossing lunch, and running off the timetable. Data changes that create these states automatically unschedule affected sessions.
- **Warning placement rules**: lecturer conflicts, student conflicts, unit/session overlap conflicts where applicable, lecturer availability conflicts, and other non-blocking conflicts represented by v1 data. Warning-invalid assignments may be saved.

- **`backend/log/` not `backend/logging/`**: The spec suggests `backend/logging/` for structlog helpers, but naming a local package `logging` shadows Python's stdlib `logging` module, breaking structlog's own imports. The directory is named `log/` instead.
- **Backend runs from `backend/` as working directory**: Import paths in `main.py`, routers, and `alembic/env.py` omit the `backend.` prefix (e.g., `from config import settings`). Commands: `uvicorn main:app --reload` and `alembic upgrade head` are both run from inside `backend/`.
- **shadcn/ui `base-nova` style with Tailwind v4**: shadcn 4.10.0 uses `base-nova` as the
  default style for new Vite projects with Tailwind v4. This style depends on `@base-ui/react`
  rather than `@radix-ui/react-*`. All future component additions should use `npx shadcn@latest add`.
- **`@tailwindcss/vite` plugin (Tailwind v4)**: No `tailwind.config.js` — configuration is
  CSS-based via `@theme` in `index.css`. Design tokens are CSS custom properties in `:root`
  and referenced via `var(--token-name)` in components per `ui-context.md`.
- **Path alias `@/*` → `src/*`**: Configured in both `vite.config.ts` and `tsconfig.app.json`.
  Root `tsconfig.json` also has paths for shadcn CLI compatibility.
- **BrowserRouter in App.tsx**: Router is declared at the App level. `main.tsx` remains a thin
  entry point. Route protection is deferred to the auth unit.
- **Layout components in `src/components/layout/`**: Reusable shell components are kept
  separate from route pages and feature modules. Route pages compose layout primitives.

## Session Notes

- shadcn 4.10.0 `init -d` fails at workspace config loading in monorepo layouts; workaround
  is to let it write `components.json` then add components individually via `npx shadcn@latest add`.
- The `form` component is not available via the `base-nova` registry; it was written manually
  using the standard shadcn form pattern with `react-hook-form` and `@radix-ui/react-label`.
