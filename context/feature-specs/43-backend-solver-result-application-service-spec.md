# Unit 43 Spec: Backend Solver Result Application Service

## Goal

Create the backend service that safely applies solver results to the saved timetable assignment state. The result should let backend tests prove that solver-generated assignments can be persisted without corrupting locked assignments or losing unscheduled sessions.

## Design

- Keep this unit inside `backend/solver/` or `backend/services/` with a clean solver-facing boundary.
- The CP-SAT module returns a result object; this service applies that object to the database.
- Existing saved assignments that were locked solver inputs must be preserved.
- Newly scheduled solver assignments should be persisted through backend-controlled assignment logic.
- Sessions the solver cannot place must remain unscheduled.
- Solver failure must leave the existing saved timetable unchanged.
- Partial success is valid and should be represented explicitly.
- Do not run this service from a request handler yet.

## Implementation

### Scope

Build the solver result application service only.

This unit should include:

- result application function/service;
- transaction-scoped persistence;
- preservation of locked saved assignments;
- insertion or replacement of solver-generated assignments for previously unscheduled sessions;
- explicit handling of unscheduled solver failures;
- partial-success metadata calculation;
- rollback behavior on error;
- structured internal result object for future job/API status;
- tests using real-format fixtures.

### Application Rules

When applying a successful or partially successful solver result:

- keep locked saved assignments unchanged;
- save generated assignments for sessions the solver placed;
- leave unplaced sessions without assignments;
- do not delete sessions;
- do not alter rooms, lecturers, students, units, or session definitions;
- do not silently discard generated assignments;
- do not persist duplicate assignments for the same session.

### Failure Safety

If the solver result is failed, invalid, or cannot be applied:

- do not mutate the saved timetable assignment state;
- roll back the transaction;
- return or raise a structured application failure;
- preserve enough logging context for diagnosis.

### Partial Result Metadata

The service should return metadata needed later by solver status and frontend UI:

- scheduled count;
- unscheduled count;
- whether the result is partial;
- list of newly scheduled session ids;
- list of remaining unscheduled session ids;
- preserved locked assignment count;
- concise status message.

### Defensive Validation

Before committing generated assignments, defensively verify:

- referenced session ids exist;
- referenced room ids exist;
- slot ids are valid `s1`-`s7`;
- generated placements do not violate blocking integrity rules;
- generated assignments do not overwrite locked saved assignments.

This is backend safety, not user-facing validation.

### Out of Scope

Do not implement:

- CP-SAT modeling;
- solver input snapshot builder;
- Trigger.dev job;
- solver start/status API;
- frontend solver client;
- frontend solver UI integration;
- timetable version history;
- soft constraints;
- user-facing validation API.

## Dependencies

This unit depends on:

- Unit 31 backend saved timetable assignment persistence;
- Unit 42 solver CP-SAT module.

No new package should be required.

## Verification Checklist

- [ ] Result application service exists.
- [ ] Solver-generated assignments can be persisted.
- [ ] Locked saved assignments are preserved.
- [ ] Failed solver results do not mutate saved assignments.
- [ ] Partial solver results persist scheduled sessions and leave failed sessions unscheduled.
- [ ] Duplicate assignment persistence is prevented.
- [ ] Defensive assignment checks run before commit.
- [ ] Transaction rollback behavior is tested.
- [ ] Result metadata includes scheduled and unscheduled counts.
- [ ] Tests use real-format fixtures.
- [ ] No job or API route has been added.
