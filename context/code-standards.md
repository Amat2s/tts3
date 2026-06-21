# Code Standards

## General

- Keep modules small, single-purpose, and aligned with the system boundary they belong to.
- Fix root causes instead of layering workarounds around unclear state or duplicated logic.
- Do not mix unrelated concerns in one component, route, service, or solver function.
- Keep domain logic separate from UI rendering, persistence, API routing, background job execution, and solver modeling.
- Treat sessions as the atomic scheduling unit throughout the codebase.
- Unit year level must be derived from the first integer in the unit code and restricted to 1-3; do not accept a client-authored unit year.
- Unit codes must be exactly three letters followed by three numbers (`AAA999`), trimmed and uppercased before validation/persistence, and unique. The frontend subject/year parser derives subject, colour, and year for display, filtering, and validation UX only; the backend defensively validates the structural format while year derivation stays authoritative. Invalid unit codes must disable unit create/save in the UI.
- Students have no title field. Lecturer titles are restricted to `Mr`, `Ms`, `Mrs`, `Dr`, `Fr`, `A/Prof.`, `Prof.`.
- Each student has a required, unique `student_number` (the canonical institutional identifier, distinct from the internal `id`): exactly 8 digits, trimmed before validation/persistence, rejecting letters, punctuation, internal spaces, blank values, and any non-8-digit length. Validate it in the Pydantic schema/service layer; uniqueness conflicts (excluding self on update) return a structured 409. Do not derive student year level from `student_number` in the normal create/update path — that derivation belongs only to the CSV import feature.
- The `/students` page owns the student CSV upload UI. Send the file as multipart `FormData` through the shared authenticated API client (which must omit the JSON `Content-Type` for `FormData` so the browser sets the multipart boundary); never store CSV contents in localStorage, Zustand, or blob storage. The student-number input is validated as exactly 8 digits on the frontend and disables create/save when invalid; `year_level` stays a manual control and is never derived from the number in the create/edit form. The upload success summary shows created/updated students, added enrolments, skipped unknown-unit rows, and (only when nonzero) skipped invalid rows, but never `skipped_past_census_rows`; a successful upload invalidates `['students']`, `['units']`, `['schedulable-sessions']`, and `['assignments']`.
- Student CSV import (`POST /students/import-csv`, in `services/student_import.py`) parses the upload in-memory and discards it (no blob storage). Reject the whole file for structural errors (missing file, non-`.csv` extension, bad encoding, empty file, missing/incorrect header after trim→lowercase→collapse-whitespace normalization, extra columns) with structured 422s; skip and count individual rows for row-level errors. Keep only current rows (`dest census date >= today` in Australia/Sydney via `zoneinfo`), match/create students by `student_number`, update existing names but never overwrite an existing student's year level, derive a new student's initial year level from the number (reject derived year < 1, cap > 3 to 3), enrol additively into existing units only (never create units, never remove enrolments), dedupe `(student_number, unit_code)` pairs, rebalance hidden allocations for affected units in the same transaction, and return aggregate counts only — never student lists or raw CSV rows.
- Student year level must be restricted to 1-3 on create, update, and at rest.
- Unit teaching teams use `unit_lecturers`; session lecturer identity comes from `Session.lecturer_id`, not from the unit team as a whole.
- Session types are limited to `lecture` and `tutorial`.
- Hidden `session_student_allocations` are the canonical per-session membership used by validation, capacity checks, and solver input. Do not expose tutorial group membership in the UI.
- Treat scheduled sessions as locked by definition.
- Do not introduce a third persistent session state beyond scheduled and unscheduled in v1.
- Warning placements are allowed in the UI, but they must be represented as validation warnings, not as a separate persistent state. Blocking placements must be rejected before entering the frontend draft.
- Keep hard constraint definitions explicit, versioned, and developer-defined.
- Do not add user-defined constraint rules in v1.
- Prefer clear data transformations over implicit side effects.
- Prefer deterministic behavior for validation, constraint compilation, and solver input generation.
- Long-running work must not run inside request handlers.
- Solver execution must happen through the background job system.
- The frontend owns user-facing timetable validation in v1. Backend assignment save validation is defensive and should not drive normal UX.
- Avoid hidden recovery behavior. If data changes make an assignment violate a blocking rule, the frontend may automatically unschedule it, but the reason must be explicit in the code and visible in the UI when relevant.
- Do not silently discard sessions, assignments, constraint violations, or solver failures.

