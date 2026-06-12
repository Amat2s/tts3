# Unit 46 Spec: Backend Solver Start and Status API

## Goal

Add protected backend endpoints for starting an async solver run and reading solver status. The result should let authenticated API callers start the solver from saved timetable state and poll for status without running solver work inside request handlers.

## Design

- Keep this unit inside `backend/` API/service boundaries.
- Solver start must operate from saved timetable assignments only.
- The frontend remains responsible for user-facing validation and should only call start when no blocking or warning issues exist.
- Backend start should still run defensive integrity checks before triggering the job.
- The endpoint must not accept frontend draft assignments as solver input.
- Long-running solver work must be delegated to the async job from Unit 45.
- Status responses should be predictable and frontend-friendly.

## Implementation

### Scope

Build solver start/status backend API only.

This unit should include:

- solver run persistence model or lightweight status storage if needed;
- migration if solver run records are persisted in Postgres;
- solver start service;
- protected `start solver` endpoint;
- protected `get solver status` endpoint;
- Trigger.dev job trigger call;
- defensive pre-start integrity checks;
- structured status response schema;
- structured failure response shape;
- tests for auth, start, and status behavior.

### Solver Run State

Represent solver job state using explicit statuses:

- `pending`;
- `running`;
- `succeeded`;
- `failed`.

If useful, include:

- solver run id;
- job id;
- created timestamp;
- updated timestamp;
- scheduled count;
- unscheduled count;
- partial success flag;
- failure message.

Do not expose raw Trigger.dev internals unless they are needed by the frontend.

### Start Endpoint

The start endpoint should:

- require authenticated admin access;
- reject if another solver run is already active if concurrent runs would be unsafe;
- perform backend defensive checks against saved timetable state;
- create or initialize solver run status;
- trigger the async solver job;
- return solver run/status identifier.

The start endpoint should not:

- run OR-Tools directly;
- accept draft assignments from the request body;
- perform user-facing validation logic;
- silently modify timetable assignments before the job runs.

### Status Endpoint

The status endpoint should:

- require authenticated admin access;
- return a predictable status object;
- include counts and partial-success metadata when available;
- include an actionable failure message if failed;
- avoid leaking stack traces or internal solver details.

### Defensive Checks

Before starting a solver run, verify saved state is internally usable:

- rooms exist;
- schedulable sessions exist or return a harmless no-work status if appropriate;
- saved assignments do not violate blocking integrity rules;
- referenced rooms/sessions still exist;
- no active solver run is already mutating the timetable.

If a defensive check fails, return a structured backend error. This should be rare because frontend validation owns normal UX gating.

### Out of Scope

Do not implement:

- frontend solver API client;
- frontend solver UI integration;
- CP-SAT solver logic;
- Trigger.dev job internals;
- user-facing validation API;
- soft constraints;
- deployment wiring.

## Dependencies

This unit depends on:

- Unit 40 backend solver constraint mirror;
- Unit 45 async solver job.

No new package should be required if Trigger.dev setup is already complete.

## Verification Checklist

- [x] Protected solver start endpoint exists.
- [x] Protected solver status endpoint exists.
- [x] Start endpoint requires auth.
- [x] Status endpoint requires auth.
- [x] Solver start uses saved timetable state only.
- [x] Start endpoint does not accept frontend draft assignments.
- [x] Start endpoint does not run solver work inside request handler.
- [x] Async solver job is triggered.
- [x] Status values are explicit: pending, running, succeeded, failed.
- [x] Scheduled/unscheduled counts can be returned when available.
- [x] Partial success metadata can be returned.
- [x] Defensive integrity failures return structured errors.
- [x] Internal stack traces are not exposed.
