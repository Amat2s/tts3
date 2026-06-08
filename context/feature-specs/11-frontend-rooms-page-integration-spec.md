# Unit 11 Spec: Frontend Rooms Page Integration

## Goal

Connect the rooms page to the real protected backend room API. The result should let an authenticated admin create, view, edit, and delete rooms, with changes persisted in the database.

## Design

- Keep this unit focused on the frontend/backend rooms connection.
- Use the rooms page shell from Unit 7 and the room API client from Unit 10.
- Introduce TanStack Query here because this is the first real server-state management feature.
- Treat the database-backed room list as the source of truth.
- Keep server-owned room data out of Zustand and local component-only state except for form/dialog UI state.
- Do not connect the timetable page to rooms yet.

## Implementation

### Scope

Wire the `/rooms` page to real room data and mutations.

This unit should include:

- TanStack Query setup if not already present;
- room list query;
- create room mutation;
- edit room mutation;
- delete room mutation;
- loading states;
- empty state based on real backend data;
- success/error handling for room operations;
- query invalidation after mutations.

### TanStack Query Foundation

Install and configure TanStack Query in the frontend app.

Add a query provider near the app root so future feature pages can use the same server-state infrastructure.

Do not use TanStack Query for local UI state such as dialog open/closed state or selected form mode.

### Room List Integration

Replace the static rooms page shell state with a real query using the room API client.

The page should show:

- loading state while rooms load;
- structured error state if the list request fails;
- empty state when the backend returns zero rooms;
- table rows when real rooms exist.

Do not add fake fallback rows.

### Create and Edit Behavior

Wire the create and edit forms to backend mutations.

Required behavior:

- form fields are controlled through the app’s form conventions;
- required validation is shown before submitting where practical;
- submit buttons show loading/disabled states while mutations run;
- successful create/edit closes the dialog and refreshes the room list;
- failed create/edit shows a clear user-facing error.

### Delete Behavior

Wire room deletion through the confirmation dialog.

Required behavior:

- destructive action requires confirmation;
- delete mutation shows loading state;
- successful delete refreshes the room list;
- failed delete shows a clear user-facing error.

At this stage, deleting a room only deletes the room because assignment cleanup does not exist yet.

### Out of Scope

Do not implement:

- timetable page room integration;
- timetable grid rendering from rooms;
- assignment cleanup on room deletion;
- room-related constraint validation;
- optimistic updates unless rollback is clear and simple;
- Zustand room storage;
- mock room records;
- imports, exports, or bulk actions.

## Dependencies

Install only the package first needed in this unit:

- `@tanstack/react-query`

Do not install Zustand, dnd-kit, OR-Tools, or feature dependencies unrelated to rooms page integration.

## Verification Checklist

- [ ] TanStack Query is installed and configured at the app root.
- [ ] `/rooms` fetches real rooms from the backend.
- [ ] The rooms loading state is visible during fetches.
- [ ] Backend list errors show a user-facing error state.
- [ ] Empty state is shown only when the real backend list is empty.
- [ ] Real rooms render in the rooms table.
- [ ] Creating a room persists it to the backend.
- [ ] Editing a room persists changes to the backend.
- [ ] Deleting a room requires confirmation and persists to the backend.
- [ ] Room mutations invalidate or refresh the room list.
- [ ] Form and mutation errors are visible to the user.
- [ ] Server-owned room data is not stored in Zustand or localStorage.
- [ ] No timetable integration has been added yet.
- [ ] No mock room data is present.
- [ ] The frontend build command succeeds.
