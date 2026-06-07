# Unit 8 Spec: Frontend Timetable No-Room and Grid Shell

## Goal

Create the timetable page shell for the no-room state and future grid rendering path. The result should show a clear no-room empty state now, while establishing the grid component structure needed once real rooms exist.

## Design

- Keep this unit entirely inside `frontend/`.
- Use the existing app shell, route structure, and light academic theme.
- The timetable page should explain that rooms must be created before the timetable canvas can render.
- Build the timetable grid architecture now, but do not render fake rooms or fake sessions.
- Use fixed Monday-Friday structure and fixed time-slot rows.
- Keep timetable grid styling token-based and readable.

## Implementation

### Scope

Build the timetable no-room state and blank grid shell only.

This unit should include:

- `/timetable` page header;
- timetable action area shell;
- no-room empty state;
- timetable grid component architecture;
- Monday-Friday day structure;
- fixed time-slot row structure;
- lunch divider;
- blank room-column rendering path;
- blank cell rendering;
- grid styling using design tokens.

### Timetable Page Structure

Update the existing `/timetable` route so it has the final workspace layout direction.

The page should include:

- page title and description;
- action/status area reserved for future validation and solver controls;
- main timetable canvas area;
- no-room state when no rooms are available.

Since there is no room API yet, the page should not pretend to know about real room data. The visible default state should be the no-room empty state.

### Grid Component Architecture

Create timetable-specific components under the appropriate feature area, likely `src/features/timetable/`.

The grid shell should support:

- Monday to Friday days;
- room columns nested under each day when rooms exist later;
- fixed time-slot rows;
- lunch divider between morning and afternoon blocks;
- blank cells;
- sharp, readable grid geometry.

The grid should accept room-like input in a way that future real room data can plug in cleanly, but this unit must not include fake application records in production code.

### Time Slots

Use fixed slot definitions aligned with the project’s timetable assumptions.

Keep the slot structure centralized so later scheduling, duration rendering, and drag/drop work can reuse it.

Do not introduce arbitrary start times or continuous-time scheduling.

### Styling

Use CSS variables and Tailwind theme values from the existing UI foundation.

The grid should use the timetable tokens from `ui-context.md`, including grid lines, lunch background, hover cell treatment, and invalid-cell tokens where structurally relevant.

Do not hardcode repeated raw colors in timetable components.

### Out of Scope

Do not implement:

- room API integration;
- real room data loading;
- scheduled session rendering;
- unscheduled session pool;
- manual scheduling;
- drag-and-drop;
- assignment API calls;
- constraint validation;
- solver UI behavior;
- fake room columns;
- fake sessions;
- fake assignments;
- local mock timetable state.

## Dependencies

No new package should be required.

Do not install dnd-kit, TanStack Query, Zustand, OR-Tools-related packages, or solver dependencies in this unit.

## Verification Checklist

- [ ] `/timetable` renders a complete workspace shell.
- [ ] The page has a header and reserved action/status area.
- [ ] With no rooms available, the page shows a clear no-room empty state.
- [ ] Timetable grid components exist and are ready for real room data later.
- [ ] The grid architecture supports Monday-Friday days.
- [ ] Fixed time-slot rows are centralized.
- [ ] A lunch divider is represented in the grid structure.
- [ ] Blank cell rendering exists without fake sessions or assignments.
- [ ] Grid styling uses design tokens or Tailwind theme values.
- [ ] No room API integration, assignment logic, unscheduled pool, drag/drop, constraints, or solver behavior has been added.
- [ ] No mock room, session, assignment, constraint, or solver data is present.
- [ ] The frontend build command succeeds.
