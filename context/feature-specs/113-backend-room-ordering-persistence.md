# Unit 113 Spec: Backend Room Ordering Persistence

## Goal

Give rooms a persisted, admin-controlled **order** so the timetable can render
room columns left-to-right in that order. Today rooms have no order field: the
backend returns them alphabetically by `name`
(`services/room.py::list_rooms` → `order_by(Room.name)`). This unit adds a
`position` column, orders `list_rooms` by it, appends new rooms to the end, and
exposes a reorder endpoint.

Backend-only. The frontend reorder UI and instant-update behaviour are **Unit
114**.

## Role of this unit

The backend is a **pure store** for room order. It persists whatever ordered id
list the client sends and returns rooms in `position` order. It performs no
optimistic-UI concerns and adds no latency expectations — Unit 114 keeps the
frontend responsive independently of how fast this endpoint replies (see Unit
114's optimistic-update model). This endpoint must be simple, atomic, and
idempotent so the frontend can safely fire it in the background.

## Design

- System boundary: `backend/` only. No solver change. No new packages.
- Files: `backend/models/room.py`, `backend/schemas/room.py`,
  `backend/services/room.py`, `backend/api/rooms.py`, plus a new Alembic
  migration.
- Ordering is by `Room.position` ascending; positions need not be contiguous
  (gaps left by deletes are fine).

## Implementation

### Model & migration

- Add `position: int` to `Room` (`models/room.py`), non-null.
- New Alembic migration (new head, revises `0015`):
  - Add the `position` column (nullable for the backfill step).
  - **Backfill** so the current visible order is preserved: assign `position` by
    the existing alphabetical `name` order (e.g. `row_number()` over
    `ORDER BY name`), so the timetable looks identical immediately after
    migrating.
  - Set the column `NOT NULL`.
  - Downgrade drops the column.

### Ordering & create

- `list_rooms` orders by `Room.position` ascending, with `Room.name` as a
  deterministic tiebreaker.
- `create_room` assigns the new room `position = (current max position) + 1`
  (appended to the **end** of the order). A brand-new room becomes the right-most
  timetable column until moved.
- `delete_room` is unchanged; a positional gap is acceptable because ordering is
  by ascending `position`, not by contiguous index.

### Reorder endpoint

- New route `PUT /rooms/reorder` behind `get_current_admin`.
- Request body: `{ "ordered_ids": ["<roomId>", ...] }` — the **full** set of room
  ids in the desired top-to-bottom order. The client always sends the whole list
  (idempotent; no server-side neighbour math).
- Service `reorder_rooms(db, ordered_ids)`:
  - Validate `ordered_ids` is **exactly** the set of all existing room ids — no
    missing, no unknown, no duplicate ids. On mismatch raise a structured
    `AppError("rooms_reorder_mismatch", ..., 422)` and persist nothing.
  - Assign `position = index` for each id in the given order in one transaction;
    commit atomically.
  - Return the reordered rooms (ordered list) so the client can reconcile.
- `RoomResponse` (`schemas/room.py`) gains `position`. `RoomCreate` /
  `RoomUpdate` do **not** accept `position` — position is only mutated via the
  reorder endpoint, never via create/edit.

## Out of scope

- Any frontend change (Unit 114).
- Drag-and-drop of any kind.
- Changing the Excel export room order or the tutorial-letter tie-break order
  (both keep the Unit 93 fixed order).
- Any solver change — room order carries no feasibility meaning.

## Dependencies

- New Alembic migration revising `0015`. No new packages.

## Tests

Backend (pytest):

- Migration/backfill: after adding `position`, existing rooms come back from
  `list_rooms` in the prior alphabetical order.
- `create_room` appends the new room to the end (highest `position`).
- `list_rooms` returns rooms ordered by `position`, `name` tiebreak.
- `PUT /rooms/reorder` reorders and persists; a subsequent `list_rooms` reflects
  the new order.
- `reorder` with a missing id, an unknown id, or a duplicate id → `422`
  `rooms_reorder_mismatch`, nothing persisted (order unchanged).
- `reorder` requires admin auth (401 unauthenticated).
- `RoomResponse` includes `position`.

## Verification checklist

- Rooms persist an explicit order; `list_rooms` is ordered by `position`.
- New rooms append to the end; deleting a room does not disturb the relative
  order of the rest.
- Reorder is atomic and rejects any id-set mismatch with a structured 422.
- Backend tests and build pass; `context/progress-tracker.md` updated.
