# Unit 84 Spec: Backend Timetable Block Persistence and API

## Goal

Add persisted room-specific timetable blocks and protected CRUD API support. Blocks are hard constraints over specific timetable cells, but this unit only creates the backend data/API contract; frontend validation and solver integration come later.

## Design

- System boundary: `backend/`.
- Blocks are **not sessions** and must not appear in session/scheduling models.
- Every blocked cell is room-specific: `day + slot + room_id`.
- No all-rooms abstraction.
- A block group may contain one or more cells.
- A block group may be unnamed.
- Unnamed block: `name = null`, `colour = null`.
- Named block: `name` required and `colour` required as one of `gold`, `light_blue`, `light_pink`.
- Creating/updating a block over saved assignments should intentionally unschedule those assignments and return affected session IDs.
- Deleting a block makes cells usable again; it does not reschedule anything.

## Implementation

### Data model and migration

Add:

- `TimetableBlockGroup`: `id`, `name`, `colour`, timestamps.
- `TimetableBlockCell`: `id`, `block_group_id`, `day`, `slot`, `room_id`, timestamp.

Migration requirements:

- create block colour enum;
- FK cells to block group and room;
- cascade cells when block group is deleted;
- safely remove block cells when a room is deleted;
- unique constraint on `(day, slot, room_id)`;
- indexes for `block_group_id`, `room_id`, and `(day, slot, room_id)`.

### Schemas and service

Add request/response schemas for list/create/update/delete.

Service rules:

- trim block name; blank becomes `null`;
- reject named block without colour;
- reject unnamed block with colour;
- require at least one cell;
- validate all rooms exist;
- dedupe duplicate cells in a request;
- reject cells already blocked by another group;
- allow update to keep/replace the current group’s own cells;
- detect saved assignment overlaps by expanding session duration into occupied cells;
- delete overlapping saved assignments in the same transaction;
- return `unscheduled_session_ids` on create/update when assignments were removed.

### API routes

Add protected routes:

```text
GET    /timetable-blocks
POST   /timetable-blocks
PUT    /timetable-blocks/{block_group_id}
DELETE /timetable-blocks/{block_group_id}
```

Route handlers should stay thin and return structured errors for invalid colour/name state, unknown rooms, empty cells, duplicate blocked cells, and missing block groups.

## Dependencies

Units 72–83 complete.

No new dependencies expected.

## Verification checklist

- Block groups and block cells persist correctly.
- Blocks are room-specific only.
- Unnamed blocks store no colour.
- Named blocks require an allowed colour.
- Duplicate blocked cells cannot exist at rest.
- Create/update unschedules overlapping saved assignments.
- Delete does not reschedule anything.
- Protected CRUD routes exist.
- Backend tests pass.
