# Unit 41 Spec: Backend Solver Input Snapshot Builder

## Goal

Build the backend service that compiles the current saved timetable state into a deterministic solver input snapshot. The result should let backend tests prove that rooms, lecturers, students, units, sessions, saved assignments, availability, and mirrored constraints can be transformed into one explicit input object for the solver.

## Design

- Keep this unit inside `backend/solver/`.
- The builder must read canonical persisted data, not frontend draft state.
- The solver input snapshot should be an explicit data object, not a database session or ORM graph passed into OR-Tools.
- Saved assignments are treated as locked inputs only after the solver start flow has established that the frontend has no current validation issues.
- Backend defensive checks may still reject impossible saved states before snapshot creation, but this is not a user-facing validation system.
- Use the backend constraint mirror from Unit 40 for conflict graph and solver-ready rule compilation.
- Do not build the CP-SAT model in this unit.

## Implementation

### Scope

Build the solver input snapshot builder only.

This unit should include:

- solver input DTOs or dataclasses;
- snapshot builder service;
- loading of rooms, lecturers, students, units, sessions, saved assignments, and lecturer availability;
- derived session scheduling context:
  - unit code;
  - unit name;
  - inherited lecturer;
  - inherited students;
  - student count;
  - duration;
- locked-assignment extraction from saved assignments;
- unscheduled-session extraction from sessions without saved assignments;
- conflict graph integration from Unit 40;
- defensive rejection of impossible saved assignment shapes;
- deterministic ordering for all solver input collections;
- fixture-based tests.

### Snapshot Shape

The solver input should include enough structured data for the later CP-SAT unit to model the timetable without querying the database.

At minimum, include:

- rooms:
  - room id;
  - name;
  - capacity;
  - room type if already present;
- sessions:
  - session id;
  - unit id;
  - unit code;
  - unit name;
  - session type;
  - duration;
  - lecturer id;
  - student ids;
  - student count;
- availability:
  - lecturer id;
  - unavailable day/slot pairs;
- saved assignments:
  - session id;
  - day;
  - start slot;
  - room id;
  - duration;
- unscheduled session ids;
- conflict graph or conflict pair sets:
  - lecturer conflicts;
  - student conflicts;
  - unit/session conflicts where applicable;
- timetable constants:
  - Monday-Friday days;
  - `s1`-`s7` slots;
  - AM/PM block boundaries;
  - lunch gap rule.

### Saved Assignment Treatment

Saved assignments are the only persisted timetable placement state.

The builder should:

- treat saved assigned sessions as locked/fixed for the solver;
- treat sessions without saved assignments as solver variables;
- not infer assignments from frontend draft state;
- not create assignments automatically;
- not silently drop invalid persisted assignments.

If persisted assignments violate blocking integrity rules, raise a structured internal error for the solver start flow to handle.

### Defensive Integrity Checks

The builder should defensively reject impossible saved state before a solver input is produced, including:

- assignment references missing sessions;
- assignment references missing rooms;
- start slot outside `s1`-`s7`;
- duration that crosses lunch;
- duration that runs beyond the day;
- room capacity below student count;
- room double-booking among saved assignments.

These checks protect solver integrity. They should not replace frontend user-facing validation.

### Determinism

To keep solver behavior testable, the snapshot should be deterministic.

Sort collections by stable keys, such as:

- rooms by name or id;
- units by code;
- sessions by unit code, session type order, then id;
- assignments by day, room, slot, then session id;
- conflict pairs by sorted ids.

### Out of Scope

Do not implement:

- OR-Tools model variables;
- solver execution;
- result application;
- Trigger.dev jobs;
- solver API routes;
- frontend solver client;
- user-facing validation API;
- frontend validation logic;
- soft constraints;
- timetable version history.

## Dependencies

This unit depends on:

- Unit 31 backend saved timetable assignment persistence;
- Unit 40 backend solver constraint mirror.

No new package should be required.

## Verification Checklist

- [ ] Solver input DTOs or dataclasses exist.
- [ ] Snapshot builder loads persisted rooms, lecturers, students, units, sessions, assignments, and availability.
- [ ] Saved assignments become locked solver inputs.
- [ ] Sessions without saved assignments become solver variables.
- [ ] Conflict graph data from Unit 40 is included.
- [ ] Timetable constants use Monday-Friday and `s1`-`s7` only.
- [ ] Defensive checks reject impossible saved assignments.
- [ ] Builder does not query frontend draft state.
- [ ] Builder does not create or modify assignments.
- [ ] Snapshot ordering is deterministic.
- [ ] Tests use real-format fixtures.
- [ ] No CP-SAT model or solver API has been added.
