# Unit 47 Spec: Frontend Solver API Client

## Goal

Add frontend API functions and DTO types for starting solver runs and reading solver status. The result should let frontend code call the protected backend solver endpoints without integrating the solver UI yet.

## Design

- Keep this unit inside `frontend/`.
- Build only the API client layer.
- Use the authenticated API base client from Unit 6.
- Do not duplicate solver state in Zustand.
- Do not start the solver from this unit’s UI.
- Do not add polling UI yet.
- DTOs must match the backend Unit 46 response shapes.

## Implementation

### Scope

Build frontend solver API client support only.

This unit should include:

- solver start API function;
- solver status API function;
- solver status DTO type;
- solver run id type if useful;
- solver status enum/union;
- solver-specific API error parsing;
- build-safe exports for later integration.

### DTO Shape

Represent backend solver status fields such as:

- solver run id;
- status:
  - `pending`;
  - `running`;
  - `succeeded`;
  - `failed`;
- scheduled count;
- unscheduled count;
- partial success flag;
- failure message;
- created/updated timestamps if returned.

Use backend JSON field names consistently with existing API-client conventions.

### API Functions

Create functions such as:

- `startSolverRun()`;
- `getSolverRunStatus(runId)`.

These functions should:

- use the shared authenticated API client;
- attach Supabase auth token via the base client;
- parse backend structured errors consistently;
- not accept frontend draft assignment payloads.

### Error Handling

Add solver-specific message handling for common cases such as:

- solver already running;
- saved timetable state is not usable;
- backend defensive check failed;
- job trigger failed;
- solver run not found.

Do not swallow errors silently.

### Out of Scope

Do not implement:

- solver UI button behavior;
- polling integration;
- editing disabled state;
- timetable refresh on solver completion;
- assignment save behavior;
- frontend validation engine changes;
- backend solver endpoints;
- mock solver statuses.

## Dependencies

This unit depends on:

- Unit 6 authenticated API base client;
- Unit 37 frontend validation display and solver gate shell;
- Unit 46 backend solver start and status API.

No new package should be required.

## Verification Checklist

- [ ] Solver status DTO exists.
- [ ] Solver status union/enum includes pending, running, succeeded, failed.
- [ ] `startSolverRun` API function exists.
- [ ] `getSolverRunStatus` API function exists.
- [ ] API functions use the authenticated API base client.
- [ ] API functions do not send frontend draft assignments.
- [ ] Solver-specific error parsing exists where useful.
- [ ] No TanStack Query polling integration has been added.
- [ ] No solver UI behavior has been added.
- [ ] No mock solver data has been added.
- [ ] The frontend build command succeeds.
