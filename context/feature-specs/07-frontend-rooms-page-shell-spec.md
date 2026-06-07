# Unit 7 Spec: Frontend Rooms Page Shell

## Goal

Create the visual shell for the rooms management page. The result should be a complete `/rooms` page layout with empty table state and create/edit/delete UI surfaces, but no real persistence or backend data wiring yet.

## Design

- Keep this unit entirely inside `frontend/`.
- Use the existing app shell, route structure, theme tokens, and shadcn/ui foundation.
- Follow the management-page pattern from `ui-context.md`: page header, table-first layout, modal or sheet-based editing, and destructive confirmation for delete actions.
- The page should look ready for real data while showing only empty states.
- Do not use mock rooms, fake counts, generated sample records, or placeholder application data.

## Implementation

### Scope

Build the `/rooms` page UI shell only.

This unit should include:

- rooms page header;
- primary create-room action;
- empty room table structure;
- empty state for no rooms;
- create room dialog layout;
- edit room dialog layout;
- delete confirmation dialog layout;
- room form fields prepared for future wiring.

### Page Structure

Update the existing `/rooms` route so it has the final management-page structure.

The page should include:

- title and short description;
- a clearly placed `Create room` action;
- a table/panel area for future room records;
- an empty state explaining that rooms define the timetable canvas;
- no fake rows.

### Room Form Shell

Create reusable room form UI where practical.

Prepare fields for:

- room name;
- capacity;
- room type.

The form may use local component state only to support opening, closing, and basic visual behavior. It should not submit to the backend yet.

Room type should be represented as a select-style field prepared for the real allowed values. Do not invent additional complex room attributes for v1.

### Dialogs and Confirmation

Add UI surfaces for:

- creating a room;
- editing a room;
- confirming room deletion.

The edit and delete controls can be present in the page structure but should not depend on fake room records. It is acceptable for their actual row-level triggers to be wired later when real data exists.

Delete behavior should be designed as a confirmation flow because room deletion will later affect scheduled sessions.

### Out of Scope

Do not implement:

- backend room model;
- room API routes;
- frontend room API client;
- real room fetching;
- create/edit/delete mutations;
- TanStack Query;
- timetable room integration;
- mock room records;
- room availability;
- room equipment requirements;
- room-specific constraints beyond the fields already planned for v1.

## Dependencies

No new dependency should be needed if the existing shadcn/ui components are sufficient.

If a missing shadcn/ui component is genuinely needed, add it through the shadcn CLI rather than building a custom primitive from scratch.

Do not install TanStack Query, Zustand, or backend-related frontend packages in this unit.

## Verification Checklist

- [ ] `/rooms` renders a complete rooms management shell.
- [ ] The page has a header and create-room action.
- [ ] The room table area exists and shows a no-rooms empty state.
- [ ] No fake room rows or fake counts are displayed.
- [ ] Create room dialog layout exists.
- [ ] Edit room dialog layout exists or is structurally prepared for real rows.
- [ ] Delete confirmation dialog layout exists or is structurally prepared for real rows.
- [ ] Room form fields include name, capacity, and room type.
- [ ] The page uses existing design tokens and shared UI components.
- [ ] No backend calls, API clients, TanStack Query, or CRUD behavior have been added.
- [ ] The frontend build command succeeds.