## TypeScript

- Strict mode is required throughout the frontend.
- Avoid `any`. Use explicit interfaces, discriminated unions, or narrowly scoped unknown parsing.
- Validate unknown external input at system boundaries before trusting it.
- Shared domain types must represent real product concepts, not UI convenience structures.
- Use explicit types for session state, timetable assignment, solver status, and validation issue objects.
- Prefer discriminated unions for state that has different valid shapes.

Example:

```ts
type SessionScheduleState =
  | {
      status: "unscheduled";
      assignment: null;
    }
  | {
      status: "scheduled";
      assignment: SessionAssignment;
    };
```

- Do not represent scheduled state using loosely related nullable fields unless the type enforces valid combinations.
- Avoid duplicating backend DTO shapes manually across the app. Centralize API types.
- Keep frontend-only view models separate from API DTOs.
- Do not store server-owned data in Zustand.
- Use TanStack Query for server state.
- Use Zustand only for UI state such as selected session, active drag state, expanded panels, filters, local layout preferences, and the current unsaved timetable draft.
- All async API calls must have explicit loading, success, and error handling.
- Avoid broad catch blocks that hide API or validation failures.
- Do not ignore TypeScript errors with `// @ts-ignore` unless there is a documented reason and no practical alternative.
- Prefer named functions for non-trivial logic, especially validation and transformation logic.
- Keep drag/drop logic isolated from timetable rendering logic where possible.
- Keep constraint evaluation helpers pure where possible.

## React

- Use React components for UI composition, not business logic orchestration.
- Keep page components focused on data loading, layout composition, and route-level behavior.
- Move complex timetable logic into hooks, utilities, or domain modules.
- Do not embed solver, validation, or constraint graph logic directly inside React components.
- Use controlled forms through React Hook Form.
- Keep form schemas and API validation expectations aligned.
- Use TanStack Query for fetching, caching, mutation, invalidation, and background refresh.
- Use optimistic updates only when rollback behavior is clear and safe.
- Do not perform destructive timetable mutations without confirmation when dependencies are affected.
- Disable editing while the solver is running.
- Do not allow UI actions that create impossible persistent state shapes.
- Warning timetable placements may be rendered, but they must always be paired with visible validation feedback.
- Blocking timetable placements must not enter the draft through manual scheduling.
- The solver button must be disabled whenever frontend validation reports any blocking or warning issue.
- The disabled solver state must explain why the solver cannot run.
- Scheduled session cards should be rendered from assignment data. During editing, they render from the frontend draft assignment set initialized from saved backend data.
- The unscheduled pool should be derived from sessions without assignments.
- Keep accessibility in mind for drag/drop interactions; provide non-drag alternatives where practical.
- The timetable Excel download UI must never generate the workbook in the browser. It collects a required title, streams the Unit 93 backend `.xlsx` blob through `apiRequestBlob` (in `lib/api/timetableExport.ts`), and triggers a download via `triggerBlobDownload` using the backend `Content-Disposition` filename or the dated `fallbackExportFilename`. Do not add a browser-side spreadsheet/workbook library, blob storage, or export history. Because the export is saved-state-only, the `Download Timetable` action must be disabled while the saved timetable is unsafe to export (dirty draft, save or solver in progress, or rooms/saved-assignments/blocks still loading or failed) and must carry a human-readable disabled reason; it stays enabled for partial saved timetables, unscheduled sessions, and warning-invalid saved assignments.

## Vite

- Keep Vite configuration minimal.
- Do not place application logic in Vite config files.
- Use environment variables only for public frontend configuration that is safe to expose.
- Prefix browser-exposed environment variables according to Vite conventions.
- Do not expose backend secrets, Supabase service keys, Trigger.dev secrets, or database credentials to the frontend.
- Keep build-time configuration separate from runtime application state.

## FastAPI

