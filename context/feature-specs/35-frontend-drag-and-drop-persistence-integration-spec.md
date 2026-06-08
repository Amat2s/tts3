# Unit 35 Spec: Frontend Drag-and-Drop Persistence Integration

## Goal

Connect drag-and-drop scheduling to the real assignment API. The result should let admins drag unscheduled sessions onto the timetable and drag scheduled sessions between cells, with changes persisted to the backend.

## Design

- Keep this unit in the frontend/backend connection boundary.
- Use the drag-and-drop shell from Unit 34.
- Use the assignment API client and assignment integration from Units 32 and 33.
- Drag-and-drop should call the same backend scheduling and move behavior as manual scheduling.
- Use TanStack Query invalidation/refetching after successful drops.
- Do not implement constraint validation, invalid highlighting, or solver behavior in this unit.

## Implementation

On drop:

- if dragging an unscheduled session, call the schedule assignment API;
- if dragging a scheduled session, call the move assignment API.

Use the target cell to provide:

- room id;
- day;
- start slot.

After a successful drop, refresh:

- assignments;
- schedulable sessions.

On failed drop:

- show a clear error;
- leave the UI based on backend data;
- do not fake a successful move.

Disable duplicate drop submissions while a mutation is running.

Keep manual scheduling available as a fallback path.

## Dependencies

No new package should be required if Unit 34 installed the drag-and-drop dependencies.

This unit depends on:

- Unit 33 manual scheduling integration;
- Unit 34 drag-and-drop scheduling shell.

## Verification Checklist

- [ ] Dropping an unscheduled session schedules it through the backend.
- [ ] Dropping a scheduled session on another cell moves it through the backend.
- [ ] Successful drops refresh assignments.
- [ ] Successful drops refresh schedulable sessions.
- [ ] Failed drops show a visible error.
- [ ] Failed drops do not create fake local state.
- [ ] Manual scheduling still works.
- [ ] No constraint validation or invalid highlighting is added.
- [ ] No solver behavior is added.
- [ ] The frontend build command succeeds.
