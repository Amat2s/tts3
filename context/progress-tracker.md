# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

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

- Next unit TBD (solver CP-SAT model or solver job integration)

## Completed

- **Unit 40: Backend Solver Constraint Mirror**
  - Created `backend/constraints/types.py` — `ConstraintType` enum (8 values: room_double_booking, room_capacity, lunch_crossing, off_timetable, lecturer_overlap, student_overlap, unit_session_overlap, lecturer_availability); `ConstraintSeverity` enum (blocking, warning); `CONSTRAINT_SEVERITY` dict mapping each type to its severity (mirrors frontend blocking/warning split); `SessionInput`, `RoomInput`, `LecturerInput`, `AssignedSession` frozen dataclasses for ORM-detached solver input; `SolverConstraint` dataclass for violation output
  - Created `backend/constraints/graph.py` — slot order constants (s1–s7, AM/PM boundary at index 3); `ConflictEdge` and `ConflictGraph` dataclasses; `ConflictGraph.neighbors()` and `conflicts_between()` methods; `derive_lecturer_overlap_conflicts`, `derive_student_overlap_conflicts`, `derive_unit_session_overlap_conflicts` structural derivation functions; `build_conflict_graph` aggregator; assignment-based violation checks: `check_room_double_booking`, `check_room_capacity`, `check_lunch_crossing`, `check_off_timetable`, `check_lecturer_overlap`, `check_student_overlap`, `check_unit_session_overlap`, `check_lecturer_availability`; `compile_assignment_violations` aggregator
  - Created `backend/constraints/__init__.py` — re-exports all public symbols
  - Created `backend/tests/__init__.py` and `backend/tests/test_constraints.py` — 38 pytest fixture-based tests covering all constraint types, conflict graph construction, positive and negative cases
  - Added `pytest>=8.0.0` to `backend/requirements.txt`
  - No user-facing validation API added; no solver CP-SAT model; module is pure Python with no SQLAlchemy dependencies
  - All 38 tests pass

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

- **Unit 37: Frontend Validation Display and Solver Gate Shell**
  - `TimetableActionBar`: replaced `warningCount` prop with `violationMessages: string[]` and `warningMessages: string[]`; added `onRunSolver?: () => void` prop
  - Added **Run Solver** button shell (using `--solver-accent` blue); enabled only when `canRunSolver` is true; HTML `title` attribute carries the full blocked reason for browser tooltip
  - Solver blocked reason message in status area: "N blocking violations and N scheduling warnings must be resolved before running the solver" — uses error color when violations present, warning color when warnings only
  - Added expandable **violation detail panel** (toggled via "View details (N)" / "Hide details" chevron button); renders below the main action bar row with `--bg-muted` background; lists blocking violations with `XCircle` icon and warning issues with `AlertTriangle` icon, grouped by severity
  - `timetable.tsx`: changed from computing just `hasBlockingViolations: boolean` to `blockingViolations: BlockingIssue[]` (full array); passes `.map(v => v.message)` and `warningIssues.map(i => i.message)` to the action bar
  - Verification checklist: blocking rejection visible ✓; warning cards marked ✓; warning detail messages accessible via "View details" ✓; solver disabled when any issue exists ✓; solver disabled state explains why ✓; no backend validation API added ✓
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

- **Unit 33: Frontend Timetable Draft Assignment State**
  - Added `useQuery(['assignments'], listAssignments)` in `timetable.tsx` to load saved assignments from the backend
  - Added `useState<TimetableAssignment[]>` draft initialized from saved assignments via `useEffect`; draft resets clean whenever saved assignments refetch
  - `isDirty: boolean` and `saveError: string | null` state tracks unsaved changes and save failure independently
  - `useMutation(saveAssignments)` sends the complete draft as `AssignmentSaveRequest` on save; on success invalidates `['assignments']` (triggering refetch and draft reset); on error preserves draft and surfaces `saveError`
  - `TimetableGrid` now receives `assignments={draft}` instead of `[]` — scheduled cards render from the draft set
  - `TimetableActionBar` rewritten with props (`isDirty`, `isSaving`, `saveError`, `onSave`): Save Timetable button (enabled when dirty, spinner while saving); unsaved-changes label visible when dirty; save error shown inline; placeholder text shown when clean and no error
  - `toTimetableAssignment` helper converts `AssignmentResponse` → `TimetableAssignment` (field-aligned, no casting needed)
  - Build succeeds with zero TypeScript errors

