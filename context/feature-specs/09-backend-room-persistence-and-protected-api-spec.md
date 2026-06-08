# Unit 9 Spec: Backend Room Persistence and Protected API

## Goal

Add protected backend persistence for rooms. The result should allow authenticated API callers to create, list, update, and delete room records stored in the database.

## Design

- Keep this unit inside `backend/`.
- Use the backend foundation, database setup, migration workflow, API error shape, and Supabase auth boundary from earlier units.
- Treat rooms as the first persisted management entity because rooms define whether the timetable canvas can render.
- Keep room behavior simple and aligned with v1: name, capacity, and room type only.
- Protect all room routes with the backend auth dependency.
- Do not connect the frontend rooms page in this unit.

## Implementation

### Scope

Build the backend room persistence layer and protected room CRUD API.

This unit should include:

- Room SQLAlchemy model;
- Room Pydantic request/response schemas;
- Room service functions;
- Alembic migration for the room table;
- protected room routes;
- validation for required name, positive capacity, and valid room type;
- structured API errors for room validation and not-found cases.

### Data Model

Create a room model with the fields needed for v1:

- `id`;
- `name`;
- `capacity`;
- `room_type`;
- timestamps if already used by the backend conventions.

Use a constrained room type rather than arbitrary text. Keep the initial allowed values limited to the app’s real room concepts, such as lecture/tutorial style room categories, unless the existing code already defines a better enum.

Room names should be treated as meaningful admin-facing identifiers. If the backend standards or migration style make it practical, enforce uniqueness for room names.

### API Routes

Add protected room CRUD routes under a predictable resource path, such as `/rooms`.

Required routes:

- list rooms;
- create room;
- update room;
- delete room.

All routes must require the current authenticated admin dependency from the backend auth boundary.

Return Pydantic response schemas rather than ORM objects directly.

### Service Layer

Keep route handlers thin.

Room service functions should handle:

- creating rooms;
- listing rooms in a deterministic order;
- finding rooms by ID;
- updating room fields;
- deleting rooms;
- raising structured not-found or validation errors where needed.

Do not add timetable assignment cleanup yet. The later assignment unit owns the behavior where deleting a room unschedules assigned sessions.

### Validation and Errors

Validate:

- name is required and not blank;
- capacity is a positive integer;
- room type is one of the supported values.

Use the standard backend error response primitives. Do not expose stack traces or raw database errors to clients.

### Out of Scope

Do not implement:

- frontend room API client;
- rooms page data wiring;
- timetable room integration;
- assignment persistence;
- delete-room unscheduling behavior;
- room availability;
- room equipment requirements;
- room imports or exports;
- seed data or mock room data.

## Dependencies

No new major package should be needed if SQLAlchemy, Alembic, Pydantic, and FastAPI are already installed.

Only add a dependency if the current backend cannot implement this unit without it.

## Verification Checklist

- [ ] Room SQLAlchemy model exists.
- [ ] Room Pydantic schemas exist for create, update, and response behavior.
- [ ] Alembic migration creates the room table.
- [ ] Room routes are registered under the backend API router.
- [ ] All room routes require authentication.
- [ ] Authenticated callers can create, list, update, and delete rooms.
- [ ] Missing or invalid auth is rejected before room behavior runs.
- [ ] Blank names are rejected.
- [ ] Non-positive capacity values are rejected.
- [ ] Unsupported room types are rejected.
- [ ] Not-found room updates/deletes return a structured error.
- [ ] Routes return response schemas, not ORM objects directly.
- [ ] No frontend API client or UI integration has been added.
- [ ] No timetable assignment or solver behavior has been added.
