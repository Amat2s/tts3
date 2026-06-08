# Units 15 and 19 Spec: Frontend Lecturer and Student API Clients

## Goal

Create frontend API client functions and DTO types for lecturers and students. The result should let frontend dev/test calls fetch and mutate lecturers and students through the protected backend APIs, without integrating those calls into the pages yet.

## Design

- Keep this unit inside `frontend/`.
- Build lecturer and student clients together because they follow the same API-client pattern.
- Keep client modules clearly separated:
  - lecturer API functions and types must stay lecturer-specific;
  - student API functions and types must stay student-specific.
- Use the authenticated API base client from Unit 6.
- DTO types should match backend response shapes exactly.
- Do not duplicate server state in Zustand.
- Do not wire the management pages to real data in this unit.

## Implementation

### Scope

Build frontend API client modules only.

This unit should include:

- lecturer DTO types;
- lecturer availability DTO types;
- lecturer create/update request types;
- lecturer API functions;
- lecturer-specific error parsing if needed;
- student DTO types;
- student create/update request types;
- student API functions;
- student-specific error parsing if needed;
- a small dev/test call path or test coverage proving the clients can call the protected backend.

### Lecturer API Client

Create lecturer API functions for:

- listing lecturers;
- creating a lecturer;
- updating a lecturer;
- deleting a lecturer;
- updating availability if the backend exposes it separately.

Lecturer DTOs should include the fields returned by the backend, including availability shape when returned.

Availability types should use fixed days and time slots compatible with the timetable and backend constraint model.

### Student API Client

Create student API functions for:

- listing students;
- creating a student;
- updating a student;
- deleting a student.

Student DTOs should include the fields returned by the backend, including year level.

### Error Handling

Use the existing authenticated API base client for:

- access token attachment;
- base `401` handling;
- standard API error parsing.

Add resource-specific helpers only where they improve form-level or field-level error handling.

### Out of Scope

Do not implement:

- TanStack Query hooks unless they are part of the existing client pattern and not page integration;
- `/lecturers` page real-data integration;
- `/students` page real-data integration;
- create/edit/delete form submission behavior;
- optimistic updates;
- Zustand stores;
- unit or session selectors;
- timetable integration;
- solver or constraint behavior.

## Dependencies

No new dependency should be required if the authenticated API base client already exists.

Do not install TanStack Query in this unit unless the project decided API clients and query hooks are introduced together. If TanStack Query is installed here, do not connect it to page UI until the integration unit.

## Verification Checklist

- [ ] Lecturer DTO types match backend lecturer response shapes.
- [ ] Lecturer availability DTO types match backend availability response shapes.
- [ ] Lecturer API functions exist for list, create, update, delete, and availability update if applicable.
- [ ] Student DTO types match backend student response shapes.
- [ ] Student API functions exist for list, create, update, and delete.
- [ ] Lecturer and student API modules are separate and clearly named.
- [ ] Client functions use the authenticated API base client.
- [ ] API errors are parsed consistently with existing frontend API behavior.
- [ ] A dev/test call can reach each protected backend resource with an authenticated session.
- [ ] `/lecturers` and `/students` pages are not yet wired to real data.
- [ ] No mock lecturer or student records are added.
- [ ] The frontend build command succeeds.