- **Unit 32: Frontend Assignment API Client**
  - Created `frontend/src/lib/api/assignments.ts` — `AssignmentResponse` DTO (all display fields matching backend `AssignmentResponse`); `AssignmentItem` (session_id, day, start_slot, room_id — save request per-assignment); `AssignmentSaveRequest` (wraps list of `AssignmentItem`); `listAssignments()` (`GET /assignments`); `saveAssignments(input)` (`POST /assignments`); `clearAssignments()` (`DELETE /assignments`)
  - `AvailabilityDay` and `AvailabilitySlot` imported from `@/lib/api/lecturers` (canonical source, avoids duplication); `SessionType` imported from `@/lib/api/sessions`
  - `parseAssignmentSaveError` handles backend defensive rejections (404, 409, 422) as save errors; not normal validation UX
  - All functions use `apiRequest` from authenticated base client; no draft state, no drag-drop, no validation logic added
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

- **Unit 10: Frontend Room API Client**
  - Created `frontend/src/lib/api/rooms.ts` — `Room` DTO type, `RoomCreate` and `RoomUpdate` input types, `RoomType` union, and four API functions: `listRooms`, `createRoom`, `updateRoom`, `deleteRoom`
  - All functions use `apiRequest` from the Unit 6 authenticated base client; auth token is attached consistently through that shared helper
  - `parseRoomError` helper adds room-specific messages for 409 (duplicate name) and 422 (validation) errors before re-throwing
  - No TanStack Query, no rooms page data wiring, no mock data added
  - Build succeeds with zero errors

- **Units 13/17: Frontend Lecturer and Student Page Shells**
  - Created `frontend/src/features/lecturers/AvailabilityEditor.tsx` — self-contained availability grid; Mon–Fri columns, AM slots (s1–s4), lunch divider, PM slots (s5–s8); click to toggle unavailable (maroon-soft highlight); legend and instructions; blank initial state
  - Rewrote `frontend/src/routes/lecturers.tsx` — full management shell: page header with "Add lecturer" action; table with Title/First name/Last name/Actions columns; inline empty state; Create/Edit/Delete/Availability dialogs; `LecturerFormFields` (title, first name, last name); all submit buttons disabled pending API integration; availability dialog uses `AvailabilityEditor` with disabled "Save availability" CTA
  - Rewrote `frontend/src/routes/students.tsx` — full management shell: page header with "Add student" action; table with Title/First name/Last name/Year level/Actions columns; inline empty state; Create/Edit/Delete dialogs; `StudentFormFields` (title, first name, last name, year level); all submit buttons disabled pending API integration; no lecturer availability controls
  - No API calls, no mock data, no TanStack Query, no persistence; build succeeds with zero TypeScript errors

- **Unit 12/2: Timetable Table UI Adjustments**
  - Updated `slots.ts`: all 8 time slot labels now show start–end times in `H:MM-H:MM` format; added 4th AM slot `s4` (`12:00-12:50`); PM slots renumbered s5–s8 with labels `1:30-2:20` through `4:30-5:20`
  - `TimetableGrid.tsx`: removed `overflow-x-auto` wrapper and `min-w-max`; grid is now `w-full`; day headers use `flex: rooms.length` to span proportionally; room sub-headers and `GridCell` use `flex-1` so columns distribute across available width without horizontal scroll
  - Time label column widened from `4rem` to `6rem` to accommodate longer `HH:MM-HH:MM` labels
  - All time labels, day headers, room sub-headers, and lunch row use `userSelect: 'none'` and `onContextMenu` prevention; global app text selection and right-click are unaffected
  - `GridCell.tsx`: replaced `shrink-0 w-32` with `flex-1`; cells resize proportionally
  - Build succeeds with zero TypeScript errors

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

- **Unit 22: Backend Unit Persistence and Protected API**
  - Created `backend/models/unit.py` — `Unit` SQLAlchemy model (`id`, `code` unique, `name`, `lecturer_id` FK); `unit_students` many-to-many join table (unit→student, both cascade on delete); `lazy="selectin"` on `lecturer` and `students` relationships to avoid N+1 on list
  - Created `backend/schemas/unit.py` — `LecturerSummary`, `StudentSummary` (lightweight nested types); `UnitCreate` (code, name, lecturer_id, student_ids); `UnitUpdate` (all optional); `UnitResponse` (includes nested lecturer and students); validators enforce non-blank code and name
  - Created `backend/services/unit.py` — `list_units`, `get_unit`, `create_unit`, `update_unit`, `delete_unit`; validates lecturer exists (422), all student IDs exist (422), unique unit code (409 on conflict); excludes self on code uniqueness check during update
  - Created `backend/api/units.py` — `GET /units`, `POST /units`, `PUT /units/{unit_id}`, `DELETE /units/{unit_id}`; all routes require `get_current_admin`; returns `UnitResponse` schemas
  - Created `backend/alembic/versions/0005_create_units.py` — creates `units` table (with FK to `lecturers`, unique constraint on `code`) and `unit_students` join table; revises `0004`
  - Updated `backend/models/__init__.py` — registers `Unit` and `unit_students`
  - Updated `backend/api/router.py` — registered units router
  - No frontend code, no session model, no session routes added

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