- Keep route handlers focused on request parsing, authorization, service calls, and response shaping.
- Do not place business logic directly inside route handlers.
- Do not run OR-Tools solver work inside request handlers.
- Use background jobs for solver execution.
- Validate and parse request input with Pydantic before domain logic runs.
- Return consistent response shapes from API routes.
- Use explicit HTTP status codes.
- Keep authentication and authorization checks near the API boundary.
- Enforce admin access before mutations.
- Treat backend assignment validation as defensive for persistence and solver integrity; user-facing timetable validation remains frontend-owned in v1.
- Keep database transactions scoped and intentional.
- Do not leak internal stack traces or solver internals into user-facing API responses.
- Use structured errors for validation failures, constraint violations, and solver failures.
- Use dependency injection for database sessions and authenticated user context.
- Keep WebSocket concerns separate from standard REST route handlers.

## Pydantic

- Use Pydantic models for request and response validation.
- Keep API schemas separate from SQLAlchemy ORM models.
- Use explicit field constraints for required values, duration bounds, and enum values.
- Validate session duration as an integer number of slots.
- Enforce v1 duration bounds: minimum 1 slot, maximum 4 slots.
- Keep duration as an integer slot count in APIs/storage; frontend labels may display the value as hours.
- Represent day, slot, and session state with enums or constrained values.
- Do not accept arbitrary JSON blobs for core scheduling entities unless the shape is validated.
- Keep validation error messages precise enough to help the frontend display actionable feedback.

## SQLAlchemy and Alembic

- Use SQLAlchemy 2.0 style models and queries.
- Use Alembic for every database schema change.
- Do not modify production schema manually.
- Keep migrations small and reversible where practical.
- Use explicit relationships for core domain entities.
- Store unit enrolment and teaching teams in explicit many-to-many tables. Store hidden session-student membership in `session_student_allocations`.
- Store timetable blocks as `timetable_block_groups` (nullable `name`, nullable `colour` enum, timestamps) and `timetable_block_cells` (`block_group_id`, `day`, `slot`, `room_id`). Cascade cells when a block group is deleted, safely remove cells when a room is deleted, enforce a unique `(day, slot, room_id)` so a cell is blocked by at most one group, and index `block_group_id`, `room_id`, and `(day, slot, room_id)`.
- Prefer database constraints for invariants that must never be violated at rest.
- Enforce uniqueness where the product requires it, such as room names if room names are treated as unique.
- Use nullable assignment fields only if the application and database constraints prevent invalid combinations.
- Prefer an explicit assignment table if assignment integrity becomes difficult to enforce on the session table.
- Use timestamps for important mutable records.
- Avoid storing derived constraint graph data unless there is a measured performance need.
- Derived data should be recomputable from canonical tables.

## OR-Tools Solver

- Solver code must live in a dedicated solver module.
- Solver input must be compiled from canonical domain data.
- Do not let solver code query the database directly.
- Solver functions should receive explicit input objects and return explicit result objects.
- Treat locked scheduled sessions as fixed constraints.
- Treat unscheduled sessions as solver variables.
- The solver must never modify locked scheduled sessions.
- The solver should attempt to schedule as many unscheduled sessions as possible.
- Partial solver results are valid in v1.
- Unscheduled sessions that cannot be placed must be returned explicitly.
- Do not silently drop sessions from solver input or output.
- Use discrete slot-based modeling only.
- Sessions must occupy contiguous slots.
- Sessions must not span the lunch break.
- Sessions must fit within either the AM block or the PM block.
- Room assignment and start-slot assignment must be modeled explicitly.
- Student and lecturer conflicts should be compiled into a conflict graph before solver modeling.
- Room capacity should be applied as a hard feasibility constraint.
- Room exclusivity should be applied as a hard no-overlap constraint.
- Keep solver objectives simple in v1: maximize the number of scheduled sessions.
- Do not introduce soft constraints into the v1 solver model.
- Solver results must include enough information for the UI to show scheduled count, unscheduled count, and partial success warnings.
- Solver runs should be deterministic where practical.
- Solver timeout behavior must be explicit.

## Frontend Validation

- User-facing timetable validation must live in frontend validation modules, not inside React rendering components.
- Validation helpers must be pure where possible and receive explicit input objects.
- Use two severities only in v1:
  - `blocking`;
  - `warning`.
- Blocking validation prevents a proposed placement from entering the timetable draft.
- Blocking rules are:
  - room double-booking;
  - room capacity too small;
  - session crossing lunch;
  - session running off the timetable;
  - placement into a cell reserved by a timetable block (`timetable_slot_blocked`).
