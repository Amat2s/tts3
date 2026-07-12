# Unit 108 Spec: Timetable Grid View Controls & Session Search/Filter

## Goal

Improve the `/timetable` grid view-controls row (the row that already holds the
Unit 103 **extend** toggle and **particular-days** selector):

1. **Add a session search + filter** (course / lecturer / student) on the **left
   side** of that same controls row.
2. **Smaller room header text** when the grid is narrow.
3. **Extend view 2× narrower.** Make the extended (wider) grid mode ~half its
   current total width.

All **frontend-only** — no schema, API, or solver changes.

## Design

- System boundary: `frontend/` only.
- Do not modify protected `components/ui/*` primitives.
- Files: `frontend/src/features/timetable/GridViewControls.tsx`,
  `gridView.ts`, `TimetableGrid.tsx`, `ScheduledSessionCard.tsx`,
  `UnscheduledPool.tsx` / `unscheduledPoolView.ts`, and the timetable route.
- Search/filter is **view-only**: it never unschedules, deletes, or alters any
  assignment, block, or preference, and validation/the solver still run on the
  full dataset (same guarantee as the Unit 103 day/extend controls).

## Implementation

### 1. Course / lecturer / student search + filter

- Add a search input (and, where it fits, compact filter affordance) to the
  **left** end of the grid controls row, on the same row as extend + day filters.
- Matching is by **unit/course** (code or name), **lecturer** (session-level
  lecturer name), and **student** (student name and/or student number) allocated
  to the session via its hidden allocations.
- **On the grid:** matching scheduled cards render normally; **non-matching**
  scheduled cards are **dimmed/faded** in place (not hidden, not moved). An empty
  query dims nothing.
- **In the unscheduled pool:** non-matching sessions are **removed from view**
  (hidden) while the query is active, so the pool shows only matching sessions.
  This is a view filter layered on top of the pool's existing unit-code/name/
  lecturer search (Unit 76) — extend it to also match student and keep the pool's
  existing group-by-unit layout for the remaining sessions.
- Clearing the query restores full opacity on the grid and all sessions in the
  pool. Do not rely on colour/opacity alone for meaning beyond de-emphasis; this
  is a visual focus aid, not a status.

### 2. Smaller room header text on narrow grids

- Reduce the room sub-header font size further when the grid is in its narrow
  (non-extended / small container) state, keeping `truncate` and the existing
  token colours (builds on the Unit 103 `text-[0.65rem]` reduction). Do not
  shrink day headers or time labels.

### 3. Extend view 2× narrower

- In extended mode, halve the grid's overall extended width relative to the
  current behaviour (roughly 2× narrower total), so extend is less aggressive
  while still widening past the container and keeping the grid container
  horizontally scrollable (the page itself must not scroll horizontally).
- Extending still triggers the existing `ResizeObserver`/`onMetricsChange`
  recompute so drag/drop preview and hover highlighting stay aligned to the new
  cell width.

## Dependencies

- Unit 103 (shared grid view controls) complete; Unit 76 (pool search). No new
  packages.

## Context updates

- `context/ui-context.md` — note the added timetable search/filter in the grid
  controls row (dim non-matching grid cards; hide non-matching pool sessions),
  the narrow-grid room-text reduction, and the halved extended width.

## Tests

Frontend (Vitest + RTL):

- Searching by course, lecturer, and student each dims non-matching grid cards
  and hides non-matching pool sessions; clearing restores both.
- Filtering never changes underlying assignments/blocks (data intact after
  clearing).
- Room header text uses the reduced size in narrow mode and still truncates.
- Extend toggle produces the narrower extended width and still makes the grid
  container (not the page) horizontally scrollable; drag metrics recompute.

## Verification checklist

- Search/filter sits on the left of the extend + day-filters row.
- Grid dims non-matching sessions; pool hides non-matching sessions.
- Filter is view-only; solver/validation unaffected.
- Room text is smaller on narrow grids and truncates.
- Extended mode is ~2× narrower and scrolls within its container only.
- Frontend tests and build pass; `ui-context.md` and progress tracker updated.