- **Unit 30: Frontend Scheduled Session Rendering Shell**
  - Created `frontend/src/features/timetable/assignment.ts` — `SlotId` union (`s1`–`s7`, no `s8`); `TimetableAssignment` frontend rendering model with all fields needed to place and display a session (assignment_id optional, session_id, unit_id, unit_code, unit_name, session_type, duration, lecturer_display_name, student_count, day, start_slot, room_id); aligns with future Unit 32 backend DTO
  - Created `frontend/src/features/timetable/ScheduledSessionCard.tsx` — `position: absolute inset-x-0 top-0`, height `calc(N * 3.5rem)` where N = duration; left-border 4px accent (vs 3px on unscheduled cards); shows unit code, abbreviated session type, lecturer name (truncated), student count (duration > 1 only); uses `getUnitColor` + same BG/accent token maps as `UnscheduledSessionCard`; `z-index: 10` to overlay subsequent slot rows; `overflow: hidden`; distinct from unscheduled cards by layout, width behavior, and content
  - Updated `frontend/src/features/timetable/GridCell.tsx` — added `position: relative` (`className="relative h-14 …"`); accepts `assignment?: TimetableAssignment`; renders `ScheduledSessionCard` when assignment is present; suppresses hover state when a card is rendered
  - Updated `frontend/src/features/timetable/TimetableGrid.tsx` — accepts `assignments?: TimetableAssignment[]` (defaults to `[]`); `buildAssignmentMap` indexes assignments by `"${day}:${roomId}:${slotId}"`; each `GridCell` receives `assignment={assignmentMap.get(key)}` — undefined when no assignment starts at that cell; grid renders blank as before when `assignments=[]`
  - Updated `frontend/src/routes/timetable.tsx` — passes `assignments={[]}` to `TimetableGrid`; no backend calls, no fake data
  - No drag-and-drop, no assignment API client, no backend calls, no mock assignments in production UI
  - Build succeeds with zero TypeScript errors

- **Unit 29: Frontend Unscheduled Pool Integration**
  - Added `useQuery({ queryKey: ['schedulable-sessions'], queryFn: listSchedulableSessions })` in `timetable.tsx`; sessions query runs independently from the rooms query so pool and grid states are decoupled
  - `UnscheduledPool` updated to accept `isLoading`, `isError`, `error` props; renders spinner loading state, error message, empty state, or grouped session cards depending on query state
  - `buildUnitBuckets` now sorts buckets by unit code (alphabetical) and sorts sessions within each bucket by session type order (lecture → tutorial → lab → workshop) then by duration
  - `['schedulable-sessions']` query key is invalidated on `createMutation`, `editMutation`, and `deleteMutation` success in `units.tsx`, so the pool refreshes automatically after unit/session changes
  - No mock data, no Zustand, no scheduling/assignment/drag-drop behavior added
  - Build succeeds with zero TypeScript errors

- **Unit 28: Frontend Unscheduled Pool Shell**
  - Created `frontend/src/features/timetable/unitColors.ts` — `getUnitColor(identifier)` deterministic helper; hashes identifier string into one of 6 color variant names (maroon, gold, blue, green, purple, stone); no hex values
  - Created `frontend/src/features/timetable/UnscheduledSessionCard.tsx` — compact card prepared for `SchedulableSession` DTO; displays session type, unit code, unit name, duration, lecturer display name, student count; left-border accent driven by unit color variant tokens; `minWidth: 180px`, `maxWidth: 240px`; no drag-and-drop
  - Created `frontend/src/features/timetable/UnitGroup.tsx` — groups session cards under a unit label row (code, name, session count); accepts `UnitColorVariant` and `SchedulableSession[]`
  - Created `frontend/src/features/timetable/UnscheduledPool.tsx` — pool panel with heading, helper text, empty state (`CalendarPlus` icon, "No schedulable sessions yet", link to `/units`), and unit-bucket rendering when sessions provided; `buildUnitBuckets` groups sessions by `unit_id`; no backend calls
  - Updated `frontend/src/routes/timetable.tsx` — `UnscheduledPool` imported and rendered below `TimetableGrid` only in the rooms-exist grid state; all other states (loading, error, no-room) unchanged
  - No drag-and-drop, no TanStack Query wiring for sessions, no mock data, no backend calls
  - Build succeeds with zero TypeScript errors

## In Progress

- None.

## Next Up

- Next unit TBD

## Open Questions

- None from Unit 3.

## Consistency Fixes

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
