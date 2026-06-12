# Unit 48 Spec: Frontend Async Solver Integration

## Goal

Connect the solver UI shell to the production backend async solver flow. The result should let the admin run the solver only when the frontend validation engine reports no issues, watch solver status, and refresh the saved timetable/draft when the solver completes.

## Design

- Keep this unit in the frontend/backend/jobs connection boundary.
- Use the solver UI shell and validation gate from Unit 37.
- Use the solver API client from Unit 47.
- The frontend must remain the source of user-facing validation.
- The solver button is enabled only when there are no blocking or warning validation issues.
- Solver starts from saved timetable state, so unsaved draft changes must be handled explicitly before starting.
- Editing is disabled while a solver run is active.
- On completion, refresh saved assignments and reset the draft from saved data.
- Do not add new backend validation APIs.

## Implementation

### Scope

Wire the full async solver flow into the timetable page.

This unit should include:

- start solver mutation;
- solver status polling or refetch loop;
- solver button enabled/disabled behavior;
- unsaved-draft handling before solver start;
- editing disabled while solver is pending/running;
- timetable assignment refresh on solver success;
- draft reset from latest saved assignments;
- success, partial-success, failure, and running UI states;
- actionable user-facing error messages.

### Solver Start Gating

The solver button should be disabled when:

- frontend blocking validation issues exist;
- frontend warning validation issues exist;
- a solver run is pending or running;
- saved assignments are out of sync with the current frontend draft;
- required timetable data is unavailable.

The disabled state must explain why.

Because solver runs from saved timetable state, if the current draft has unsaved changes, the UI should require the admin to save first before starting the solver.

### Running State

While solver status is `pending` or `running`:

- disable timetable editing;
- disable save timetable actions;
- show a running indicator in the solver/action bar;
- keep existing timetable visible;
- avoid destructive UI resets.

### Completion Handling

When solver status becomes `succeeded`:

- refetch saved assignments;
- refetch schedulable/unscheduled sessions if needed;
- reset the frontend draft from saved assignments;
- show scheduled/unscheduled counts;
- show partial-success warning if unscheduled count is greater than zero or backend marks partial success.

When solver status becomes `failed`:

- keep existing timetable/draft stable;
- re-enable editing;
- show a clear failure message;
- do not silently discard frontend draft state.

### Polling

Use TanStack Query or the existing frontend data-fetching pattern for solver status polling.

Polling should:

- run only while a solver run is active;
- stop on success or failure;
- avoid excessive request frequency;
- clean up correctly if the component unmounts.

### Assignment and Pool Refresh

After successful solver completion:

- invalidate/refetch saved assignment query;
- invalidate/refetch schedulable sessions if the unscheduled pool depends on assignment state;
- ensure scheduled cards render from the latest saved/draft reset state;
- ensure sessions the solver could not place remain visible in the unscheduled pool.

### Out of Scope

Do not implement:

- backend solver start/status routes;
- solver API client functions;
- CP-SAT solver logic;
- Trigger.dev job logic;
- backend validation API;
- soft constraints;
- timetable version history;
- student/lecturer views.

## Dependencies

This unit depends on:

- Unit 37 frontend validation display and solver gate shell;
- Unit 39 frontend drag-and-drop save integration;
- Unit 47 frontend solver API client.

No new package should be required if TanStack Query is already installed.

## Verification Checklist

- [ ] Solver button calls the production solver start endpoint.
- [ ] Solver button is blocked by any frontend validation issue.
- [ ] Solver button is blocked when draft changes are unsaved.
- [ ] Disabled solver state explains the reason.
- [ ] Solver status is polled only while active.
- [ ] Editing is disabled while solver is pending/running.
- [ ] Save action is disabled while solver is pending/running.
- [ ] Successful solver completion refreshes saved assignments.
- [ ] Frontend draft resets from latest saved assignments after solver success.
- [ ] Partial-success warning shows real counts.
- [ ] Failed solver run keeps timetable state stable and shows an error.
- [ ] Unscheduled sessions that solver cannot place remain visible.
- [ ] No backend validation API has been added.
- [ ] The frontend build command succeeds.
