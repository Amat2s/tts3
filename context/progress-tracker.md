# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Unit 12/2 complete — timetable table UI adjustments

## Current Goal

- Begin Unit 13

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

- **Unit 12/2: Timetable Table UI Adjustments**
  - Updated `slots.ts`: all 8 time slot labels now show start–end times in `H:MM-H:MM` format; added 4th AM slot `s4` (`12:00-12:50`); PM slots renumbered s5–s8 with labels `1:30-2:20` through `4:30-5:20`
  - `TimetableGrid.tsx`: removed `overflow-x-auto` wrapper and `min-w-max`; grid is now `w-full`; day headers use `flex: rooms.length` to span proportionally; room sub-headers and `GridCell` use `flex-1` so columns distribute across available width without horizontal scroll
  - Time label column widened from `4rem` to `6rem` to accommodate longer `HH:MM-HH:MM` labels
  - All time labels, day headers, room sub-headers, and lunch row use `userSelect: 'none'` and `onContextMenu` prevention; global app text selection and right-click are unaffected
  - `GridCell.tsx`: replaced `shrink-0 w-32` with `flex-1`; cells resize proportionally
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

## In Progress

- None.

## Next Up

- Unit 13

## Open Questions

- None from Unit 3.

## Architecture Decisions

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
