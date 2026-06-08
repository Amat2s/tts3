# Unit 24 Spec: Frontend Unit Page Integration

## Goal

Connect the `/units` page shell to real backend unit data. The result should let an authenticated admin create, edit, delete, and view real units with lecturer and student selections, while keeping the session section as a non-persisted shell until the session backend units are built.

## Design

- Keep this unit in the frontend/backend connection boundary.
- Use the Unit 21 UI structure and Unit 23 API client.
- The `/units` route must remain unit-specific and must not be muddled with lecturer or student management routes.
- Lecturer and student selectors should use real lecturer and student data from the completed integrations.
- Sessions should still appear only as structural placeholders inside unit UI. Do not persist session type or duration yet.
- Use TanStack Query for server state.
- Keep styling aligned with `ui-context.md` and the existing management page patterns.

## Implementation

### Scope

Wire the existing `/units` page to real unit data.

This unit should include:

- query for listing units;
- create unit mutation;
- edit unit mutation;
- delete unit mutation;
- lecturer selector connected to real lecturer records;
- student selector connected to real student records;
- loading state for the unit list;
- empty state when no units exist;
- form-level and field-level error display;
- query invalidation after successful mutations.

### Unit Forms

The create and edit unit UI should support:

- unit code, such as `HIS101`;
- unit name, such as `Ancient History`;
- lecturer selection;
- student selection.

Use controlled forms or React Hook Form according to the existing frontend form pattern.

### Session Section Treatment

Keep the session section visually present inside each unit according to Unit 21, but do not wire it to backend persistence yet.

For this unit:

- the session area may show an empty state explaining that sessions will be added in the next phase;
- the add session button should not create persistent sessions;
- session boxes should not call backend APIs;
- do not add separate session dialogs.

The real inline session add/delete/edit behavior belongs to the later session integration unit.

### Route Separation

Do not alter the `/lecturers` or `/students` management routes except where reusable selector data loading is needed.

The `/units` page may read lecturer and student records for selection, but it must not become responsible for lecturer or student CRUD behavior.

### Out of Scope

Do not implement:

- backend unit routes;
- frontend unit API client;
- session backend API;
- session API client;
- persistent add session behavior;
- persistent delete session behavior;
- session type or duration saving;
- timetable unscheduled pool integration;
- assignment or scheduling behavior;
- constraint validation;
- solver behavior;
- mock unit, lecturer, student, or session data.

## Dependencies

No new package should be required if TanStack Query is already installed from the rooms integration work.

This unit depends on:

- Unit 16/20 lecturer and student integrations;
- Unit 21 unit/session page shell;
- Unit 23 frontend unit API client.

## Verification Checklist

- [ ] `/units` fetches real unit records from the backend.
- [ ] Empty state appears when no units exist.
- [ ] Create unit persists a real unit.
- [ ] Edit unit updates a real unit.
- [ ] Delete unit removes a real unit after confirmation.
- [ ] Lecturer selector uses real lecturer records.
- [ ] Student selector uses real student records.
- [ ] Loading and error states are visible and actionable.
- [ ] Successful mutations invalidate/refetch the unit list.
- [ ] Session section remains present but non-persistent.
- [ ] No separate session dialogs are added.
- [ ] `/lecturers` and `/students` routes are not muddled with `/units` behavior.
- [ ] No mock domain data is present.
- [ ] The frontend build command succeeds.
