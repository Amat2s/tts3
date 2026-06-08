# Unit 34 Spec: Frontend Drag-and-Drop Scheduling Shell

## Goal

Add the frontend drag-and-drop interaction shell for timetable scheduling. The result should let real sessions visually drag over real timetable cells, without persisting drop results yet.

## Design

- Keep this unit inside `frontend/`.
- Install `dnd-kit` just in time for drag-and-drop behavior.
- Use real sessions and assignments already available from the timetable page.
- Drag-and-drop state should be UI-only.
- Do not create fake sessions, fake rooms, or fake assignments.
- Do not persist drops in this unit.
- Keep the existing manual scheduling path working.
- Do not add constraint validation, solver behavior, or backend changes.

## Implementation

Install the required `dnd-kit` packages.

Add drag behavior for:

- unscheduled session cards in the unscheduled pool;
- scheduled session cards already placed on the grid.

Add drop target behavior for timetable cells.

Track only temporary UI state, such as:

- active dragged session;
- active dragged assignment;
- hovered drop target;
- drag preview or lifted visual state.

The grid should give clear feedback when a draggable item is over a cell.

Do not call the assignment API when a drop happens yet. Persistence is handled in Unit 35.

Keep the non-drag manual scheduling controls usable for accessibility and fallback.

## Dependencies

Install only what is required for this unit:

- `@dnd-kit/core`;
- `@dnd-kit/accessibility` if needed by the selected implementation pattern;
- any small `dnd-kit` helper package only if directly required.

Do not install solver, constraint, or backend packages.

## Verification Checklist

- [ ] `dnd-kit` is installed.
- [ ] Unscheduled session cards can be dragged visually.
- [ ] Scheduled session cards can be dragged visually.
- [ ] Timetable cells act as visual drop targets.
- [ ] Drag hover state is visible.
- [ ] Manual scheduling still works.
- [ ] No drop persistence is added.
- [ ] No backend routes or API clients are changed.
- [ ] No mock timetable data is added.
- [ ] No constraint or solver behavior is added.
- [ ] The frontend build command succeeds.
