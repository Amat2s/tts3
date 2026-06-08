# Units 14 and 18 Spec: Backend Lecturer and Student Persistence and Protected API

## Goal

Add backend persistence and protected CRUD APIs for lecturers and students. The result should let authenticated API calls create, list, update, and delete lecturers and students, with lecturer availability stored for later scheduling constraints.

## Design

- Keep this unit inside `backend/`.
- Build lecturer and student backend stages together because they share CRUD, schema, service, migration, and validation patterns.
- Keep the API resources clearly separated:
  - lecturer routes should live under a lecturer-specific path such as `/lecturers`;
  - student routes should live under a student-specific path such as `/students`.
- Do not mix lecturer schemas, student schemas, service functions, or route handlers.
- All routes must be protected by the backend Supabase auth dependency.
- Use SQLAlchemy models for persistence and Pydantic schemas for request/response boundaries.
- Preserve v1’s single-admin focus without adding roles, multi-tenancy, student accounts, or lecturer accounts.

## Implementation

### Scope

Build backend lecturer and student persistence only.

This unit should include:

- lecturer SQLAlchemy model;
- lecturer availability persistence model;
- student SQLAlchemy model;
- lecturer Pydantic schemas;
- student Pydantic schemas;
- lecturer service functions;
- student service functions;
- Alembic migration for lecturer, lecturer availability, and student tables;
- protected lecturer CRUD routes;
- protected student CRUD routes;
- structured validation errors for both resources.

### Lecturer Persistence

Create persistence for lecturers.

A lecturer should support:

- id;
- title;
- first name;
- last name;
- availability;
- created/updated timestamps if consistent with existing models.

Lecturer availability should be persisted in a structure that can later support hard constraint validation and solver input compilation.

Availability should represent fixed timetable slots, not arbitrary free-text availability.

### Student Persistence

Create persistence for students.

A student should support:

- id;
- title;
- first name;
- last name;
- year level;
- created/updated timestamps if consistent with existing models.

Do not create unit/session assignment tables in this unit unless they are required by the student CRUD model itself. Student assignment belongs to later unit/session stages.

### Protected API Routes

Add protected CRUD routes for lecturers:

- list lecturers;
- create lecturer;
- update lecturer;
- delete lecturer;
- update lecturer availability if handled separately.

Add protected CRUD routes for students:

- list students;
- create student;
- update student;
- delete student.

Routes must use the existing backend auth dependency and standard error response shape.

### Validation

Add clear validation for lecturer input:

- required first name;
- required last name;
- valid title if constrained;
- valid availability day/slot values.

Add clear validation for student input:

- required first name;
- required last name;
- valid title if constrained;
- valid year level.

Keep validation messages structured and useful for frontend form errors.

### Out of Scope

Do not implement:

- frontend lecturer API client;
- frontend student API client;
- lecturer page integration;
- student page integration;
- unit relationships;
- session relationships;
- timetable assignment logic;
- constraint evaluation;
- solver input compilation;
- role-based access control;
- student or lecturer login accounts;
- multi-admin collaboration.

## Dependencies

No new backend package should be needed if FastAPI, Pydantic, SQLAlchemy, Alembic, and auth dependencies are already installed.

Only add a dependency if it is directly required for this backend persistence/API work.

## Verification Checklist

- [ ] Lecturer SQLAlchemy model exists.
- [ ] Lecturer availability persistence exists.
- [ ] Student SQLAlchemy model exists.
- [ ] Lecturer Pydantic request/response schemas exist.
- [ ] Student Pydantic request/response schemas exist.
- [ ] Alembic migration creates lecturer, lecturer availability, and student tables.
- [ ] Lecturer CRUD routes are protected and work with authenticated requests.
- [ ] Student CRUD routes are protected and work with authenticated requests.
- [ ] Lecturer and student route paths are not muddled or reused incorrectly.
- [ ] Validation errors use the standard backend error shape.
- [ ] No unit, session, assignment, constraint, or solver behavior has been added.
- [ ] Backend tests or manual API checks prove unauthenticated requests are rejected.
- [ ] Migrations run successfully.
