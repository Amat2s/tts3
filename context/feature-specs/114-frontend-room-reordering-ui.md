# Unit 114 Spec: Frontend Room Reordering UI

## Goal

Let the admin reorder rooms with **move-up / move-down buttons** on the `/rooms`
page, and have that order drive the room columns on the `/timetable` and
`/preferences` grids. The reordered list is the top-to-bottom order in the Rooms
table; the timetable renders those rooms left-to-right in the same order.

**The frontend updates instantly.** A reorder is reflected in the UI the moment
the admin clicks — the rooms table, and the `/timetable` and `/preferences`
grids, all re-order immediately from the local query cache. The backend
(Unit 113) is a pure store: the persist call fires in the **background** and the
UI never waits on it, blocks on it, or flickers while it is in flight. If the
persist fails, the optimistic change is rolled back and an error is surfaced.

Frontend-only. Depends on Unit 113 (`position` field + `PUT /rooms/reorder`).

## Instant-update model (core requirement)

Use TanStack Query **optimistic updates**, the same pattern as the lecturer
preferences editor (Unit 100), applied to the shared `['rooms']` query:

- All three routes read room order from the **same** `['rooms']` query
  (`routes/rooms.tsx`, `routes/timetable.tsx:204`, `routes/preferences.tsx:64`),
  and both grids render the `rooms` array in the order the cache holds. So a
  single optimistic cache write re-orders the Rooms table **and** both grids with
  no refetch.
- The reorder `useMutation`:
  - `onMutate(orderedIds)`: cancel in-flight `['rooms']` fetches, snapshot the
    current cache, and **immediately** `setQueryData(['rooms'], reordered)` so the
    UI reflects the new order synchronously on click. Return the snapshot for
    rollback.
  - `mutationFn`: call `reorderRooms(orderedIds)` in the background. The UI does
    not depend on its timing.
  - `onError(_e, _vars, ctx)`: restore the snapshot cache and surface an error
    (inline `Alert` + warning icon, matching the page's existing error idiom).
  - `onSettled`: optional light reconciliation — do **not** hard-invalidate in a
    way that causes a visible reorder flicker; the optimistic cache is the source
    of truth between reorders. Prefer no `invalidateQueries` here (mirrors the
    Unit 103 decision to drop the per-click refetch on the preferences grid), or
    a background refetch that writes the same order.
- Rapid consecutive clicks stay responsive: each click re-computes the full order
  from the current cache and writes it optimistically; the buttons never block on
  a pending request. (If needed, guard only against a truly in-flight request by
  coalescing to the latest order, never by disabling the UI on network latency.)

## Design

- System boundary: `frontend/` only. No new packages.
- Do not modify protected `components/ui/*` primitives.
- Files: `frontend/src/lib/api/rooms.ts`, `frontend/src/routes/rooms.tsx`.
- No change required in `TimetableGrid.tsx` / `PreferenceGrid.tsx` — they already
  render the `rooms` array in cache order.

## Implementation

### API client (`lib/api/rooms.ts`)

- Add `position: number` to the `Room` interface.
- Add `reorderRooms(orderedIds: string[]): Promise<Room[]>` calling
  `PUT /rooms/reorder` with `{ ordered_ids: orderedIds }`, reusing the existing
  `parseRoomError` handling for structured errors.

### Rooms page (`routes/rooms.tsx`)

- In each room row, add **Move up** and **Move down** icon buttons (`ChevronUp` /
  `ChevronDown` from lucide, matching the existing ghost-button idiom in the
  Actions cell). Up is disabled on the first room; down is disabled on the last.
- On click, compute the new **full** ordered id list (swap the row with its
  neighbour) and run the optimistic reorder mutation described above.
- Reordering acts on the **absolute** full-room order. The table has a search box
  and a room-type filter; only enable the up/down buttons when **no filter is
  active** (`roomFiltersActive(filters) === false`). While a filter is active,
  hide or disable them with a short hint, since reordering a filtered subset is
  ambiguous. Rows always render in `position` (cache) order.
- Order is conveyed by row position plus explicit arrow controls, not colour — no
  Design-Invariant-8 concern. The rollback error message pairs text with a
  warning icon.

## Out of scope

- Drag-and-drop reordering (rows or timetable headers).
- Reordering a filtered subset of rooms.
- Any backend/schema/solver change (Unit 113 owns persistence).
- Changing the Excel export order or tutorial-letter tie-break order.

## Dependencies

- Unit 113 (`position` on `RoomResponse`, `PUT /rooms/reorder`). No new packages.

## Tests

Frontend (Vitest + RTL):

- Move-down on the first room updates the rendered order **immediately** (before
  the mutation resolves) and sends the swapped full id order to `reorderRooms`.
- Up is disabled on the first row; down is disabled on the last.
- Reorder buttons are disabled/hidden while a search or type filter is active.
- A failed reorder (mocked rejection) **rolls back** to the prior order and shows
  an error; the persisted-failure does not leave the UI in the optimistic state.
- The optimistic cache write targets `['rooms']` so the timetable/preferences
  grids would reflect the same order (assert the cache/order, not a full grid
  render).

## Verification checklist

- Clicking up/down reorders the Rooms table instantly with no wait on the
  network; the change persists and survives refresh.
- `/timetable` and `/preferences` render room columns left-to-right in the same
  order, updated from the shared cache without a blocking refetch.
- A backend failure rolls the order back and surfaces a clear error.
- The Excel export column order and tutorial letters are unchanged.
- Frontend tests and build pass; `context/progress-tracker.md` updated.
