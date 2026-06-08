# Unit 33 Spec: Frontend Manual Scheduling Integration

## Goal

Connect the timetable page to real assignment data and manual scheduling mutations. The result should let an authenticated admin select an unscheduled session, place it into a timetable cell, move a scheduled session, and remove a scheduled session back to the unscheduled pool, with changes persisted through the backend assignment API.

## Design

- Keep this unit in the frontend/backend connection boundary.
- Use the assignment API client from Unit 32.
- Use the schedulable-session and unscheduled-pool work from Units 28 and 29.
- Use the scheduled-session rendering shell from Unit 30 where available.
- Manual scheduling should work without drag-and-drop. Drag-and-drop is introduced later.
- Server-owned assignment data must live in TanStack Query, not Zustand.
- Zustand may be used only for UI state if it already exists or is introduced in the correct later unit, such as selected session or active interaction state.
- Do not implement hard-constraint validation in this unit.
- Do not block invalid placements yet unless the backend rejects malformed data.
- Do not add solver behavior.

## Implementation

### Scope

Wire manual scheduling on the timetable page to real backend assignment persistence.

This unit should include:

- assignment list query;
- render scheduled sessions from real assignment data;
- select unscheduled session for placement;
- place selected unscheduled session into a timetable cell through the backend;
- move a scheduled session through the backend;
- remove a scheduled session back to the unscheduled pool;
- refresh assignments and schedulable sessions after mutations;
- loading states for assignment actions;
- error states for failed assignment actions.

### Data Loading

On `/timetable`, fetch:

- rooms;
- schedulable sessions for the unscheduled pool;
- current assignments.

Use resource-specific query keys, such as:

- `['rooms']`;
- `['schedulable-sessions']`;
- `['assignments']`.

Keep query invalidation explicit after assignment mutations.

After scheduling or unscheduling, refresh both:

- assignments;
- schedulable sessions.

This ensures scheduled sessions leave the unscheduled pool and unscheduled sessions return to it.

### Scheduled Session Rendering

Render scheduled sessions from assignment data only.

A scheduled session card should be positioned using:

- assignment `day`;
- assignment `room_id`;
- assignment `start_slot`;
- session duration from nested session data or a joined session lookup;
- unit/session display data from the assignment response or existing session data.

Do not duplicate scheduled placement state in local component state.

If assignment responses do not include enough display data, compose display data from existing query results without inventing fake values.

### Selecting an Unscheduled Session

Add a manual selection path for unscheduled sessions.

Required behavior:

- the admin can select one session from the unscheduled pool;
- the selected session has a clear visual treatment;
- clicking a valid timetable cell attempts to schedule that selected session;
- after successful placement, selection clears;
- if placement fails, selection remains so the admin can try again.

This is the non-drag manual scheduling path required before drag-and-drop exists.

### Placing a Session

When a selected unscheduled session is placed into a timetable cell, call the schedule assignment API with:

- selected session id;
- target room id;
- target day;
- target start slot.

On success:

- invalidate/refetch assignments;
- invalidate/refetch schedulable sessions;
- clear selected session;
- show the scheduled card in the grid.

On failure:

- show an actionable error;
- do not remove the session from the unscheduled pool locally;
- do not create a fake scheduled card.

### Moving a Scheduled Session

Provide a manual way to move a scheduled session before drag-and-drop exists.

Acceptable approaches:

- select a scheduled session, then click a target cell to move it;
- use a small action/menu on the scheduled card to enter move mode;
- use clear inline controls if they fit the existing UI.

Required behavior:

- moving calls the assignment move API;
- only the selected assignment is moved;
- successful move refreshes assignments;
- failed move shows an actionable error and leaves current rendered state based on backend data.

Do not create duplicate assignments for the same session.

### Unscheduling a Session

Provide a way to remove a scheduled session from the timetable and return it to the unscheduled pool.

Required behavior:

- each scheduled card has a clear remove/unschedule action;
- the action calls the assignment delete/unschedule API;
- successful unscheduling refreshes assignments and schedulable sessions;
- failed unscheduling shows an actionable error.

Do not delete the session record.

### Loading and Disabled States

Show clear loading/disabled states for:

- initial assignment loading;
- scheduling a selected session;
- moving an assignment;
- unscheduling an assignment.

Avoid allowing duplicate submissions while a mutation is in flight.

### Error Handling

Show user-facing errors for:

- assignment list fetch failure;
- schedule failure;
- move failure;
- unschedule failure.

Do not silently discard failed assignment changes.

Errors should be visible near the timetable action area or the relevant session/assignment control.

### Constraint Treatment

This unit does not implement constraint validation.

Manual placements may be persisted even if they will later violate hard constraints. Invalid placement highlighting and solver blocking are introduced in later constraint units.

Backend shape validation still applies, such as invalid room, invalid day, or invalid slot.

### Out of Scope

Do not implement:

- backend assignment routes;
- assignment API client functions;
- drag-and-drop behavior;
- dnd-kit installation;
- hard-constraint validation;
- invalid placement highlighting;
- violation detail panels;
- solver UI;
- solver API calls;
- optimistic updates unless rollback is explicit and reliable;
- timetable version history;
- mock assignments or mock sessions.

## Dependencies

No new package should be required.

This unit depends on:

- Unit 29 frontend unscheduled pool integration;
- Unit 30 frontend scheduled session rendering shell;
- Unit 31 backend assignment persistence and protected manual scheduling API;
- Unit 32 frontend assignment API client.

Do not install dnd-kit in this unit.

## Verification Checklist

- [ ] `/timetable` fetches real assignment data.
- [ ] Scheduled sessions render from real assignment data.
- [ ] Server-owned assignment data is not stored in Zustand or localStorage.
- [ ] An unscheduled session can be selected from the unscheduled pool.
- [ ] Clicking a timetable cell with a selected session schedules it through the backend.
- [ ] Successfully scheduled sessions leave the unscheduled pool.
- [ ] Successfully scheduled sessions appear in the timetable grid.
- [ ] A scheduled session can be moved through the backend.
- [ ] A scheduled session can be unscheduled through the backend.
- [ ] Unscheduling removes the card from the grid and returns the session to the unscheduled pool.
- [ ] Assignment mutations invalidate or refetch the relevant queries.
- [ ] Loading states appear during assignment actions.
- [ ] Assignment errors are visible and actionable.
- [ ] No drag-and-drop behavior has been added.
- [ ] No constraint, solver, or invalid-placement highlighting behavior has been added.
- [ ] No mock assignment or session data is present.
- [ ] The frontend build command succeeds.
