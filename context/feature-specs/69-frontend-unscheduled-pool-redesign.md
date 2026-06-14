# Unit 69 Spec: Frontend Unscheduled Pool Redesign

## Goal

Redesign the unscheduled sessions area so sessions sit inside unit boxes, with units arranged across the page and sessions stacked within each unit. This should not change scheduling functionality.

## Design

- Keep this unit inside `frontend/features/timetable` and the timetable route.
- Do not change backend APIs in this unit.
- Do not change drag/drop behavior or validation rules.
- Unit boxes are the primary grouping.
- Each unit box shows unit code and unit name once in the heading.
- Session cards inside a unit box do not repeat unit code/name.
- Sessions stack in one column inside each unit box.
- Unit boxes stack/wrap across the page.
- Empty unit boxes disappear.
- If all schedulable sessions are scheduled, show a positive completion message.
- Add unscheduled-session search and year-level filter.

## Implementation

### Data grouping

Update `buildUnitBuckets` or equivalent:

- Group only currently unscheduled sessions.
- Include `unit_year_level` in bucket metadata.
- Exclude buckets with zero sessions after filtering.
- Sort buckets by year level, then unit code, then unit name.
- Sort sessions within a unit by session type and lecturer/display order.

### Unit box component

Update or replace `UnitGroup`:

- Render a bordered/elevated unit box using tokens.
- Header shows:
  - unit code;
  - unit name;
  - optional year badge;
  - remaining session count.
- Body stacks session cards vertically.
- Unit box width should be compact but readable.
- Use CSS grid or flex wrap so boxes flow across the page.

### Session card content

Update `UnscheduledSessionCard`:

- Remove repeated unit code/name from the card.
- Show session type.
- Show duration as hours.
- Show lecturer display name.
- Show allocated student count.
- Keep draggable behavior and selected state.
- Keep drag preview aligned with the card style.

### Filters

Add controls inside/above the unscheduled pool:

- Search by unit code, unit name, session type, and lecturer display name.
- Filter by unit year level:
  - All years
  - Year 1
  - Year 2
  - Year 3
- Filtering affects only the pool display and selectable sessions.
- A scheduled session remains scheduled even if it would be filtered out while unscheduled.

### Completion and empty states

Distinguish these states:

1. No schedulable sessions exist at all: existing empty state pointing to `/units`.
2. Schedulable sessions exist but all are scheduled: show a success/completion message such as `All schedulable sessions are scheduled.`
3. Filters hide all unscheduled sessions: show `No unscheduled sessions match your filters.` with clear-filter action.

### Drag/drop preservation

- Existing `onSelectSession`, `pendingSessionId`, draggable IDs, and `DragOverlay` behavior continue to work.
- Do not introduce backend mutations on drag.
- Do not change validation checks.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Units render as boxes across the page.
- Sessions stack in a single column inside each unit box.
- Unit heading shows code/name once.
- Session cards do not repeat unit code/name.
- Empty unit boxes are not rendered.
- Search filters unscheduled sessions by unit/session/lecturer text.
- Year-level filter works.
- `No schedulable sessions` state still works.
- `All schedulable sessions are scheduled` completion state appears when appropriate.
- Filter-empty state is distinct and offers clear filters.
- Drag/drop and click scheduling still work.
- No validation behavior changes in this unit.
- Frontend tests cover grouping, filtering, completion state, and scheduling interaction preservation.
