# Units 16 and 20 Spec: Frontend Lecturer and Student Page Integrations

## Goal

Connect the lecturer and student management pages to real backend data. The result should let authenticated admins create, view, edit, and delete lecturers and students from `/lecturers` and `/students`, with lecturer availability saved through the backend.

## Design

- Keep this unit inside the frontend/backend connection boundary.
- Integrate lecturer and student pages in the same phase because they use the same server-state and mutation patterns.
- Keep the routes and resource flows separate:
  - `/lecturers` must call only lecturer APIs;
  - `/students` must call only student APIs.
- Use TanStack Query for server state.
- Do not store server-owned lecturer or student records in Zustand.
- Use the existing page shells from Units 13 and 17 and the API clients from Units 15 and 19.
- Preserve the existing academic UI theme and management-page structure.

## Implementation

### Scope

Connect the lecturer and student pages to real backend data.

This unit should include:

- TanStack Query setup if not already installed/configured;
- lecturer list query;
- student list query;
- create lecturer mutation;
- edit lecturer mutation;
- delete lecturer mutation;
- lecturer availability save behavior;
- create student mutation;
- edit student mutation;
- delete student mutation;
- loading states;
- empty states;
- field-level or form-level error states;
- query invalidation after successful mutations.

### Lecturer Page Integration

Wire `/lecturers` to the lecturer backend API.

Required behavior:

- Fetch real lecturers after authentication.
- Show loading state while lecturers load.
- Show empty state when the backend returns no lecturers.
- Render real lecturer rows when records exist.
- Create lecturer through the backend.
- Edit lecturer through the backend.
- Delete lecturer through a confirmation dialog.
- Save lecturer availability through the backend.
- Refresh lecturer data after successful mutations.
- Show actionable user-facing errors when operations fail.

Lecturer availability state should stay aligned with the backend DTO shape and the fixed timetable slot model.

### Student Page Integration

Wire `/students` to the student backend API.

Required behavior:

- Fetch real students after authentication.
- Show loading state while students load.
- Show empty state when the backend returns no students.
- Render real student rows when records exist.
- Create student through the backend.
- Edit student through the backend.
- Delete student through a confirmation dialog.
- Refresh student data after successful mutations.
- Show actionable user-facing errors when operations fail.

Student management must not use lecturer API functions or lecturer availability state.

### Server-State Handling

Use TanStack Query for:

- lecturer list query;
- student list query;
- create/update/delete mutations;
- invalidating resource-specific queries after successful mutations.

Keep query keys resource-specific so lecturer updates do not accidentally invalidate only student data, and student updates do not accidentally invalidate only lecturer data.

### Out of Scope

Do not implement:

- unit management;
- session management;
- assigning lecturers to units;
- assigning students to units or sessions;
- timetable unscheduled pool changes;
- constraint validation;
- solver behavior;
- role-based access;
- student or lecturer login accounts;
- optimistic updates unless rollback behavior is explicit and safe.

## Dependencies

Install only what is needed for this integration phase:

- TanStack Query, if not already installed.

Do not install Zustand, dnd-kit, OR-Tools, Trigger.dev, or unrelated feature dependencies in this unit.

## Verification Checklist

- [ ] TanStack Query is configured if it was not already available.
- [ ] `/lecturers` fetches real lecturer records from the protected backend API.
- [ ] `/students` fetches real student records from the protected backend API.
- [ ] `/lecturers` create, edit, delete, and availability save actions persist to the backend.
- [ ] `/students` create, edit, and delete actions persist to the backend.
- [ ] Lecturer query keys and student query keys are separate and clear.
- [ ] Lecturer page never calls student API functions by mistake.
- [ ] Student page never calls lecturer API functions by mistake.
- [ ] Loading states appear during initial fetches and mutations.
- [ ] Empty states appear only when the real backend returns no records.
- [ ] Errors are shown clearly and do not get swallowed silently.
- [ ] No mock lecturer or student records remain in the pages.
- [ ] No unit, session, timetable scheduling, constraint, or solver behavior is added.
- [ ] The frontend build command succeeds.
