# Unit 45 Spec: Async Solver Job

## Goal

Create the Trigger.dev solver job that runs the solver flow asynchronously and applies the result through backend-controlled services. The result should allow a solver run to execute outside FastAPI request handlers while preserving saved timetable state on failure.

## Design

- Keep orchestration inside `jobs/`.
- Keep solver business logic inside backend solver services.
- The job should receive a solver run reference or snapshot reference, not mutable frontend draft state.
- The job should build solver input from saved database state.
- The job should call the CP-SAT solver module.
- The job should apply results through the Unit 43 result application service.
- Existing saved timetable state must remain recoverable if the job fails.
- Do not add frontend integration in this unit.

## Implementation

### Scope

Build the async solver job only.

This unit should include:

- solver job definition;
- job input payload type;
- call to solver input snapshot builder;
- call to CP-SAT solver module;
- call to solver result application service;
- structured logging for job lifecycle;
- failure handling that preserves saved assignments;
- status/result shape suitable for the later API layer;
- tests or local dev verification path where practical.

### Job Input

The job should receive a stable reference such as:

- solver run id;
- authenticated admin/workspace id if already modeled;
- correlation id;
- optional saved assignment snapshot id if introduced later.

Do not pass the frontend draft assignment array directly into the job.

The solver should run only from saved timetable state.

### Job Flow

The job should follow this sequence:

1. Log solver job start.
2. Load/build solver input snapshot from saved data.
3. Run CP-SAT solver.
4. Apply solver result through the backend result application service.
5. Log completion metadata.
6. Return structured result metadata.

If any step fails:

- log the failure;
- do not corrupt saved assignments;
- return or record a failed status with a concise failure message.

### Logging

Log at minimum:

- solver run id or correlation id;
- start time;
- completion/failure;
- duration;
- sessions attempted;
- sessions scheduled;
- sessions unscheduled;
- partial success flag.

Avoid logging full student lists unless necessary and safe.

### Out of Scope

Do not implement:

- solver start endpoint;
- solver status endpoint;
- frontend solver API client;
- frontend polling;
- frontend solver UI integration;
- production Trigger.dev deployment;
- soft constraints;
- user-facing validation API.

## Dependencies

This unit depends on:

- Unit 41 backend solver input snapshot builder;
- Unit 42 solver CP-SAT module;
- Unit 43 backend solver result application service;
- Unit 44 Trigger.dev setup.

No additional package should be needed beyond Trigger.dev and OR-Tools already introduced.

## Verification Checklist

- [ ] Solver job is registered.
- [ ] Job input payload type exists.
- [ ] Job builds solver input from saved database state.
- [ ] Job calls CP-SAT solver module.
- [ ] Job applies results through the result application service.
- [ ] Job does not contain solver modeling logic directly.
- [ ] Job does not receive frontend draft assignments.
- [ ] Job failure preserves saved assignment state.
- [ ] Job logs start, completion, failure, duration, scheduled count, and unscheduled count.
- [ ] Job returns or records structured result metadata.
- [ ] No solver API or frontend integration has been added.