- The `timetable_slot_blocked` blocking rule rejects any proposed placement whose occupied
  cells intersect a blocked `day + slot + room_id` cell; draft validation and the
  auto-unschedule cleanup remove existing assignments overlapping blocks. Messages use the
  block name when present (`This time is blocked by Chapel.`) and a generic form otherwise
  (`This time is blocked.`), always with human time labels rather than raw slot IDs.
- Warning validation allows the placement to remain visible but blocks solver execution.
- Warning rules are:
  - session-level lecturer overlap conflict;
  - allocated-student overlap conflict;
  - lecturer availability conflict;
  - other non-blocking conflicts represented by current v1 data.
- A validation issue object should include:
  - issue type;
  - severity;
  - affected session IDs;
  - affected room ID when relevant;
  - affected lecturer ID when relevant;
  - affected student IDs when relevant;
  - human-readable message.
- Do not treat unscheduled sessions as validation issues.
- Do not treat zero-allocation sessions as incomplete solely because no students are allocated.
- Zero-allocation sessions have no known student-conflict constraints.
- Do not add an independent same-unit/session overlap warning; actual allocated-student intersection is authoritative.
- When data changes make a scheduled assignment violate a blocking rule, automatically unschedule the affected session and surface the reason when relevant.
- Warning-invalid assignments may be saved. They must remain visibly flagged after being loaded again.
- Solver execution must be blocked whenever any blocking or warning issue exists.
- User-facing validation messages must use human time labels (e.g. `1:30-2:20`), not raw slot IDs such as `s4`. Internal issue objects may continue to use slot IDs.

## Backend Constraint Mirror

- Backend constraint code exists for solver input compilation, not for user-facing validation in v1.
- Backend constraint definitions should mirror the frontend validation model closely enough that solver behavior matches the editor.
- Backend assignment save endpoints may defensively reject impossible persisted states, but those checks should not replace frontend UX validation.
- Do not add a user-facing validation API in v1 unless a later spec explicitly reintroduces it.
- Timetable blocks are a hard constraint mirrored on the backend as `TIMETABLE_SLOT_BLOCKED = "timetable_slot_blocked"` with `blocking` severity — a cell-feasibility constraint, not a conflict-graph edge.
- The solver snapshot must include blocked cells (`BlockedCellSnapshot(day, slot, room_id, block_group_id, block_name)` on `SolverInputSnapshot`). The snapshot builder loads all block cells with group names, builds deterministic blocked-cell data, and rejects saved locked assignments overlapping blocks with `SnapshotIntegrityError`.
- The assignment save service must defensively reject any requested assignment whose occupied cells intersect a blocked cell, using the structured error code `assignment_overlaps_timetable_block` (defensive persistence validation, not normal UX validation).
- Solver candidate generation must expand each candidate's occupied cells and reject any candidate overlapping a blocked cell before creating CP-SAT variables; this composes with the existing capacity, lunch, off-timetable, availability, and locked-occupancy feasibility checks. Result application must defensively reject generated assignments overlapping blocks, roll back on failure, preserve saved state, and report a structured integrity failure.

## Trigger.dev Jobs

- Use Trigger.dev for async solver execution.
- Jobs should receive a snapshot identifier or explicit solver input reference.
- Jobs must not rely on mutable frontend state.
- Editing must be disabled while a solver job is running.
- Job status should be visible to the frontend.
- Job completion must write final scheduled assignments back through backend-controlled logic.
- Job failure must not corrupt existing timetable state.
- Do not store solver business logic inside Trigger.dev job definitions.
- Keep Trigger.dev jobs as orchestration wrappers around backend services.
- Log solver job start, completion, failure, duration, scheduled count, and unscheduled count.

## Styling

- Use TailwindCSS for styling.
- Use shadcn/ui components where they fit the interaction.
- Use Radix UI primitives for accessible low-level behavior.
- Do not create one-off component styles when a reusable component is appropriate.
- Do not hardcode arbitrary visual decisions repeatedly across components.
- take all styling from `ui-context.md` - never use raw hex tokens
- Unit, scheduled, and unscheduled session cards must take their colour from the unit subject via the subject colour tokens; the generic unit-colour tokens are a fallback for invalid/legacy codes only.
- Use the dedicated lunch/mass tokens for the `Lunch/Mass` row rather than reusing error colours, and use the strong/emphasis grid-line tokens for darker grid borders.
- Keep timetable grid styling consistent across empty, valid, invalid, selected, dragging, and solver-running states.
- Use clear visual distinction for:
  - unscheduled sessions
  - scheduled sessions
  - selected sessions
  - invalid sessions
  - disabled solver state
  - solver running state
