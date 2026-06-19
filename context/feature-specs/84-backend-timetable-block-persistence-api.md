# Unit 84 Spec: Backend Timetable Block Persistence and API

## Goal

Add backend persistence and protected API support for room-specific timetable blocks. A timetable block group stores one or more blocked timetable cells, where each cell is a specific day, slot, and room. Blocks are hard timetable constraints, but this unit only creates the persisted contract and API boundary; frontend validation and solver behavior are added later.

## Design

- Keep this unit inside `backend/`.
- Do not add frontend UI in this unit.
- Do not add solver behavior in this unit.
- Do not create fake sessions for blocked slots.
- Blocks are room-specific only:
  - no `all rooms` abstraction;
  - every blocked cell must store a concrete `room_id`.
- A block group may contain one or more adjacent cells, but the backend stores cells individually.
- A block group may be unnamed.
- If no name is supplied, the block has no colour and is displayed as a plain grey block by the frontend.
- If a name is supplied, the block must have one of three colours:
  - `gold`;
  - `light_blue`;
  - `light_pink`.
- Deleting a block only makes those cells usable again. It must not attempt to reschedule sessions automatically.
- Creating or updating a block that overlaps saved assignments must unschedule those saved assignments intentionally and report which sessions were affected.
- Backend assignment-save validation remains defensive; the normal user-facing block validation path is added in later frontend units.

## Implementation

### Data model

Create two backend models:

- `TimetableBlockGroup`
- `TimetableBlockCell`

Suggested table shape:

```text
timetable_block_groups
- id
- name nullable
- colour nullable enum: gold | light_blue | light_pink
- created_at
- updated_at

timetable_block_cells
- id
- block_group_id
- day
- slot
- room_id
- created_at
```

Rules:

- `name` should be normalized by trimming whitespace.
- Blank names should be stored as `null`.
- If `name` is `null`, `colour` must be `null`.
- If `name` is present, `colour` must be present and one of the allowed values.
- Each block cell must reference an existing room.
- Each block group must have at least one cell.
- A cell is uniquely blocked across the whole timetable:
  - unique `(day, slot, room_id)`.

Use existing day and slot enum conventions. Do not introduce arbitrary times or dates.

### Migration

Create an Alembic migration that:

- creates the block colour enum;
- creates `timetable_block_groups`;
- creates `timetable_block_cells`;
- adds foreign keys:
  - `timetable_block_cells.block_group_id -> timetable_block_groups.id`;
  - `timetable_block_cells.room_id -> rooms.id`;
- cascades block cells when a block group is deleted;
- handles room deletion safely:
  - if a room is deleted, its block cells should be removed through cascade or explicit service cleanup;
- adds the unique constraint on `(day, slot, room_id)`;
- adds indexes useful for solver/snapshot lookup:
  - `(day, slot, room_id)`;
  - `block_group_id`;
  - `room_id`.

### Schemas

Create Pydantic schemas for:

- `TimetableBlockCellCreate`;
- `TimetableBlockCellResponse`;
- `TimetableBlockCreate`;
- `TimetableBlockUpdate`;
- `TimetableBlockResponse`.

Suggested request shape:

```ts
type TimetableBlockCreate = {
  name?: string | null;
  colour?: "gold" | "light_blue" | "light_pink" | null;
  cells: {
    day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
    slot: "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7";
    room_id: string;
  }[];
};
```

Suggested response shape:

```ts
type TimetableBlockResponse = {
  id: string;
  name: string | null;
  colour: "gold" | "light_blue" | "light_pink" | null;
  cells: TimetableBlockCellResponse[];
  unscheduled_session_ids?: string[];
  created_at: string;
  updated_at: string;
};
```

The `unscheduled_session_ids` field should be present on create/update responses when saved assignments were removed because they overlapped the new block cells.

### Service layer

Create a backend service module such as:

- `backend/services/timetable_block.py`

It should implement:

- `list_timetable_blocks(db)`;
- `create_timetable_block(db, payload)`;
- `update_timetable_block(db, block_group_id, payload)`;
- `delete_timetable_block(db, block_group_id)`.

Service behavior:

- Validate all room IDs exist.
- Deduplicate duplicate cells within a request.
- Reject an empty final cell set.
- Reject cells already blocked by another group.
- On update, allow the current group to keep or replace its own cells.
- On create/update, find saved assignments that overlap the requested block cells.
- Remove overlapping saved assignments in the same transaction.
- Return affected session IDs so the frontend can show a clear message.
- Never silently discard block cells, assignments, or validation failures.
- Do not modify frontend draft state; the frontend will refetch assignments and run its own cleanup.
- Do not call solver code.

### Overlap detection

A saved assignment overlaps a block when any occupied assignment cell matches a blocked cell:

```text
assignment day == block day
assignment room_id == block room_id
assignment occupied slot includes block slot
```

Use the session duration to expand assignment occupied slots.

Ensure multi-slot assignments are correctly detected.

### API routes

Add a protected router:

```text
GET    /timetable-blocks
POST   /timetable-blocks
PUT    /timetable-blocks/{block_group_id}
DELETE /timetable-blocks/{block_group_id}
```

Rules:

- All routes require authenticated admin access.
- Route handlers stay thin:
  - parse request;
  - call service;
  - return schema response.
- Return structured errors for:
  - missing block group;
  - unknown room;
  - empty cell set;
  - duplicate/occupied blocked cell;
  - named block without colour;
  - unnamed block with colour;
  - invalid day/slot values.

### Tests

Add backend tests for:

- creating an unnamed grey block contract (`name = null`, `colour = null`);
- creating a named gold block;
- creating a named light-blue block;
- creating a named light-pink block;
- rejecting a named block without colour;
- rejecting an unnamed block with colour;
- rejecting an empty cell list;
- rejecting unknown room IDs;
- deduplicating duplicate cells within the request;
- rejecting a cell already blocked by another group;
- updating a block's name, colour, and cells;
- deleting a block deletes its cells;
- creating a block overlapping a saved single-slot assignment unschedules it;
- creating a block overlapping a saved multi-slot assignment unschedules it;
- creating a block in a different room/day/slot does not unschedule unrelated assignments;
- response includes affected `unscheduled_session_ids`.

## Dependencies

No new dependencies expected.

## Verification checklist

- Backend has persisted timetable block group and cell tables.
- Every blocked cell is room-specific.
- No all-rooms block abstraction is added.
- Unnamed blocks store no colour.
- Named blocks require one of gold, light blue, or light pink.
- Duplicate blocked cells are impossible at rest.
- Creating/updating blocks intentionally unschedules overlapping saved assignments.
- Deleting blocks does not reschedule anything automatically.
- Protected CRUD routes exist.
- Route handlers remain thin.
- Backend tests pass.
