# Code Standards

## General

- Keep modules small, single-purpose, and aligned with the system boundary they belong to.
- Fix root causes instead of layering workarounds around unclear state or duplicated logic.
- Do not mix unrelated concerns in one component, route, service, or solver function.
- Keep domain logic separate from UI rendering, persistence, API routing, background job execution, and solver modeling.
- Treat sessions as the atomic scheduling unit throughout the codebase.
- Treat scheduled sessions as locked by definition.
- Do not introduce a third persistent session state beyond scheduled and unscheduled in v1.
- Invalid placements are allowed in the UI, but they must be represented as constraint violations, not as a separate persistent state.
- Keep hard constraint definitions explicit, versioned, and developer-defined.
- Do not add user-defined constraint rules in v1.
- Prefer clear data transformations over implicit side effects.
- Prefer deterministic behavior for validation, constraint compilation, and solver input generation.
- Long-running work must not run inside request handlers.
- Solver execution must happen through the background job system.
- The frontend may perform fast local validation for responsiveness, but backend validation remains the final authority.
- Avoid hidden recovery behavior. If the system changes timetable state automatically, the reason must be explicit in the code and visible in the UI when relevant.
- Do not silently discard sessions, assignments, constraint violations, or solver failures.

## TypeScript

- Strict mode is required throughout the frontend.
- Avoid `any`. Use explicit interfaces, discriminated unions, or narrowly scoped unknown parsing.
- Validate unknown external input at system boundaries before trusting it.
- Shared domain types must represent real product concepts, not UI convenience structures.
- Use explicit types for session state, timetable assignment, solver status, and constraint violation objects.
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
- Use Zustand only for UI state such as selected session, active drag state, expanded panels, filters, and local layout preferences.
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
- Invalid timetable placements may be rendered, but they must always be paired with visible constraint feedback.
- The solver button must be disabled whenever authoritative validation reports hard constraint violations.
- The disabled solver state must explain why the solver cannot run.
- Scheduled session cards should be rendered from assignment data, not from duplicated local placement state.
- The unscheduled pool should be derived from sessions without assignments.
- Keep accessibility in mind for drag/drop interactions; provide non-drag alternatives where practical.

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
- Treat backend validation as authoritative even when the frontend performs local checks.
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
- Represent day, slot, and session state with enums or constrained values.
- Do not accept arbitrary JSON blobs for core scheduling entities unless the shape is validated.
- Keep validation error messages precise enough to help the frontend display actionable feedback.

## SQLAlchemy and Alembic

- Use SQLAlchemy 2.0 style models and queries.
- Use Alembic for every database schema change.
- Do not modify production schema manually.
- Keep migrations small and reversible where practical.
- Use explicit relationships for core domain entities.
- Store many-to-many relationships, such as session-student membership, in join tables.
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

## Constraint Evaluation

- Constraint definitions must be centralized.
- Do not duplicate conflicting interpretations of the same constraint across frontend, backend, and solver.
- Constraint evaluation must produce structured violation objects.
- A violation object should include:
  - violation type
  - severity
  - affected session IDs
  - affected room ID when relevant
  - affected lecturer ID when relevant
  - affected student IDs when relevant
  - human-readable message
- The frontend may use local constraint evaluation for immediate UI feedback.
- Backend validation must be used before solver execution.
- Solver gating must be based on authoritative hard constraint validation.
- Invalid placements must be highlighted, not silently corrected.
- When data changes make the timetable invalid, keep the timetable visible and surface violations.
- Do not treat unscheduled sessions as constraint violations.
- Do not treat sessions without students as incomplete solely because students are missing.
- Sessions without students have no known student-conflict constraints.
- Constraint graph generation must be deterministic and testable.
- Constraint graph generation should be independent of React, FastAPI route handlers, and database session objects.

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
- Keep timetable grid styling consistent across empty, valid, invalid, selected, dragging, and solver-running states.
- Use clear visual distinction for:
  - unscheduled sessions
  - scheduled sessions
  - selected sessions
  - invalid sessions
  - disabled solver state
  - solver running state
- Constraint violation styling must be accessible and must not rely on color alone.
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
- Backend must validate timetable state before starting a solver job.
- Solver start endpoint must return a job identifier or status object.
- Solver status endpoint must return predictable job state.
- Constraint validation endpoint should return structured violations.
- Mutations that affect scheduled sessions must clearly define whether they preserve, invalidate, or remove assignments.
- Do not silently cascade destructive changes without explicit product behavior.
- Deleting a room must unschedule sessions assigned to that room.
- Data changes that invalidate scheduled sessions must surface violations rather than silently changing unrelated assignments.

## Data and Storage

- Core metadata belongs in Supabase Postgres.
- Store students, lecturers, rooms, units, sessions, enrolments, and timetable assignments in the database.
- Do not use blob storage in v1.
- Do not store large generated files in the database.
- Future generated exports, uploaded imports, and large artifacts should use object storage.
- Do not introduce Redis or caching infrastructure until there is a measured need.
- Treat the database as the source of truth for persisted timetable state.
- Treat the solver input model and conflict graph as derived data.
- Do not persist derived solver structures unless required for performance or debugging.
- Keep scheduled assignment integrity enforceable:
  - scheduled sessions must have day, start slot, and room
  - unscheduled sessions must not have day, start slot, or room
- Do not store invalid placements as a separate persistent state.
- Preserve existing timetable assignments when data changes, unless the product rule explicitly requires unscheduling.
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
- Drag/drop behavior should be tested at the highest value level available; avoid brittle low-level pointer tests unless necessary.
- Regression tests should be added for every solver bug fixed.
- Do not rely only on manual testing for constraint behavior.

## File Organization

- `frontend/` — React application, route structure, UI components, hooks, client-side validation display, and timetable interactions.
- `frontend/src/routes/` — route-level pages such as `/timetable`, `/units`, `/lecturers`, `/students`, and `/rooms`.
- `frontend/src/components/` — reusable UI components that are not route-specific.
- `frontend/src/components/ui/` — shadcn/ui generated and wrapped components.
- `frontend/src/features/timetable/` — timetable grid, session cards, drag/drop behavior, unscheduled pool, selected-session UI, and timetable-specific hooks.
- `frontend/src/features/units/` — unit and session management UI.
- `frontend/src/features/lecturers/` — lecturer management and availability UI.
- `frontend/src/features/students/` — student management UI.
- `frontend/src/features/rooms/` — room management UI.
- `frontend/src/lib/api/` — API client functions and TanStack Query hooks.
- `frontend/src/lib/types/` — frontend-facing shared types and DTO imports.
- `frontend/src/lib/validation/` — frontend-safe validation helpers and constraint display helpers.
- `frontend/src/stores/` — Zustand stores for UI-only state.
- `backend/` — FastAPI backend application.
- `backend/api/` — FastAPI routers and request/response boundaries.
- `backend/models/` — SQLAlchemy ORM models.
- `backend/schemas/` — Pydantic request and response schemas.
- `backend/services/` — application services for domain operations.
- `backend/constraints/` — hard constraint definitions, conflict graph generation, and validation logic.
- `backend/solver/` — OR-Tools model compilation and solver execution functions.
- `backend/jobs/` — Trigger.dev job definitions and background orchestration.
- `backend/db/` — database session setup, migrations integration, and persistence utilities.
- `backend/auth/` — authentication helpers and current-user dependencies.
- `backend/logging/` — structlog configuration and logging helpers.
- `shared/` — cross-application domain contracts if shared generation or schema export is used.
- `docs/` — project documentation such as `architecture.md`, `project-overview.md`, and `code-standards.md`.