- Validation issue styling must be accessible and must not rely on color alone.
- Use consistent spacing for form pages, management tables, and timetable cards.
- Avoid deeply nested custom CSS unless the timetable grid requires it.
- Keep layout primitives reusable.

## API Routes

- Validate and parse request input before any business logic runs.
- Enforce authentication before returning protected data.
- Enforce authorization before any mutation.
- Return consistent response shapes.
- Use structured error responses.
- Do not return ORM models directly from API routes.
- Keep CRUD endpoints predictable and resource-oriented.
- Keep solver endpoints separate from entity CRUD endpoints.
- Do not trigger solver execution through generic update endpoints.
- Backend must defensively validate solver-start integrity, but normal solver gating is frontend-owned in v1.
- Solver start endpoint must return a job identifier or status object.
- Solver status endpoint must return predictable job state.
- Mutations that affect scheduled sessions must clearly define whether they preserve, warn, or automatically unschedule assignments.
- Do not silently cascade destructive changes without explicit product behavior.
- Deleting a room must unschedule sessions assigned to that room.
- Data changes that create blocking violations must automatically unschedule affected assignments; data changes that create warning violations must surface warnings without silently changing unrelated assignments.
- Timetable block CRUD lives on its own protected resource routes (`GET/POST /timetable-blocks`, `PUT/DELETE /timetable-blocks/{block_group_id}`), separate from session/assignment endpoints. Handlers stay thin and return structured errors for invalid colour/name state, unknown rooms, empty cells, duplicate blocked cells, and missing block groups.
- Creating or updating a block must intentionally unschedule overlapping saved assignments in the same transaction and return `unscheduled_session_ids`; deleting a block frees its cells without rescheduling. Block name is trimmed (blank becomes `null`); a named block requires an allowed colour and an unnamed block must carry no colour.

## Data and Storage

- Core metadata belongs in Supabase Postgres.
- Store students, lecturers, rooms, units, sessions, unit enrolments, unit teaching teams, hidden session allocations, and timetable assignments in the database.
- Do not use blob storage in v1.
- Do not store large generated files in the database.
- Future generated exports, uploaded imports, and large artifacts should use object storage.
- Timetable Excel export (`GET /timetable/export.xlsx`, `services/timetable_excel_export.py`, Unit 93) renders the **saved** timetable into the fixed repo-owned template (`backend/export_templates/campion_timetable_export_template.xlsx`) using `openpyxl`, then streams it in-memory. It must read saved assignments/blocks only, never mutate assignment/block state, and never write the generated workbook to the database or object storage. The fixed day/room/slot mapping is explicit (constants in the service, mirrored by `build_template.py`) rather than inferred; room matching is by name against the fixed room order (`PDS, L1.05, Bromley, L1.08, Dawson, L1.10, L1.12, JTW`) and an unknown room fails with structured `export_room_not_in_template`. Styling must be **template-derived, never reconstructed**: `build_template.py` produces the blank template as a blanked copy of the real source sheet (preserving its columns, row heights, sheet-format properties, page margins, static merges, and every static cell value/style verbatim), and bakes `NamedStyle`s (`tt_class_*`, `tt_block_*`) copied from the source sheet's own class/event exemplar cells; the export service paints classes/blocks by *applying* those named styles and must not build `Font`/`Fill`/`Border` objects from approximated or frontend RGB. The unit-code prefix only selects which baked template class style to apply (the one scoped exception to the otherwise frontend-only subject-colour rule — it must not grow into a general backend subject parser); unknown prefixes (e.g. SCI) fall back to a neutral default class style. Tutorial letters and the lecturer/tutor key are generated export-only (key entries inherit the template key-area style); structured errors must not leak stack traces or filesystem paths. Do not run autofit or emit per-column widths — the template column model is preserved as-is.
- Do not introduce Redis or caching infrastructure until there is a measured need.
- Treat the database as the source of truth for persisted timetable state.
- Treat the solver input model and conflict graph as derived data.
- Do not persist derived solver structures unless required for performance or debugging.
- Keep saved assignment integrity enforceable:
  - saved scheduled sessions must have day, start slot, and room;
  - unscheduled sessions must not have day, start slot, or room.
