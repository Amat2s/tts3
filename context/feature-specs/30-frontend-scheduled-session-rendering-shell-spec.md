# Unit 30 Spec: Frontend Scheduled Session Rendering Shell

## Goal

Create the frontend shell for rendering scheduled sessions inside the timetable grid once assignment data exists. The result should prepare assignment-based rendering and duration-based vertical spans without inventing or persisting any timetable assignments.

## Design

- Keep this unit entirely inside `frontend/`.
- Build rendering components and layout paths only.
- Scheduled sessions must be rendered from assignment-shaped data, not duplicated local placement state.
- The timetable grid must remain valid and blank when there are no assignments.
- Do not fetch real assignments yet.
- Do not create fake scheduled sessions in production UI.
- Do not implement manual scheduling, drag-and-drop, constraint validation, or solver behavior.
- Keep scheduled and unscheduled sessions visually distinct.
- Use the unit/session card color tokens from `ui-context.md`.

## Implementation

### Scope

Prepare the timetable grid to render scheduled session cards from future assignment data.

This unit should include:

- scheduled session card component;
- assignment-shaped frontend types or view-model types;
- grid rendering path that can place cards by day, slot, and room;
- duration-based vertical span styling;
- blank grid behavior when no assignments exist;
- non-overlapping rendering assumptions documented in code or component boundaries;
- no backend calls;
- no assignment API client.

### Assignment-Shaped Rendering Model

Define a frontend-facing rendering shape for scheduled sessions.

The shape should prepare for future backend assignment DTOs and include:

- assignment id if available later;
- session id;
- unit id;
- unit code;
- unit name;
- session type;
- duration;
- lecturer display name;
- student count;
- day;
- start slot;
- room id.

Use the current timetable slot standard:

- `s1`;
- `s2`;
- `s3`;
- `s4`;
- `s5`;
- `s6`;
- `s7`.

Do not include unsupported `s8`.

This type can live near timetable feature components as a temporary render contract, but it should be easy to align with the real assignment DTO in Unit 32.

### Scheduled Session Card

Create a scheduled session card component for cards inside the timetable grid.

The card should display compact information such as:

- unit code;
- session type;
- duration;
- lecturer display name;
- student count.

The card should be visually distinct from unscheduled pool cards while still sharing the same deterministic unit color system.

The card should be readable inside a timetable cell and prepared to span multiple slot rows.

Do not add drag handles yet unless purely visual and disabled. Drag behavior belongs later.

### Grid Placement Rendering

Update the timetable grid architecture so it can accept scheduled assignment data in the future.

The grid should be able to render a scheduled card at:

- day;
- room;
- start slot.

The card should visually span the number of rows specified by `duration`.

If no assignment data is passed, the grid should render exactly as it does now: blank cells only.

### Duration-Based Span

Prepare duration-based vertical span behavior.

A session with:

- duration `1` spans one slot;
- duration `2` spans two contiguous slots;
- duration `3` spans three contiguous slots;
- duration `4` spans four contiguous slots.

Do not enforce duration boundary rules in this frontend shell. Boundary validation belongs to the backend constraint system later.

The rendering path should not silently invent extra slots or mutate session duration.

### Blank Grid State

The existing timetable grid must remain clean when there are no assignments.

Required behavior:

- no fake scheduled cards;
- no placeholder scheduled cards;
- no assignment loading state;
- no solver state;
- no validation markers.

This unit should only make the grid capable of rendering scheduled cards later.

### Layering and Interaction Preparation

Scheduled cards should be layered so that future interactions can be added cleanly.

Prepare structure for later:

- selecting a scheduled session;
- moving a scheduled session;
- unscheduling a scheduled session;
- showing constraint violations.

Do not implement those behaviors in this unit.

### Out of Scope

Do not implement:

- backend assignment persistence;
- assignment API client;
- fetching assignments;
- real scheduled session data;
- click-to-place scheduling;
- moving scheduled sessions;
- removing scheduled sessions;
- drag-and-drop;
- constraint validation;
- invalid card styling driven by real violations;
- solver UI;
- optimistic updates;
- mock scheduled sessions in production UI;
- localStorage or Zustand assignment storage.

## Dependencies

No new package should be required.

Do not install dnd-kit in this unit.

Use existing frontend dependencies and styling primitives.

## Verification Checklist

- [ ] A scheduled session card component exists.
- [ ] Scheduled session rendering uses assignment-shaped data.
- [ ] Timetable grid can accept an empty assignment list.
- [ ] Timetable grid remains blank when no assignments exist.
- [ ] Rendering path can place a card by day, room, and start slot.
- [ ] Rendering path supports duration-based vertical spans.
- [ ] Supported slot ids are `s1`–`s7`.
- [ ] No `s8` slot is introduced.
- [ ] Scheduled session cards use deterministic unit color styling.
- [ ] Scheduled and unscheduled session components remain visually distinct.
- [ ] No backend calls are added.
- [ ] No assignment API client is added.
- [ ] No fake scheduled sessions are rendered in production UI.
- [ ] No manual scheduling, drag/drop, constraint, or solver behavior has been added.
- [ ] The frontend build command succeeds.
