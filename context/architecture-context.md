# Architecture Context

## Stack

| Layer              | Technology                         | Role                                                     |
| ------------------ | ---------------------------------- | -------------------------------------------------------- |
| Frontend Framework | React (Vite + TypeScript)          | SPA UI for timetable editor and admin dashboard          |
| Routing            | React Router                       | Client-side navigation                                   |
| UI System          | TailwindCSS + Radix UI + shadcn/ui | Styling, accessible components, design system            |
| Forms              | React Hook Form                    | Complex admin data entry (students, lecturers, sessions) |
| State Management   | Zustand                            | UI state (selection, drag/drop, locks, unscheduled pool) |
| Data Fetching      | TanStack Query                     | Server state caching and API synchronization             |
| Drag & Drop        | dnd-kit                            | Session scheduling interactions in timetable grid        |
| Visualization      | Custom Timetable Grid              | Core scheduling UI (interval-based calendar grid)        |
| Hosting            | Vercel                             | Frontend deployment                                      |

| Layer                | Technology        | Role                                                      |
| -------------------- | ----------------- | --------------------------------------------------------- |
| Backend Framework    | FastAPI           | API layer, constraint orchestration, solver orchestration |
| Validation           | Pydantic          | Schema validation for all domain objects                  |
| ORM                  | SQLAlchemy 2.0    | Database models and persistence layer                     |
| Migrations           | Alembic           | Schema versioning                                         |
| Database             | Supabase Postgres | Primary persistent storage                                |
| Auth                 | Supabase Auth     | Admin authentication (v1 single-admin system)             |
| Scheduling Engine    | OR-Tools (CP-SAT) | Constraint-based timetable solver                         |
| Realtime             | WebSockets        | Live solver progress + UI updates                         |
| Background Jobs      | Trigger.dev       | Async solver execution                                    |
| Deployment (backend) | Railway           | FastAPI hosting                                           |

## System Boundaries

- `frontend/` — React application responsible for timetable UI, drag/drop scheduling, constraint visualization, and admin interaction.
- `backend/` — FastAPI service responsible for data persistence, constraint evaluation, solver compilation, and API orchestration.
- `solver/` — OR-Tools integration layer inside backend responsible for converting sessions + constraints into CP-SAT model.
- `shared/` — Shared domain types (sessions, constraints, DTO schemas) used by both frontend and backend.
- `jobs/` — Trigger.dev workflows for asynchronous solver execution and progress reporting.

## Storage Model

- **Supabase PostgreSQL**: Stores all core domain data:
  - sessions
  - students
  - lecturers
  - rooms
  - enrolments
  - session assignments (locked + scheduled state)
- **No blob storage in v1**: file uploads not required yet (future: CSV imports, exports, reports)
- **Future object storage (Supabase Storage or Vercel Blob)**: for timetable exports and bulk imports

## Auth and Access Model

- Authentication via **Supabase Auth**
- v1 system is **single-admin focused**
- Only authenticated admin can access scheduling system
- No multi-tenant or role-based access control in v1
- All data belongs to single admin workspace implicitly
- Future: student/lecturer read-only roles

## Invariants

1. Sessions are atomic scheduling units and always include: name, course, lecturer, and duration; students are optional
2. Time is discretized into fixed slots; sessions occupy contiguous slot intervals only
3. Only two session states exist: locked (scheduled) and unscheduled
4. Locked sessions are immutable inputs to solver and constraint engine
5. Solver must never run if hard constraint violations exist in current UI state
6. Constraint definitions are hardcoded in backend (no user-defined rules in v1)
7. Conflict graph is derived from session overlaps (students + lecturer)
8. Room capacity must always be ≥ session student count
9. Solver output is partial allowed; unscheduled sessions remain explicitly in UI pool
10. No scheduling version history is stored in v1 (latest state only)
