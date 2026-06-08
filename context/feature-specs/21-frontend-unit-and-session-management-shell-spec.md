# Unit 21 Spec: Frontend Unit and Session Management Shell

## Goal

Create the frontend shell for managing units and their sessions. The result should make the `/units` page visually ready for unit creation, unit editing, student and lecturer assignment, and inline session management without connecting to real backend data yet.

## Design

- Keep this unit entirely inside `frontend/`.
- Use the existing app shell, protected route structure, theme tokens, and shadcn/ui components.
- The `/units` page should be table-first or list-first, matching the existing management-page style used for rooms, lecturers, and students.
- Units should visually contain their sessions so it is clear that sessions belong inside a unit.
- Sessions should not use their own create/edit dialogs in this unit.
- A session should appear as a compact box or card inside the unit area, holding its editable/display-ready information.
- Do not show fake unit or session records. Use empty states and structural placeholders only.
- Do not connect lecturer or student selectors to real data yet. The selector areas should be prepared for future integration but remain empty/disabled/placeholder-only until real data wiring exists.

## Implementation

### Scope

Build the `/units` page management shell only.

This unit should include:

- `/units` page structure;
- empty unit list or table shell;
- empty state for no units;
- create unit dialog or sheet;
- edit unit dialog or sheet;
- delete unit confirmation dialog;
- unit form fields prepared for:
  - unit code, such as `HIS101`;
  - unit name, such as `Ancient History`;
  - lecturer selection;
  - student selection;
- session section inside each unit form/detail area;
- add session button;
- inline session boxes/cards;
- delete session button on each session box;
- session fields prepared for:
  - session type;
  - duration.

### Units Page Structure

Update the existing `/units` route so it has the full visual structure needed for unit management.

The page should include:

- page header;
- primary create-unit action;
- empty state when there are no unit records;
- list/table container ready for future unit records;
- clear separation between unit-level details and session-level details.

Because this is still a shell unit, the page should not render fake unit rows or fake session rows.

### Unit Create and Edit UI

Create the unit create and edit surfaces using either dialogs or sheets, consistent with the rest of the app.

The form should prepare fields for:

- unit code;
- unit name;
- lecturer selection;
- student selection.

The unit code field should support values like `HIS101`. The unit name field should support values like `Ancient History`.

Lecturer and student selection controls should be visually present but should not fetch real lecturers or students in this unit. They may show disabled placeholder text such as future connected selections, as long as no fake people are inserted.

### Inline Session Section

Inside the unit create/edit UI, include a session management section.

This section should include:

- section heading;
- short explanatory helper text;
- add session button;
- visual area where session boxes will appear;
- empty session state when no sessions have been added in the current shell state;
- inline session box/card component structure.

Sessions should be represented as boxes/cards within the unit area, not as independent dialogs.

Each session box should prepare fields for:

- session type;
- duration.

Each session box should also include a delete session button.

Keep session state local to the shell only if needed to demonstrate the add/delete interaction inside the form. Do not persist sessions, do not use backend APIs, and do not treat local shell session state as real application data.

### Delete Confirmation

Add a delete confirmation surface for units.

The confirmation should clearly communicate that deleting a unit will eventually affect the sessions inside it, but this unit should not implement real deletion or cascading behavior.

Session delete buttons inside the shell may remove local unsaved session boxes if local form state is used. They should not call backend APIs.

### Route and Data Separation

Keep all work on the `/units` route and unit/session UI only.

Do not modify or mix in:

- `/lecturers` route behavior;
- `/students` route behavior;
- lecturer persistence;
- student persistence;
- timetable rendering;
- backend unit/session APIs.

Future integration units will connect real lecturers, real students, real units, and real sessions.

### Out of Scope

Do not implement:

- backend unit persistence;
- backend session persistence;
- unit API client functions;
- session API client functions;
- TanStack Query wiring for units or sessions;
- real lecturer selector data;
- real student selector data;
- real unit records;
- real session records;
- standalone session dialogs;
- automatic session generation;
- timetable scheduling from this page;
- unscheduled pool behavior;
- solver behavior;
- mock units, mock sessions, mock lecturers, or mock students.

## Dependencies

Install no new package unless the selected existing UI pattern requires a shadcn/ui component that has not already been added.

If a new shadcn/ui component is needed, add it through the shadcn CLI and keep it reusable.

Do not install TanStack Query, Zustand, dnd-kit, or backend/data-fetching dependencies in this unit.

## Verification Checklist

- [ ] `/units` renders a complete unit management shell.
- [ ] The page has a create-unit action.
- [ ] The page has an empty state when no unit records exist.
- [ ] The unit create/edit UI includes fields for unit code, unit name, lecturer selection, and student selection.
- [ ] The session section appears inside the unit create/edit UI.
- [ ] Sessions are represented as inline boxes/cards, not separate dialogs.
- [ ] The session box structure includes session type and duration fields.
- [ ] The session section includes an add session button.
- [ ] Each session box includes a delete session button.
- [ ] Unit delete confirmation UI exists.
- [ ] No fake unit, session, lecturer, or student records are displayed.
- [ ] No backend calls, API clients, TanStack Query unit/session wiring, or persistence behavior has been added.
- [ ] `/lecturers` and `/students` routes are not modified or muddled into the units route.
- [ ] The frontend build command succeeds.