- Do not store validation severity as a separate persistent session state. Derive blocking/warning status from current data.
- Preserve existing timetable assignments when data changes, unless the product rule explicitly requires unscheduling.
- Clear All is a frontend draft operation and must not call the backend clear endpoint until the admin explicitly saves the empty draft.
- Saving an empty draft is valid and must persist an empty assignment set; do not early-return from save solely because the draft is empty.
- The unsaved timetable draft may be persisted to browser storage under a schema-versioned key. Persist only the draft and minimal metadata (schema version, saved-assignment fingerprint, timestamp) — never server-owned TanStack Query data. Clear the stored draft after a successful save, version-check and validate it on load, discard stale or malformed stored drafts safely, and keep restored drafts subject to the existing blocking auto-unschedule rules.
- Management search and filters remain frontend-only unless a later spec introduces backend query parameters.
- If a room is deleted, sessions assigned to that room become unscheduled.
- If a solver run fails, existing timetable state must remain unchanged.
- If a solver run partially succeeds, successfully scheduled sessions are persisted and failed sessions remain unscheduled.

## Auth and Access Control

- Use Supabase Auth for authentication.
- In v1, the primary user is an authenticated admin.
- Unauthenticated users must not access timetable data.
- Protected frontend routes must redirect unauthenticated users to login.
- Backend routes must verify authentication independently of frontend route guards.
- Do not trust user IDs or ownership fields supplied by the client.
- In v1, data may be modeled as belonging to a single admin workspace.
- If multiple admin accounts are allowed, each account must be isolated from other accounts' data.
- Do not add student or lecturer roles in v1.
- Do not add multi-admin collaboration in v1.

## Error Handling

- User-facing errors should be specific, actionable, and non-technical.
- Developer-facing errors should be structured and logged.
- Do not swallow errors silently.
- Do not expose stack traces to users.
- Constraint failures are not system errors; represent them as validation results.
- Solver infeasibility is not a crash; represent it as a partial or failed solver result.
- API errors must use consistent response shapes.
- Background job failures must leave timetable state recoverable.
- Log enough context to diagnose solver and validation issues without exposing sensitive data unnecessarily.

## Observability

- Use structlog for structured backend logging.
- Use Sentry for frontend and backend exceptions.
- Include correlation IDs or job IDs for solver-related logs.
- Log solver lifecycle events:
  - job started
  - job completed
  - job failed
  - duration
  - sessions attempted
  - sessions scheduled
  - sessions unscheduled
- Log unexpected validation failures.
- Do not log full student lists unless needed for debugging and safe to do so.
- Prefer counts and IDs over large raw payloads in logs.
- User-visible validation messages should not depend on log output.

## Testing

- Constraint logic must be unit tested.
- Conflict graph generation must be unit tested.
- Solver input compilation must be unit tested.
- Solver behavior must be tested against small deterministic schedules.
- Test cases must include:
  - student conflict
  - lecturer conflict
  - lecturer unavailable slot
  - room double-booking
  - room capacity failure
  - duration crossing lunch
  - duration exceeding available block
  - locked session respected by solver
  - partial solver result
- API routes should be tested for validation, authentication, and mutation behavior.
- Frontend tests should cover key timetable state transitions where practical.
- The frontend test runner is Vitest with React Testing Library (jsdom). Run the frontend suite with `npm test` from `frontend/`. Test files live beside the code they cover as `*.test.ts`/`*.test.tsx`; shared fixtures live in `frontend/src/test/` (outside production feature state).
- Prefer testing pure validation helpers and visible UI outcomes over implementation details. Use fixtures shaped like the real API DTOs.
- Drag/drop behavior should be tested at the highest value level available; avoid brittle low-level pointer tests unless necessary. The equivalent click-based scheduling path is the reliable way to assert drag/drop outcomes.
- Regression tests should be added for every solver bug fixed.
- Do not rely only on manual testing for constraint behavior.

## File Organization

