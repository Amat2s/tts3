# Unit 28 Spec: Frontend Unscheduled Pool Shell

## Goal

Create the frontend shell for the unscheduled session pool underneath the timetable grid. The result should give the timetable page a complete visual area for future schedulable sessions, grouped by unit, without connecting to backend session data yet.

## Design

- Keep this unit entirely inside `frontend/`.
- Build only the visual and structural shell for the unscheduled pool.
- Place the unscheduled pool underneath the timetable grid, matching the project layout pattern.
- Do not show fake sessions, fake units, fake counts, fake lecturer names, or fake student counts.
- Use an empty state when there are no schedulable sessions.
- Prepare reusable session card and unit group components for real data in the next integration unit.
- Use deterministic unit card color assignment logic, but do not require real sessions yet.
- Keep all styling aligned with `ui-context.md`.
- Do not add drag-and-drop behavior in this unit.

## Implementation

### Scope

Build the unscheduled pool UI shell only.

This unit should include:

- unscheduled pool area under the timetable grid;
- pool section heading and helper text;
- empty state when no schedulable sessions exist;
- unit grouping layout prepared for future session data;
- unscheduled session card component prepared for real DTO data;
- deterministic unit color assignment helper;
- styling for unscheduled session cards;
- no backend calls;
- no session API integration.

### Timetable Page Placement

Update the `/timetable` page so that, when the timetable grid is visible, an unscheduled pool section appears beneath it.

The page should still preserve existing states:

- loading rooms;
- room loading error;
- no-room empty state;
- timetable grid when rooms exist.

The unscheduled pool should appear only in the timetable workspace state where the grid is rendered.

Do not show the unscheduled pool on the no-room state unless the existing layout strongly supports it. In v1, rooms define whether the timetable canvas can render.

### Unscheduled Pool Empty State

Because this is a shell unit, the pool should render an empty state by default.

The empty state should explain that schedulable sessions will appear here after units and sessions are created.

The empty state should not imply that the solver or scheduling behavior already exists.

Suggested copy direction:

- title: `No schedulable sessions yet`
- description: `Create units and add sessions to make them available for scheduling.`

A link or action to `/units` may be included if consistent with the existing empty-state pattern.

### Unit Group Component

Create a component prepared to render sessions grouped by unit.

The group should be designed around future data such as:

- unit id;
- unit code;
- unit name;
- sessions belonging to the unit.

The group should visually separate one unit from another and prepare space for session cards.

Do not render fake unit groups in production UI.

### Unscheduled Session Card Component

Create a reusable session card component prepared for future real session data.

The card should be able to display:

- session type;
- unit code;
- unit name or derived session label;
- duration;
- lecturer display name;
- student count.

For this unit, the component can exist unused or be exercised only through isolated component structure. Do not render fake session cards in the timetable page.

The card should be compact and suitable for later drag-and-drop use.

### Deterministic Unit Colors

Add a small helper for assigning unit card color variants deterministically.

The helper should accept a stable unit identifier, such as `unit.id` or `unit.code`, and return one of the unit color variants defined in `ui-context.md`.

Use the existing unit/session card color tokens:

- maroon;
- gold;
- blue;
- green;
- purple;
- stone.

Do not hardcode hex values in components.

### Out of Scope

Do not implement:

- backend API calls;
- schedulable-session fetching;
- TanStack Query wiring for sessions;
- real unscheduled session rendering;
- assignment data;
- manual scheduling;
- click-to-place scheduling;
- drag-and-drop;
- scheduled session rendering;
- constraint validation;
- solver UI;
- mock sessions or mock units;
- Zustand session storage.

## Dependencies

No new package should be required.

Use existing frontend dependencies:

- React;
- TypeScript;
- TailwindCSS;
- shadcn/ui components already installed;
- Lucide icons if useful and already available.

Do not install dnd-kit in this unit.

## Verification Checklist

- [ ] `/timetable` shows an unscheduled pool section under the grid when rooms exist.
- [ ] The no-room state remains unchanged.
- [ ] The room loading state remains unchanged.
- [ ] The room error state remains unchanged.
- [ ] The pool shows an empty state when there are no schedulable sessions.
- [ ] The empty state does not use fake sessions or fake counts.
- [ ] A reusable unscheduled session card component exists.
- [ ] A reusable unit group component exists or the structure is clearly prepared.
- [ ] Deterministic unit color assignment logic exists.
- [ ] Card styling uses unit/session card color tokens from `ui-context.md`.
- [ ] No backend calls are made for schedulable sessions.
- [ ] No drag-and-drop behavior has been added.
- [ ] No assignment, constraint, or solver behavior has been added.
- [ ] No mock domain data is present.
- [ ] The frontend build command succeeds.
