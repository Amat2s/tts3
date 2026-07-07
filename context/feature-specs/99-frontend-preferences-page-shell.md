# Unit 99 Spec: Frontend Preferences Page Shell

## Goal

Add a new `/preferences` tab and page shell: a timetable-shaped grid with the same day, time-slot, and room columns as `/timetable`, but with no sessions, plus a lecturer selector above the grid. This unit is layout and local UI state only — no preference data loads or saves yet.

## Design

- System boundary: `frontend/`.
- Reuse the existing timetable grid layout (days Monday-Friday, rooms nested under each day, fixed time-slot rows) but render a sessions-free variant: no scheduled/unscheduled cards, no drag-and-drop, no validation engine.
- Add `Preferences` to the top navbar alongside `/timetable`, `/units`, `/lecturers`, `/students`, `/rooms`.
- The grid needs rooms to render, same as `/timetable`: if no rooms exist, show the same empty-state message pattern instead of the grid.
- The lecturer selector is single-select, sourced from the existing lecturers query; selecting a lecturer is local UI state only in this unit (no highlighting of persisted data yet).
- Do not modify protected `components/ui/*` primitives.

## Implementation

### Route and navbar

- Add `frontend/src/routes/preferences.tsx` behind the existing protected-route pattern.
- Add a `Preferences` entry to `TopNav`.

### Grid shell

- Add a sessions-free grid component under `frontend/src/features/preferences/` (e.g. `PreferenceGrid.tsx`, `PreferenceCell.tsx`) that reuses the same day/room/slot structure as `TimetableGrid` without session rendering, drag/drop, or the sticky action bar.
- Cells render empty/neutral by default; no highlighting logic yet.

### Lecturer selector

- Add a lecturer selector component above the grid (e.g. a dropdown or searchable list) backed by the existing lecturers query.
- Track the selected lecturer in local component/page state.
- No cell interaction is wired to the selected lecturer yet.

## Dependencies

Unit 98.

No new dependencies expected.

## Verification checklist

- `/preferences` route exists and is protected.
- `Preferences` tab appears in the navbar.
- Grid renders the same day/room/slot structure as the real timetable, with no sessions.
- No rooms shows the same empty-state pattern as `/timetable`.
- Lecturer selector lists lecturers and tracks a single selection.
- No API calls to Unit 98 endpoints occur yet.
- Frontend tests and build pass.
