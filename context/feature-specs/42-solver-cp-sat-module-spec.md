# Unit 42 Spec: Solver CP-SAT Module

## Goal

Build the OR-Tools CP-SAT solver module that turns a solver input snapshot into a valid partial timetable solution. The result should let backend tests prove that the solver can schedule unscheduled sessions while respecting saved locked assignments and all v1 hard scheduling constraints.

## Design

- Keep this unit inside `backend/solver/`.
- Install OR-Tools only in this unit.
- Solver code must receive an explicit solver input object from Unit 41.
- Solver code must not query the database directly.
- Saved assignments are fixed locked constraints.
- Unscheduled sessions are decision variables.
- The solver should attempt to place as many unscheduled sessions as possible.
- Partial results are valid in v1.
- The solver should model only hard constraints. Do not introduce soft preferences.
- Keep the result object explicit enough for the later result-application service and frontend solver status UI.

## Implementation

### Scope

Build the CP-SAT solving module only.

This unit should include:

- OR-Tools dependency;
- solver model entry function;
- explicit solver input and output type usage;
- room assignment variables;
- day/start-slot variables;
- optional scheduled/not-scheduled variables for unscheduled sessions;
- fixed constraints for locked saved assignments;
- room no-overlap constraints;
- room capacity constraints;
- lecturer no-overlap constraints;
- student no-overlap constraints;
- unit/session overlap constraints where applicable;
- lecturer availability constraints;
- duration contiguity handling;
- lunch boundary handling;
- off-timetable boundary handling;
- objective to maximize scheduled unscheduled sessions;
- deterministic solver parameters where practical;
- timeout behavior;
- tests using small deterministic fixtures.

### Solver Input Contract

The solver should accept only the snapshot built by Unit 41.

Do not let the solver module:

- query SQLAlchemy sessions;
- fetch API data;
- read frontend draft state;
- interpret raw ORM models;
- mutate saved assignment tables.

### Variables

For each unscheduled session, model placement variables such as:

- whether the session is scheduled;
- assigned room;
- assigned day;
- assigned start slot.

The exact modeling approach may vary, but it must support:

- optional placement for partial results;
- enforcing constraints only when the session is selected/scheduled;
- recovering a concrete assignment result when scheduled.

Locked saved assignments should be treated as fixed occupied intervals and must not be moved.

### Constraints

Apply all v1 hard scheduling constraints needed by the solver:

- no room double-booking;
- room capacity must be at least session student count;
- session duration must fit inside timetable boundaries;
- session duration must not cross lunch;
- lecturer cannot be double-booked;
- students cannot be double-booked;
- sessions in the same unit/course cannot overlap where this rule is represented in the constraint mirror;
- lecturer unavailable slots cannot be used.

Although lecturer availability is warning-only in frontend manual placement, the solver should respect it as a hard solver constraint so generated timetables avoid known unavailability.

### Objective

Use a simple v1 objective:

- maximize the number of previously unscheduled sessions that are successfully scheduled.

Do not add soft preferences such as:

- minimizing gaps;
- preferring mornings;
- balancing room use;
- minimizing movement;
- avoiding lecturer late days.

### Result Shape

Return a structured result object containing:

- solver status;
- assignments generated for previously unscheduled sessions;
- locked assignments preserved from input;
- session ids that remain unscheduled;
- scheduled count;
- unscheduled count;
- timeout flag if relevant;
- concise diagnostic message for logs/status, not raw solver internals.

Do not apply results to the database in this unit.

### Out of Scope

Do not implement:

- solver input snapshot builder;
- database persistence of solver results;
- Trigger.dev job execution;
- solver start/status API;
- frontend solver API client;
- frontend solver UI integration;
- soft constraints;
- user-facing backend validation API.

## Dependencies

This unit depends on:

- Unit 41 backend solver input snapshot builder.

Install:

- `ortools`.

## Verification Checklist

- [ ] OR-Tools is installed in backend dependencies.
- [ ] Solver module lives inside `backend/solver/`.
- [ ] Solver accepts explicit snapshot input only.
- [ ] Solver does not query the database.
- [ ] Locked saved assignments are fixed and preserved.
- [ ] Unscheduled sessions are optional decision variables.
- [ ] Room no-overlap is enforced.
- [ ] Room capacity is enforced.
- [ ] Lecturer no-overlap is enforced.
- [ ] Student no-overlap is enforced.
- [ ] Unit/session overlap rule is enforced where applicable.
- [ ] Lecturer availability is respected by generated solver output.
- [ ] Lunch crossing is prevented.
- [ ] Off-timetable placements are prevented.
- [ ] Objective maximizes scheduled session count.
- [ ] Partial solver results are represented explicitly.
- [ ] Timeout behavior is explicit.
- [ ] Tests cover small deterministic schedules.
- [ ] No database result application has been added.
