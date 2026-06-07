# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Unit 5/2 complete — signup functionality wired to Supabase Auth

## Current Goal

- Begin Unit 6

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
  - Added `supabase_jwt_secret` field to `config.py` `Settings`
  - Created `backend/auth/jwt.py` — `decode_supabase_token()` verifies HS256 Supabase JWTs using `SUPABASE_JWT_SECRET`
  - Created `backend/auth/deps.py` — `CurrentAdmin` model and `get_current_admin` FastAPI dependency; extracts Bearer token, verifies JWT, raises `AppError` 401 on missing or invalid tokens
  - Created `backend/api/protected.py` — `GET /auth/verify` test endpoint requiring `get_current_admin`; returns `{"authenticated": true, "user_id": "..."}` for valid tokens
  - Registered protected router in `api/router.py`
  - Updated `.env.example` with `SUPABASE_JWT_SECRET`
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

## In Progress

- None.

## Next Up

- Unit 6

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
