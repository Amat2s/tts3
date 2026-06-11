# Unit 40 Spec: Backend Solver Constraint Mirror

## Goal

Add backend constraint definitions that mirror the frontend validation model for solver use. This is not a user-facing validation system and should not introduce a validation API for the timetable editor.

## Design

- Keep this unit inside `backend/constraints/`.
- Mirror frontend blocking/warning concepts closely enough for solver correctness.
- Backend constraints should support solver input compilation.
- Do not make the backend the source of UX validation.
- Do not add user-defined constraints.

## Implementation

### Scope

Build:

- constraint type enum;
- severity enum with `blocking` and `warning` concepts;
- structured solver-side constraint objects;
- conflict graph generation;
- student-overlap conflict derivation;
- lecturer-overlap conflict derivation;
- unit/session overlap derivation where applicable;
- fixture-based tests.

### Constraint Parity

The backend mirror should include rules corresponding to frontend validation:

- room double-booking;
- room capacity;
- lunch crossing;
- off-timetable placement;
- lecturer overlap;
- student overlap;
- unit/session overlap;
- lecturer availability.

### Out of Scope

Do not implement:

- user-facing validation endpoint;
- frontend validation display;
- solver CP-SAT model;
- solver job integration.

## Dependencies

Units 14, 18, 25, and 31.

## Verification Checklist

- [ ] Backend constraint mirror types exist.
- [ ] Conflict graph generation exists.
- [ ] Lecturer overlap can be derived.
- [ ] Student overlap can be derived.
- [ ] Unit/session overlap can be derived where applicable.
- [ ] Tests use real-format fixtures.
- [ ] No user-facing validation API has been added.
