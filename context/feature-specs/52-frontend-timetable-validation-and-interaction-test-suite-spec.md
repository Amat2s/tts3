# Unit 52 Spec: Frontend Timetable Validation and Interaction Test Suite

## Goal

Add frontend tests for timetable draft state, frontend-owned validation, save behavior, drag/drop outcomes where practical, and solver gating. The result should verify the core user-facing timetable behavior without moving validation back to the backend.

## Design

- Keep this unit inside `frontend/`.
- Tests should focus on high-value user-facing timetable behavior.
- Frontend owns all user-facing validation; tests should assert that behavior directly.
- Use fixtures that match real API DTOs and keep them outside production feature state.
- Avoid brittle low-level pointer-event tests unless they are necessary and reliable.
- Prefer testing pure validation helpers and visible UI outcomes.

## Implementation

### Scope

This unit should include tests for:

- no-room state;
- room-created grid rendering;
- unscheduled pool rendering;
- saved assignment loading into draft state;
- manual scheduling draft updates;
- blocked validation rules;
- warning validation rules;
- automatic unscheduling after data changes violate blocking rules;
- save button enabled/disabled behavior;
- successful save refresh behavior;
- save failure behavior;
- solver disabled while validation issues exist;
- solver enabled when no issues exist;
- solver running/success/partial/failure display states;
- drag/drop outcome tests where practical.

### Blocking Validation Tests

Test that these placements are rejected before entering the draft:

- room double-booking;
- room too small;
- crossing lunch;
- running off the timetable.

### Warning Validation Tests

Test that these placements are allowed but produce warnings and block solver:

- lecturer conflict;
- student conflict;
- unit/session overlap where applicable;
- lecturer availability conflict.

### Automatic Unscheduling Tests

When underlying data changes make a scheduled draft assignment violate a blocking rule, tests should confirm that the frontend removes that assignment from the timetable draft and returns the session to the unscheduled pool.

### Save Tests

Tests should confirm that drag/drop/manual changes do not persist until Save is clicked.

### Out of Scope

Do not add backend tests, new validation rules, new API routes, new solver behavior, new product features, or mock production state in this unit.

## Dependencies

This unit depends on Units 48 and 50. Add frontend testing packages only if they are not already present.

## Verification Checklist

- [ ] Frontend test command exists and runs.
- [ ] No-room state is tested.
- [ ] Grid rendering with rooms is tested.
- [ ] Unscheduled pool rendering is tested.
- [ ] Saved assignments load into frontend draft state.
- [ ] Manual scheduling updates frontend draft state only.
- [ ] Blocked placement rules reject impossible placements.
- [ ] Warning placement rules allow placement and show warning feedback.
- [ ] Warning placements block solver execution.
- [ ] Any validation issue blocks solver execution.
- [ ] Data changes that violate blocking rules automatically unschedule affected sessions.
- [ ] Save button persists draft through the assignment API.
- [ ] Failed save leaves draft visible and unsaved.
- [ ] Solver running/success/partial/failure states are tested.
- [ ] Fixtures match real DTO shapes and stay outside production feature state.
