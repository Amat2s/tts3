# Unit 22 Spec: Backend Unit Persistence and Protected API

## Goal

Add backend persistence and protected CRUD API routes for units. The result should let authenticated API callers create, list, update, and delete units with a unit code, unit name, lecturer assignment, and student assignments, without adding session persistence yet.

## Design

- Keep this unit inside `backend/`.
- Units represent courses/classes such as `HIS101` / `Ancient History`.
- Unit records should be separate from session records. Sessions are introduced in the later session backend unit.
- Unit lecturer and student assignment should reference real lecturer and student records from the completed lecturer/student backend units.
- Keep the route boundary clearly unit-specific. Do not mix unit routes with lecturer, student, or future session routes.
- Backend auth remains mandatory for every unit route.
- Use the existing backend error shape and validation style.

## Implementation

### Scope

Build backend unit persistence only.

This unit should include:

- Unit SQLAlchemy model;
- relationship from unit to lecturer;
- unit/student many-to-many assignment model or join table;
- Unit Pydantic request and response schemas;
- Unit service functions;
- Alembic migration for unit tables and relationships;
- protected unit CRUD routes;
- validation for required unit code and unit name;
- validation that selected lecturer and students exist;
- structured unit validation errors.

### Unit Data Shape

Prepare the backend around this unit shape:

- `id` — internal database primary key (UUID, following the existing backend pattern);
- `code` — product-facing unit code, such as `HIS101`;
- `name` — unit name, such as `Ancient History`;
- `lecturer_id` — references an existing lecturer;
- `student_ids` — references existing students.

### Relationships

A unit should have one lecturer.

A unit may have many students.

Students assigned to a unit will later be inherited or used by sessions created under that unit. Do not implement session inheritance behavior in this unit; only persist the unit-level assignment cleanly.

### Routes

Create predictable protected routes for units, such as:

- list units;
- create unit;
- update unit;
- delete unit.

All routes must require the current authenticated admin dependency from the backend auth boundary.

### Validation

Validate at minimum:

- unit code is required;
- unit name is required;
- lecturer id must reference an existing lecturer;
- every selected student id must reference an existing student;
- duplicate unit codes should be rejected if unit codes are intended to be unique.

Use clear user-facing validation messages through the existing API error structure.

### Out of Scope

Do not implement:

- frontend unit API client;
- frontend unit page integration;
- session model or session routes;
- session type or duration persistence;
- automatic session generation;
- timetable scheduling behavior;
- assignment persistence;
- constraint validation;
- solver behavior;
- bulk import/export;
- role-based access control;
- multi-admin collaboration.

## Dependencies

No new backend package should be required if SQLAlchemy, Alembic, Pydantic, and auth are already present.

Only add a dependency if it is strictly necessary for this unit's backend persistence or validation work.

## Verification Checklist

- [ ] Unit database model exists.
- [ ] Unit/student assignment persistence exists if unit-level student selection is supported.
- [ ] Unit migration runs successfully.
- [ ] Protected unit routes exist for list, create, update, and delete.
- [ ] Missing or invalid auth is rejected for unit routes.
- [ ] Unit code is required.
- [ ] Unit name is required.
- [ ] Lecturer references are validated.
- [ ] Student references are validated.
- [ ] API responses do not return ORM models directly.
- [ ] No session persistence or session API behavior has been added.
- [ ] No frontend code has been added.
