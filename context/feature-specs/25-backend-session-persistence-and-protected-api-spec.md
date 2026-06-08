# Unit 25 Spec: Backend Session Persistence and Protected API

## Goal

Add backend persistence and protected API routes for sessions under units. The result should let authenticated API callers create, list, update, and delete sessions belonging to units, and list schedulable sessions for the timetable flow.

## Design

- Keep this unit inside `backend/`.
- Sessions are child records of units.
- Sessions are the atomic scheduling units used later by the timetable, constraints, and solver.
- Do not create standalone session management pages or independent session workflows.
- Session records should inherit their scheduling context from the parent unit:
  - unit/course from the unit;
  - lecturer from the unit;
  - students from the unit.
- Students remain optional in v1. A session whose parent unit has no students can still be schedulable and simply has no known student-conflict constraints.
- Use the existing backend auth dependency on every route.
- Use the existing backend error shape and validation style.
- Do not add assignment, timetable placement, constraint evaluation, or solver behavior in this unit.

## Implementation

### Scope

Build backend session persistence only.

This unit should include:

- Session SQLAlchemy model;
- relationship from session to unit;
- session Pydantic request and response schemas;
- session service functions;
- Alembic migration for session tables;
- protected session routes;
- session duration validation;
- session type validation;
- schedulable-session listing;
- structured session validation errors.

### Session Data Shape

Create a persisted session shape with:

- `id` — internal database primary key;
- `unit_id` — parent unit internal id;
- `session_type` — constrained session type;
- `duration` — integer number of timetable slots;
- `created_at`;
- `updated_at`.

Allowed `session_type` values should match the frontend shell:

- `lecture`;
- `tutorial`;
- `lab`;
- `workshop`.

Duration must be an integer number of slots.

Use the existing v1 duration bounds:

- minimum: `1`;
- maximum: `4`.

Do not store a separate session name unless needed for display. For v1, session display names can be derived from the parent unit name/code and session type.

### Relationships

A session belongs to exactly one unit.

A unit may have many sessions.

Deleting a unit should delete its child sessions if the existing unit deletion behavior supports cascading. If the current unit model does not yet define cascade behavior, make the intended behavior explicit in the model/service so orphaned sessions cannot remain.

Do not create direct session/student or session/lecturer assignment tables in this unit. Session lecturer and student data are inherited from the parent unit for v1.

### Protected API Routes

Create predictable protected routes for session management.

Preferred route shape:

- `GET /units/{unit_id}/sessions` — list sessions for a unit;
- `POST /units/{unit_id}/sessions` — create a session under a unit;
- `PUT /sessions/{session_id}` — update a session;
- `DELETE /sessions/{session_id}` — delete a session;
- `GET /sessions/schedulable` — list schedulable sessions for the timetable flow.

All routes must require the current authenticated admin dependency.

### List Sessions For Unit

The unit-scoped list route should:

- validate that the parent unit exists;
- return only sessions for that unit;
- include enough data for the frontend unit page to render inline session boxes.

The response should include:

- session id;
- unit id;
- session type;
- duration;
- created/updated timestamps if returned elsewhere consistently.

### Create Session

The create route should:

- validate that the parent unit exists;
- validate `session_type`;
- validate `duration`;
- persist the session as a child of the unit;
- return the created session response DTO.

Do not create timetable assignments when a session is created.

### Update Session

The update route should allow changes to:

- `session_type`;
- `duration`.

Do not allow changing `unit_id` through the generic update route unless a specific product rule requires moving sessions between units. For v1, sessions should stay under the unit where they were created.

If a session is later scheduled, duration changes may need assignment invalidation behavior, but assignment persistence does not exist yet. Do not implement that behavior in this unit.

### Delete Session

The delete route should:

- validate that the session exists;
- delete the session;
- return a predictable success response or empty success response consistent with existing API conventions.

No assignment cleanup is needed yet because assignment persistence is introduced later.

### Schedulable Sessions

Add a backend service and protected route for listing schedulable sessions.

A session is schedulable when:

- it has a parent unit;
- the parent unit has a lecturer;
- the session has a valid session type;
- the session has a valid duration.

Students are optional and must not block schedulability.

The schedulable-session response should include enough derived display data for the future unscheduled pool:

- session id;
- unit id;
- unit code;
- unit name;
- session type;
- duration;
- lecturer id;
- lecturer display name;
- student count.

Do not include assignment state yet. Assignment persistence is introduced in a later backend unit.

### Validation

Validate at minimum:

- parent unit exists;
- session type is one of the supported enum values;
- duration is an integer;
- duration is between 1 and 4 slots.

Return structured errors using the existing API error shape.

### Out of Scope

Do not implement:

- frontend session API client;
- frontend session integration;
- standalone session pages;
- standalone session dialogs;
- direct session/student assignment;
- direct session/lecturer assignment;
- timetable assignments;
- manual scheduling;
- drag-and-drop;
- unscheduled pool UI;
- constraint validation;
- solver input compilation;
- solver behavior;
- Trigger.dev jobs;
- timetable versioning;
- bulk imports or exports.

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

- [ ] Session SQLAlchemy model exists.
- [ ] Session model belongs to Unit.
- [ ] Unit model can expose child sessions.
- [ ] Session migration runs successfully.
- [ ] Session request and response schemas exist.
- [ ] Session type validation exists.
- [ ] Duration validation enforces 1–4 slots.
- [ ] `GET /units/{unit_id}/sessions` lists sessions for a real unit.
- [ ] `POST /units/{unit_id}/sessions` creates a session under a real unit.
- [ ] `PUT /sessions/{session_id}` updates session type and duration.
- [ ] `DELETE /sessions/{session_id}` deletes a session.
- [ ] `GET /sessions/schedulable` returns derived schedulable session records.
- [ ] Students are optional and do not block schedulability.
- [ ] All session routes are protected.
- [ ] Missing or invalid auth is rejected.
- [ ] API responses do not return ORM models directly.
- [ ] No timetable assignment, constraint, solver, or frontend behavior has been added.
