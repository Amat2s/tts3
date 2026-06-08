# Unit 29 Spec: Frontend Unscheduled Pool Integration

## Goal

Connect the timetable unscheduled pool to real schedulable-session data from the backend. The result should show real schedulable sessions grouped by unit beneath the timetable grid, ready for the later manual scheduling phase.

## Design

- Keep this unit in the frontend/backend connection boundary.
- Use the unscheduled pool shell from Unit 28.
- Use the session API client from Unit 26, especially the schedulable-session listing function.
- Treat the backend as the source of truth for schedulable sessions.
- Use TanStack Query for server-owned schedulable-session state.
- Group sessions by real unit data.
- Do not persist assignments or place sessions onto the timetable in this unit.
- Do not add drag-and-drop behavior in this unit.
- Do not use mock sessions, mock units, or fake counts.

## Implementation

### Scope

Wire the unscheduled pool to real backend schedulable-session data.

This unit should include:

- schedulable-session query on `/timetable`;
- loading state for schedulable sessions;
- error state for failed schedulable-session loading;
- empty state when the backend returns zero schedulable sessions;
- grouping real sessions by unit;
- rendering real unscheduled session cards;
- real duration, lecturer, and student count display;
- query invalidation or refetch behavior where existing unit/session mutations already affect data.

### Data Loading

Use the session API client function from Unit 26 to fetch schedulable sessions.

Use a clear TanStack Query key, such as:

- `['schedulable-sessions']`.

The query should run in the timetable workspace once the user is authenticated and the timetable page is active.

If the timetable grid depends on room data, keep room fetching and schedulable-session fetching separate so errors and loading states remain understandable.

### Loading State

Show a loading state inside the unscheduled pool while schedulable sessions load.

Do not block the timetable grid from rendering solely because schedulable sessions are loading.

The grid and pool should be able to show independently useful states:

- room query controls whether the grid can render;
- schedulable-session query controls the pool content.

### Error State

If schedulable-session fetching fails, show a clear user-facing error in the unscheduled pool section.

Do not hide the timetable grid just because the pool fetch failed.

Do not silently swallow API errors.

### Empty State

When the backend returns no schedulable sessions, show the empty state from Unit 28.

The empty state should make it clear that the admin should create units and sessions.

Students are optional and must not be implied as required for schedulability.

### Grouping By Unit

Group real schedulable sessions by their unit.

Each group should use real data from the backend response:

- unit id;
- unit code;
- unit name.

Sort groups in a predictable way, preferably by unit code or unit name.

Within each unit group, sort sessions in a predictable way, such as by session type then duration or by backend order if the API already guarantees stable ordering.

### Session Card Rendering

Render each real schedulable session as an unscheduled session card.

Each card should display:

- session type;
- duration;
- lecturer display name;
- student count;
- enough unit context to remain understandable if cards are later dragged.

Use deterministic unit color assignment from Unit 28.

Do not show assignment state yet.

Do not mark sessions as draggable yet unless the drag-and-drop shell is being explicitly built later.

### Data Refresh

After units or sessions are changed elsewhere, the schedulable-session query should be able to refresh.

At minimum, ensure the query key is named clearly so future units can invalidate it after session mutations.

If the `/units` page already mutates sessions in Unit 27, consider invalidating `['schedulable-sessions']` after successful session changes if that code path is already shared and safe.

Do not overcomplicate cache orchestration in this unit.

### Out of Scope

Do not implement:

- assignment persistence;
- scheduled session rendering;
- selecting a session for placement;
- click-to-place scheduling;
- drag-and-drop;
- local timetable placement state;
- constraint validation;
- solver UI;
- optimistic scheduling;
- Zustand storage for schedulable sessions;
- mock session data;
- backend session route changes unless required to fix a mismatch with Unit 25.

## Dependencies

No new package should be required if TanStack Query and the session API client already exist.

This unit depends on:

- Unit 26 frontend session API client;
- Unit 27 frontend session management integration;
- Unit 28 frontend unscheduled pool shell.

## Verification Checklist

- [ ] `/timetable` fetches real schedulable sessions from the protected backend API.
- [ ] Schedulable-session loading state appears inside the unscheduled pool.
- [ ] Schedulable-session errors appear inside the unscheduled pool.
- [ ] The timetable grid remains visible if room data loaded successfully.
- [ ] Empty state appears when the backend returns no schedulable sessions.
- [ ] Real sessions render as unscheduled session cards.
- [ ] Sessions are grouped by real unit.
- [ ] Unit groups use real unit code and unit name.
- [ ] Session cards show real session type.
- [ ] Session cards show real duration.
- [ ] Session cards show real lecturer display name.
- [ ] Session cards show real student count.
- [ ] Students are optional and missing students do not block display.
- [ ] Unit color assignment is deterministic.
- [ ] No fake sessions, units, lecturers, students, or counts are present.
- [ ] No scheduling, assignment, drag/drop, constraint, or solver behavior has been added.
- [ ] Server-owned schedulable-session data is not stored in Zustand or localStorage.
- [ ] The frontend build command succeeds.
