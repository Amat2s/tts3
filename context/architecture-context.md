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
- `backend/` — FastAPI service responsible for core data persistence, saved timetable assignment persistence, defensive save invariants, solver compilation, and API orchestration. It does not own user-facing timetable validation in v1. It also owns timetable block persistence and protected block CRUD, unschedules saved assignments overlapping a created/updated block, and defensively rejects assignment saves that overlap blocks.
- `solver/` — OR-Tools integration layer inside backend responsible for converting saved sessions + mirrored solver constraints into a CP-SAT model. It consumes blocked cells from the snapshot so the model never occupies a blocked `day + slot + room` cell.
- `shared/` — Shared domain types (sessions, constraints, DTO schemas) used by both frontend and backend.
- `jobs/` — Trigger.dev workflows for asynchronous solver execution and progress reporting.

## Storage Model

- **Supabase PostgreSQL**: Stores all core domain data:
  - units and derived year levels
  - sessions
  - students (each with a required, unique `student_number` separate from the internal id)
  - lecturers
  - rooms
  - unit-student enrolments (`unit_students`)
  - unit teaching teams (`unit_lecturers`)
  - hidden session-student allocations
  - session assignments (locked + scheduled state)
  - timetable block groups (`timetable_block_groups`) and room-specific block cells (`timetable_block_cells`)