- `frontend/` — React application, route structure, UI components, hooks, client-side validation display, and timetable interactions.
- `frontend/src/routes/` — route-level pages such as `/timetable`, `/units`, `/lecturers`, `/students`, and `/rooms`.
- `frontend/src/components/` — reusable UI components that are not route-specific.
- `frontend/src/components/ui/` — shadcn/ui generated and wrapped components.
- `frontend/src/features/timetable/` — timetable grid, session cards, drag/drop behavior, unscheduled pool, selected-session UI, and timetable-specific hooks. Includes `draftStorage.ts` (versioned browser-storage helper for the unsaved draft), `unitColors.ts` (`getSubjectTokens`, mapping unit codes to subject colour tokens), and `blocks.ts` (`buildBlockedCellMap`, `buildBlockAnchorData`, `getBlockColorTokens` — block flattening and multi-room horizontal merging helpers). The slot-ID-to-human-time-label helper lives in `frontend/src/lib/slot-label.ts`.
- `frontend/src/features/units/` — unit and session management UI.
- `frontend/src/features/lecturers/` — lecturer management and availability UI.
- `frontend/src/features/students/` — student management UI.
- `frontend/src/features/rooms/` — room management UI.
- `frontend/src/lib/api/` — API client functions and TanStack Query hooks. The shared `client.ts` `apiRequest` omits the JSON `Content-Type` when the body is `FormData` so multipart uploads keep the browser-set boundary, and exposes `apiRequestBlob` — a small authenticated binary GET helper (same Supabase bearer auth and structured-error parsing as `apiRequest`, but returns `{ blob, filename }` with the filename parsed from `Content-Disposition`) for file downloads rather than overloading JSON parsing. Includes `students.ts` (student DTOs incl. `student_number`, `StudentImportResult`, and `uploadStudentCsv(file)` posting the import CSV as multipart), `timetableBlocks.ts` (block colour type, block group/cell DTOs, create/update input types, and `listTimetableBlocks` / `createTimetableBlock` / `updateTimetableBlock` / `deleteTimetableBlock` over the authenticated client), and `timetableExport.ts` (`exportSavedTimetableExcel({ title })` GETting the Unit 93 `/timetable/export.xlsx?title=…` blob via `apiRequestBlob`, plus the `triggerBlobDownload` and `fallbackExportFilename` download helpers). The timetable route loads blocks under the `['timetable-blocks']` query key.
- `frontend/src/lib/types/` — frontend-facing shared types and DTO imports.
- `frontend/src/lib/validation/` — frontend-safe validation helpers and constraint display helpers, including the `timetable_slot_blocked` blocking rule that rejects placements over blocked cells.
- `frontend/src/lib/unit-code-parser.ts` — frontend-only unit-code parser deriving subject, colour tokens, and year level from the `AAA999` code for display, filtering, and validation UX.
- `frontend/src/stores/` — Zustand stores for UI-only state.
- `backend/` — FastAPI backend application.
- `backend/api/` — FastAPI routers and request/response boundaries.
- `backend/models/` — SQLAlchemy ORM models.
- `backend/schemas/` — Pydantic request and response schemas.
- `backend/services/` — application services for domain operations, including `timetable_excel_export.py` (Unit 93 saved-timetable `.xlsx` rendering).
- `backend/export_templates/` — the repo-owned static export template (`campion_timetable_export_template.xlsx`) and the one-off `build_template.py` that derives it from the uploaded source workbook. The uploaded source lives under `backend/assets/excel/`.
- `backend/constraints/` — hard constraint definitions, conflict graph generation, and validation logic, including the `timetable_slot_blocked` constraint mirror.
- `backend/solver/` — OR-Tools model compilation and solver execution functions. The snapshot builder, CP-SAT model, and result application all consume blocked cells so generated assignments never occupy a blocked cell.
- `jobs/` — Trigger.dev job definitions and background orchestration. This is a standalone top-level Node/TypeScript project (Trigger.dev is Node-based) and therefore lives beside `backend/` rather than inside the Python `backend/` package, matching the `jobs/` boundary in `architecture-context.md`.
- `backend/db/` — database session setup, migrations integration, and persistence utilities.
- `backend/auth/` — authentication helpers and current-user dependencies.
- `backend/log/` — structlog configuration and logging helpers (named `log/`, not `logging/`, to avoid shadowing the Python stdlib `logging` module).
- `backend/observability/` — Sentry exception capture, request/correlation ID middleware, and safe log payload conventions. Layers on top of the `backend/log/` structlog foundation rather than replacing it.
- `shared/` — cross-application domain contracts if shared generation or schema export is used.
- `docs/` — project documentation such as `architecture.md`, `project-overview.md`, and `code-standards.md`.
