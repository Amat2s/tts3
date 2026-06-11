# Unit 38 Spec: Frontend Drag-and-Drop Scheduling Shell

## Goal

Add drag-and-drop scheduling interactions to the frontend draft timetable. Drops should be checked by frontend blocking validation before entering the draft, and warning validation should update immediately after accepted drops.

## Design

- Keep this unit inside `frontend/`.
- Install dnd-kit just in time.
- Drag/drop updates frontend draft state only.
- Do not save on drop.
- Keep manual non-drag controls available.
- Use frontend validation as the interaction gate.

## Implementation

### Scope

Build:

- draggable unscheduled session cards;
- draggable scheduled session cards;
- droppable timetable cells;
- drop target highlighting;
- drag preview matching placed size where practical;
- drop rejection for blocking validation failures;
- draft update for accepted drops;
- warning recalculation after accepted drops.

### Backend Interaction

No backend assignment mutation happens during drag/drop. The existing save button persists the draft later.

## Dependencies

Units 34 and 37.

## Verification Checklist

- [ ] Unscheduled sessions can be dragged over cells.
- [ ] Scheduled sessions can be moved by drag/drop.
- [ ] Blocking-invalid drops are rejected.
- [ ] Warning-invalid drops are accepted and flagged.
- [ ] No backend mutation happens on drop.
- [ ] Save button remains the persistence path.