- **Browser localStorage (frontend draft only)**: the current unsaved timetable draft is persisted client-side under a schema-versioned key. It stores only the unsaved draft plus minimal metadata (schema version, saved-assignment fingerprint, timestamp), never server-owned query data, and is cleared after a successful save. No version history; stale or malformed stored drafts are discarded on load.
- **No blob storage in v1**: the student CSV import (`POST /students/import-csv`, Unit 90) parses the uploaded file in-memory and discards it — nothing is written to object storage. The timetable Excel export (`GET /timetable/export.xlsx`, Unit 93) reads a repo-owned static `.xlsx` template, renders it in-memory, and streams the result — no generated file is written to the database or object storage. Other file flows (reports, Excel *import* templates) are still deferred.
- **Repo-owned export template**: the fixed Campion export layout lives at `backend/export_templates/campion_timetable_export_template.xlsx`, derived once from the **real pristine** Campion source workbook (`backend/assets/excel/Timetable S2 2025 DRAFT.xlsx` — no trailing space) by `backend/export_templates/build_template.py`, which selects the canonical sheet **by name** `S2, 2025 Timetable ` (WITH a trailing space, not `worksheets[0]`). It is loaded read-only per export request.
- **Future object storage (Supabase Storage or Vercel Blob)**: for bulk imports and any future persisted exports

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
7. Blocking placement rules reject a proposed placement before it enters the draft: room double-booking, room capacity too small, crossing lunch, running off the timetable, and placement into a cell reserved by a timetable block (`timetable_slot_blocked`).
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
24. Unit codes are exactly three letters followed by three numbers (`AAA999`), trimmed and uppercased, and unique. Subject and year are derived from the code; the subject parser (supported prefixes HIS, PHI, THE, LIT, LAN, GRE, SCI) is frontend-only for display, filtering, and colour. The backend defensively validates the structural format and keeps year derivation authoritative.
25. The unsaved timetable draft may be persisted in versioned browser storage; it is cleared after a successful save, and restored drafts remain subject to the blocking auto-unschedule rules. Saving an empty draft persists an empty assignment set.
26. Students have no title. Lecturer titles are restricted to `Mr`, `Ms`, `Mrs`, `Dr`, `Fr`, `A/Prof.`, `Prof.`.
27. Timetable blocks are stored as block groups (`id`, nullable `name`, nullable `colour`, timestamps) and room-specific block cells (`day + slot + room_id`), with a unique `(day, slot, room_id)` so a cell can be blocked by at most one group and cells cascade when their group or room is removed. An unnamed block has `name = null` and `colour = null`; a named block requires a `name` and a `colour` of `gold`, `light_blue`, or `light_pink`. Blocks are not sessions and never appear in session/scheduling models or the unscheduled pool.
28. Timetable blocks are a hard constraint, not a soft one. The frontend rejects manual placement into blocked cells and auto-unschedules draft/restored assignments overlapping blocks; the backend defensively rejects saving assignments that overlap blocks (`assignment_overlaps_timetable_block`); and the solver mirror loads blocked cells into the snapshot (`BlockedCellSnapshot`) so the CP-SAT model never occupies a blocked cell. The mirrored constraint type is `timetable_slot_blocked` with `blocking` severity (a cell-feasibility constraint, not a conflict-graph edge).
29. Creating or updating a block over saved assignments unschedules those assignments in the same transaction and returns the affected session IDs; deleting a block frees its cells without rescheduling anything. A saved assignment overlapping a block must never be valid solver input (snapshot integrity fails safely if one is found).
30. Students carry a required, unique `student_number` — the canonical institutional identifier — separate from the internal primary key `id` (which stays the record identity). It is exactly 8 digits (trimmed before validation/persistence) and enforced unique at rest by a unique index; uniqueness conflicts surface as a structured 409. Year level stays manually supplied and editable and is never derived from `student_number` (that derivation belongs only to the future CSV upload feature). Migration `0014` introduced this contract with a deliberate destructive reset of existing student rows, relying on the existing `unit_students` / `session_student_allocations` cascades to stay consistent.
31. Student bulk import is a protected backend endpoint (`POST /students/import-csv`) that parses an uploaded `.csv` in-memory (no blob/object storage) and discards it. Structural file problems (missing file, wrong extension, bad encoding, empty file, missing/incorrect header, extra columns) reject the whole import; row-level problems skip and count individual rows without blocking valid rows. It keeps only current rows (`dest census date >= today` in Australia/Sydney), matches/creates students by `student_number`, updates existing student names but preserves their year level (newly created students derive an initial year from the student number — reject future cohorts where the derived year < 1, cap above 3 to 3), additively enrols students into matching existing units (never creates units, never removes enrolments), dedupes `(student_number, unit_code)` pairs, rebalances hidden `session_student_allocations` for affected units in the same transaction, commits atomically (rolling back on unexpected persistence failure), and returns aggregate counts only (never student lists or raw rows).
32. Timetable Excel export is a protected backend endpoint (`GET /timetable/export.xlsx?title=...`, Unit 93) that renders the **saved** timetable into the fixed repo-owned Campion `.xlsx` template and streams it in-memory — it never mutates assignment/block state and never persists a generated file. The fixed sheet mapping is explicit (days map left to right Monday–Friday in 8-column room blocks `PDS, L1.05, Bromley, L1.08, Dawson, L1.10, L1.12, JTW`; app slots s1–s7 map to two-row visual bands; the static `Mass/Lunch`, evening rows, notes, and lecturer/tutor key area are preserved). Room matching is by name against the fixed room order — a saved assignment or block using a room not in that order fails the export with a structured `export_room_not_in_template` (422). Styling parity (Units 96, 97): the export is a **blanked copy of the real pristine template**, not a workbook rebuilt from scratch. `build_template.py` builds it from `backend/assets/excel/Timetable S2 2025 DRAFT.xlsx`, sheet `S2, 2025 Timetable ` (trailing space), preserving that sheet's column model verbatim (only `A, G, O, R, S, T, W, Y, AE, AP` carry explicit widths; every other room column is left **default/unset** — no global explicit widths, no `bestFit`, no autofit), its row heights, sheet-format properties (`defaultRowHeight` 12.95), page setup (landscape, page `scale 35`, `fitToPage`), margins, green tab colour (`FF00B050`), sheet view zoom (90), and every static merged range/cell value/style. It clears the dynamic s1–s7 grid **values** and resets **every** room×slot band to a **uniform** empty look: its day block's fill — **Tuesday `J–Q` and Thursday `Z–AG` white** `theme0` tint 0.0 while **Monday/Wednesday/Friday grey** `theme0` tint -0.15 — plus a **uniform medium (bold) box border on all four sides** in the dark `indexed 64` colour, so every box reads the same (adjacent rooms/slots and all five days are consistent, and no cell is left unfilled). Fills and the medium border side are copied verbatim from real template cells, never reconstructed from approximated RGB or flattened to one global grey. It bakes **template-derived `NamedStyle`s** (`tt_class_*`, `tt_block_*`) copied verbatim from the source sheet's own class/event exemplar cells (theme-based subject fills — e.g. History `theme9/0.6`, Theology `theme5/0.6`, Literature `theme2/-0.25`; gold/blue/maroon event fills). The export service paints classes/blocks by *applying* those named styles — it never constructs subject fills, fonts, or borders from approximated RGB, never resets row heights, and never emits column widths. Per-category text position is carried by the copied styles: time labels and day/room headers are `center`/`center` (static, preserved by the blank copy), class cells `center`/`top`/wrap, and block cells carry the template's **event** alignment (e.g. `FORMAL HALL` `center`/`center`), not the class alignment. The unit-code prefix only selects which template class style to apply (HIS/THE/LIT/PHI/GRE/LAN; unknown/SCI → a neutral default); blocks map the app block colour to the template's blocked/static-event styling (unnamed→grey empty-cell look, gold/blue/maroon events), grouping contiguous same-group cells into merged rectangles. The canonical template the export must match is the `S2, 2025 Timetable ` sheet of that source; the structural parity tests assert the exported columns/rows/sheet-format/page-setup/tab-colour/zoom/margins/static merges/static cell styles equal it verbatim and that Tuesday/Thursday empty cells are white while Mon/Wed/Fri are grey with bold dark borders. Tutorial letters and the lecturer/tutor key are generated export-only from the exported sessions (key cells inherit the template key-area style); structured errors never leak stack traces or filesystem paths.
