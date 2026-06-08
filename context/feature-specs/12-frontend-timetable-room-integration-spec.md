# Unit 12 Spec: Frontend Timetable Room Integration

## Goal

Connect the timetable page to real room data. The result should show the no-room state when the database has no rooms, and render the timetable grid with room columns once at least one room exists.

## Design

- Keep this unit focused on connecting room data to the timetable shell.
- Reuse the room API client and TanStack Query setup from the rooms integration work.
- Keep the timetable grid free of fake rooms, fake sessions, and fake assignments.
- Rooms define whether the timetable canvas can render.
- The timetable page should remain a structural canvas only; scheduling behavior comes later.

## Implementation

### Scope

Wire real backend room records into the timetable page and grid shell.

This unit should include:

- room query on `/timetable`;
- loading state for timetable room loading;
- backend error state for failed room loading;
- real no-room state when the room list is empty;
- timetable grid rendering when real rooms exist;
- room columns generated from backend room records.

### Timetable Room Loading

Use the existing room API client and TanStack Query setup.

The timetable page should fetch rooms independently from the rooms page, but reuse the same query key conventions where practical so cache behavior remains predictable.

Do not duplicate room API logic inside timetable components.

### No-Room State

When the backend returns an empty room list, show the no-room empty state built in Unit 8.

The empty state should explain that rooms must be created before the timetable canvas can render. It may provide a navigation action to `/rooms` if that fits the existing UI pattern.

### Grid Rendering

When at least one real room exists, render the timetable grid.

The grid should:

- use Monday-Friday day structure;
- nest room columns under each day;
- render the backend room names as column labels;
- render fixed time-slot rows;
- include the lunch divider;
- render blank cells only.

Do not render sessions, unscheduled pool items, assignments, validation markers, or solver state yet.

### Data Flow

Keep the data flow simple:

- backend room DTOs are fetched through the room API client;
- route/page code passes the needed room fields into timetable grid components;
- timetable grid components render room columns without owning server state.

Do not store room data in localStorage or Zustand.

### Out of Scope

Do not implement:

- schedulable sessions;
- unscheduled pool integration;
- assignment rendering;
- manual scheduling;
- drag-and-drop;
- constraint validation;
- solver UI;
- timetable persistence;
- fake sessions or fake assignments;
- room CRUD behavior beyond what already exists on `/rooms`.

## Dependencies

No new package should be required if TanStack Query and the room API client already exist.

Do not install Zustand, dnd-kit, or timetable interaction dependencies in this unit.

## Verification Checklist

- [ ] `/timetable` fetches real room data from the protected backend API.
- [ ] Timetable room loading state is visible while rooms load.
- [ ] Room-loading errors show a clear user-facing error state.
- [ ] No-room state appears when the backend room list is empty.
- [ ] Creating a room on `/rooms` causes `/timetable` to render the grid.
- [ ] Real room names appear as timetable column labels.
- [ ] The grid keeps the Monday-Friday structure and fixed time-slot rows.
- [ ] The lunch divider remains visible in the grid.
- [ ] Grid cells are blank because no sessions or assignments exist yet.
- [ ] No fake rooms, sessions, assignments, counts, validation states, or solver states are present.
- [ ] Room data is not stored in Zustand or localStorage.
- [ ] The frontend build command succeeds.
