# Unit 51 Spec: Backend Constraint and Solver Test Suite

## Goal

Add backend tests for the solver-side constraint mirror, solver input builder, CP-SAT solver, async result application, and failure safety. The result should verify backend solver correctness independently of frontend UX validation.

## Design

- Keep this unit in `backend/` and `backend/solver/` test boundaries.
- Tests should use real-format fixtures, not production mock state.
- Backend tests should validate solver-side constraints, not recreate frontend UX validation.
- The backend constraint mirror exists so the solver can safely reason over saved timetable state.
- Tests should be deterministic and small.
- Failed solver runs must not corrupt saved timetable assignments.

## Implementation

### Scope

This unit should include tests for:

- solver constraint mirror;
- conflict graph generation;
- solver input snapshot compilation;
- CP-SAT scheduling behavior;
- locked saved assignments;
- partial solver results;
- solver result application;
- failure safety.

### Required Cases

Add fixture-driven tests for at least:

- lecturer conflict;
- student conflict;
- lecturer unavailable slot;
- unit/session overlap conflict where applicable;
- room double-booking;
- room capacity failure;
- duration crossing lunch;
- duration exceeding available block;
- locked scheduled session respected by solver;
- unscheduled session successfully scheduled;
- partial solver result when not all sessions fit;
- failed solver run preserves existing saved assignments.

### Test Fixture Rules

Fixtures should:

- use the same DTO/domain shapes consumed by the solver input builder;
- be minimal and readable;
- avoid hidden dependencies on frontend state;
- avoid large fixture files unless necessary.

### Determinism

Solver tests should set explicit timeouts and deterministic settings where practical.

Assertions should verify product outcomes, not implementation internals, unless testing a pure helper such as conflict graph generation.

### Out of Scope

Do not add frontend tests, browser tests, deployment config, new solver features, new constraints, soft constraints, or user-facing validation behavior in this unit.

## Dependencies

This unit depends on Units 40, 42, 43, and 45. Add pytest/testing dependencies only if the backend does not already have a test setup.

## Verification Checklist

- [ ] Backend test command exists and runs.
- [ ] Constraint mirror tests cover lecturer, student, availability, room, capacity, lunch, and boundary cases.
- [ ] Conflict graph tests are deterministic.
- [ ] Solver input builder tests compile real-format data into solver input.
- [ ] Solver tests respect locked saved assignments.
- [ ] Solver tests return partial results when full scheduling is impossible.
- [ ] Result application tests persist successful solver assignments.
- [ ] Failure tests prove existing saved assignments remain unchanged.
- [ ] Tests do not depend on frontend draft state.
- [ ] Tests do not introduce soft constraints or v2 behavior.
