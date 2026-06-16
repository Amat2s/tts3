# Architecture Context

## Stack

| Layer              | Technology                         | Role                                                     |
| ------------------ | ---------------------------------- | -------------------------------------------------------- |
| Frontend Framework | React (Vite + TypeScript)          | SPA UI for timetable editor, frontend draft scheduling, validation, and admin dashboard          |
| Routing            | React Router                       | Client-side navigation                                   |
| UI System          | TailwindCSS + Radix UI + shadcn/ui | Styling, accessible components, design system            |
| Forms              | React Hook Form                    | Complex admin data entry (students, lecturers, sessions) |
| State Management   | Zustand                            | UI state (selection, drag/drop, draft timetable assignments, validation, unscheduled pool) |
| Data Fetching      | TanStack Query                     | Server state caching, saved timetable loading, and explicit save synchronization             |
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
| Observability        | structlog + Sentry | Structured backend logs, correlation IDs, and unexpected-exception capture |
| Deployment (backend) | Railway           | FastAPI hosting                                           |

## System Boundaries

- `frontend/` — React application responsible for timetable UI, draft assignment state, drag/drop scheduling, user-facing validation, constraint visualization, solver gating, and admin interaction.
- `backend/` — FastAPI service responsible for core data persistence, saved timetable assignment persistence, defensive save invariants, solver compilation, and API orchestration. It does not own user-facing timetable validation in v1.
- `solver/` — OR-Tools integration layer inside backend responsible for converting saved sessions + mirrored solver constraints into a CP-SAT model.
- `shared/` — Shared domain types (sessions, constraints, DTO schemas) used by both frontend and backend.
- `jobs/` — Trigger.dev workflows for asynchronous solver execution and progress reporting.

## Storage Model

- **Supabase PostgreSQL**: Stores all core domain data:
  - units and derived year levels
  - sessions
  - students
  - lecturers
  - rooms
  - unit-student enrolments (`unit_students`)
  - unit teaching teams (`unit_lecturers`)
  - hidden session-student allocations
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

1. Sessions are atomic scheduling units and include unit/course context, a `lecture` or `tutorial` type, integer-slot duration, and a nullable session-level lecturer. A session without a lecturer is not schedulable.
2. Time is discretized into fixed slots; sessions occupy contiguous slot intervals only.
3. The timetable editor has two assignment layers in v1: saved assignments from the backend and an unsaved frontend draft.
4. Manual scheduling actions update the frontend draft first. They are persisted only when the admin explicitly saves the timetable.
5. User-facing validation is owned by the frontend in v1.
6. Frontend validation has two severities: `blocking` and `warning`.
7. Blocking placement rules reject a proposed placement before it enters the draft: room double-booking, room capacity too small, crossing lunch, and running off the timetable.
8. Warning rules allow the placement to remain visible but mark it as invalid/warning and block solver execution. Warning rules include session-level lecturer conflicts, allocated-student conflicts, lecturer availability conflicts, and other non-blocking conflicts represented by current data. Independent same-unit overlap is retired.
9. If underlying data changes make an existing saved or draft assignment violate a blocking rule, the frontend must automatically unschedule that session and make the reason visible when relevant.
10. Backend assignment save endpoints enforce defensive invariants for impossible persisted states, but these defensive rejections are not the normal user-facing validation path.
11. Warning-invalid assignments may be saved to the database. The frontend remains responsible for displaying warning state after loading saved data.
12. Solver execution is blocked whenever the frontend validation engine reports any blocking issue or warning issue.
13. Backend constraint definitions are introduced later as a solver mirror of the frontend validation rules, not as a user-facing validation API in v1.
14. Room capacity must always be greater than or equal to the session's hidden allocation count for a placement to enter or remain in the draft.
15. Solver output is partial allowed; unscheduled sessions remain explicitly in the UI pool.
16. No scheduling version history is stored in v1; latest saved state plus current frontend draft are the only timetable states.
17. Unit year level is derived from the first integer in the unit code and is restricted to 1-3; student year level is also restricted to 1-3.
18. Unit teaching membership is many-to-many through `unit_lecturers`; each scheduled session uses its own `lecturer_id`, which must belong to that unit's team.
19. `session_student_allocations` are hidden, system-owned derived rows. Lectures include every enrolled unit student; tutorials are balanced and stable where practical, with each enrolled student in exactly one tutorial.
20. Unit and student enrolment editing share the canonical `unit_students` relationship.
21. Clear All changes only the frontend draft until the explicit save operation persists the empty assignment set.
22. Management search and filters are frontend-only and do not add backend query parameters.
23. Duration remains an integer slot count in persistence and solver input, while the frontend labels it in hours.
