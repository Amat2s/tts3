# Unit 31 Spec: Backend Assignment Persistence and Protected Manual Scheduling API

## Goal

Add backend persistence and protected API routes for manual timetable assignments. The result should let authenticated API callers schedule a session into a day, slot, and room, move a scheduled session, unschedule a session, and list current assignments.

## Design

- Keep this unit inside `backend/`.
- Assignments represent scheduled session placement on the timetable.
- Sessions remain the atomic scheduling units.
- A session is either:
  - unscheduled, with no assignment record; or
  - scheduled, with one valid assignment record.
- Scheduled sessions are locked by definition in v1.
- Do not introduce a third persistent session state.
- Do not store assignment data directly as nullable scheduling fields on the session if an assignment table keeps integrity clearer.
- Use the existing protected backend auth dependency on every route.
- Use the existing backend error shape and validation style.
- Do not implement constraint validation in this unit. Invalid placements may be persisted later, but authoritative violation detection belongs to the constraint units.
- Do not add solver behavior in this unit.

## Implementation

### Scope

Build backend assignment persistence and protected manual scheduling routes.

This unit should include:

- timetable assignment SQLAlchemy model;
- relationship from assignment to session;
- relationship from assignment to room;
- assignment Pydantic request and response schemas;
- assignment service functions;
- Alembic migration for assignments;
- protected API routes for:
  - list assignments;
  - schedule session;
  - move scheduled session;
  - unschedule session;
- invariant enforcement for one assignment per session;
- room deletion behavior that unschedules affected sessions.

### Assignment Data Shape

Create a persisted assignment shape with:

- `id` — internal database primary key;
- `session_id` — assigned session id;
- `room_id` — assigned room id;
- `day` — fixed timetable day;
- `start_slot` — fixed timetable slot;
- `created_at`;
- `updated_at`.

Use the project-wide slot standard:

- `s1`;
- `s2`;
- `s3`;
- `s4`;
- `s5`;
- `s6`;
- `s7`.

Valid days should match the timetable grid:

- Monday;
- Tuesday;
- Wednesday;
- Thursday;
- Friday.

The assignment table should enforce that a session can have at most one active assignment.

### Scheduled and Unscheduled State

Persist scheduled/unscheduled state through assignment existence:

- a session with an assignment is scheduled;
- a session without an assignment is unscheduled.

Do not add a separate persistent `status` field unless absolutely necessary. If a helper status appears in API responses, it should be derived from assignment existence.

### Protected API Routes

Create predictable protected routes for manual scheduling.

Preferred route shape:

- `GET /assignments` — list current timetable assignments;
- `POST /assignments` — schedule an unscheduled session;
- `PUT /assignments/{assignment_id}` — move a scheduled session;
- `DELETE /assignments/{assignment_id}` — unschedule a session.

Alternative route names are acceptable if they remain resource-oriented and consistent with the existing backend API style.

All routes must require the current authenticated admin dependency.

### List Assignments

The list route should return all current assignment records needed by the timetable.

Each response should include:

- assignment id;
- session id;
- room id;
- day;
- start slot;
- session summary data if useful for frontend rendering;
- unit summary data if useful for frontend rendering.

Do not return ORM models directly.

### Schedule Session

The schedule route should:

- validate that the session exists;
- validate that the room exists;
- validate the day value;
- validate the start slot value;
- reject scheduling if the session already has an assignment, unless the API contract explicitly treats this as a move;
- create the assignment;
- return the assignment response DTO.

This route should not run the solver.

This route should not perform full hard-constraint validation yet. Constraint detection is introduced later. Basic shape validation still belongs here.

### Move Scheduled Session

The move route should:

- validate that the assignment exists;
- validate that the target room exists;
- validate the target day;
- validate the target start slot;
- update the assignment placement;
- return the updated assignment response DTO.

Do not silently create a second assignment for the same session.

### Unschedule Session

The unschedule route should:

- validate that the assignment exists;
- delete the assignment;
- leave the session record intact;
- return a predictable success response or empty success response consistent with existing API conventions.

Unscheduling must not delete sessions, units, rooms, lecturers, or students.

### Room Deletion Behavior

Update room deletion behavior so deleting a room unschedules sessions assigned to that room.

Required behavior:

- assignments for the deleted room are removed;
- session records remain;
- affected sessions become unscheduled by assignment removal;
- no unrelated assignments are changed.

Do not silently delete sessions when deleting a room.

### Duration Boundary Treatment

This unit may validate obvious assignment shape issues, such as unsupported slot ids.

Do not implement full duration boundary, lunch-crossing, or conflict validation here. Those belong to the backend constraint evaluation units.

### Out of Scope

Do not implement:

- frontend assignment API client;
- frontend manual scheduling integration;
- drag-and-drop behavior;
- constraint validation;
- conflict graph generation;
- solver input compilation;
- solver execution;
- scheduled session UI rendering, except through response DTO preparation if needed;
- invalid placement highlighting;
- solver gating;
- timetable version history;
- optimistic assignment behavior.

## Dependencies

No new backend package should be required.

Use existing backend dependencies:

- FastAPI;
- Pydantic;
- SQLAlchemy;
- Alembic;
- existing auth dependency;
- existing structured error helpers.

## Verification Checklist

- [ ] Assignment SQLAlchemy model exists.
- [ ] Assignment model references Session.
- [ ] Assignment model references Room.
- [ ] Assignment migration runs successfully.
- [ ] A session can have at most one active assignment.
- [ ] Assignment request and response schemas exist.
- [ ] `GET /assignments` lists current assignments.
- [ ] `POST /assignments` schedules a real session into a real room/day/slot.
- [ ] `PUT /assignments/{assignment_id}` moves an existing assignment.
- [ ] `DELETE /assignments/{assignment_id}` unschedules a session.
- [ ] Scheduled/unscheduled state is derived from assignment existence.
- [ ] Deleting a room removes assignments for that room and leaves sessions intact.
- [ ] All assignment routes are protected.
- [ ] Missing or invalid auth is rejected.
- [ ] API responses do not return ORM models directly.
- [ ] No constraint, solver, frontend, or drag-and-drop behavior has been added.
