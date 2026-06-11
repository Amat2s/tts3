# Unit 35/3 Spec: Frontend Unscheduled Pool Layout and Drag Preview Refinement

## Goal

Refine the unscheduled pool UI so units are displayed as side-by-side columns with compact session rows underneath. The result should make the unscheduled area more space-efficient without changing scheduling behavior, persistence, assignment logic, or backend data.

## Design

- Keep this unit inside `frontend/`.
- This is a UI-only refinement.
- Do not change API calls, backend schemas, assignment behavior, or scheduling rules.
- Keep using real schedulable-session data from the existing unscheduled pool integration.
- Units should display next to each other like columns.
- Sessions should stack vertically inside each unit column.
- Session boxes should be smaller and only show the essential scheduling details.
- Dragged session previews should match the shape and size of placed timetable cards.

## Implementation

Update the unscheduled pool layout:

- group sessions by unit as before;
- render unit groups horizontally as columns;
- put unit summary information in the top unit header/card;
- stack that unit's sessions vertically underneath;
- keep the layout responsive when many units exist.

The unit header should show the information that applies to all sessions in that unit, such as:

- unit code;
- unit name;
- lecturer;
- student count if useful at unit level.

Compact session boxes should show only:

- session type;
- duration;
- student count.

Remove repeated unit/lecturer details from each session box if that information is already shown in the unit header.

Update drag styling so that when an unscheduled session is picked up, the drag preview uses the same approximate shape and size as the scheduled card that will appear on the timetable.

Do not change what data is persisted or what happens when a card is dropped.

## Dependencies

No new package should be required.

This unit depends on the existing unscheduled pool and drag-and-drop work.

## Verification Checklist

- [ ] Units in the unscheduled pool render as side-by-side columns.
- [ ] Sessions stack vertically under their unit column.
- [ ] Unit-level details appear in the unit header instead of being repeated on every session.
- [ ] Compact session boxes show session type, duration, and student count.
- [ ] The unscheduled pool still uses real schedulable-session data.
- [ ] Drag preview shape and size matches the placed timetable card style.
- [ ] Drag-and-drop scheduling behavior still works.
- [ ] Manual scheduling behavior still works.
- [ ] No backend, API, assignment, constraint, or solver behavior is changed.
- [ ] No mock session or unit data is added.
- [ ] The frontend build command succeeds.
