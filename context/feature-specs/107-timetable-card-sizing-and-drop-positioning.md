# Unit 107 Spec: Timetable Card Sizing & Drop Positioning

## Goal

Fix two timetable grid geometry bugs:

1. **Drop slot is offset from the pointer.** When dragging a session, the target
   slot should sit **under the mouse pointer**, so the session drops where the
   cursor is (not shifted up/down).
2. **Multi-slot cards are too short.** Sessions (and blocks) that span 2+ time
   slots render slightly shorter than the rows they cover. Add **1px of height
   per extra hour/slot** so a multi-slot card fills its slots exactly. Apply the
   same fix to **blocks**, but only when a block spans multiple **time slots**
   (rows) — not when it spans multiple **rooms** (columns).

Both are **frontend-only** — no schema, API, or solver changes.

## Design

- System boundary: `frontend/` only.
- Do not modify protected `components/ui/*` primitives.
- Files:
  - drop/drag geometry: `frontend/src/features/timetable/TimetableGrid.tsx`,
    `hoverHighlight.ts`, `DragPreviewCard.tsx`, `GridCell.tsx` (whichever owns
    the pointer→slot mapping and drop-target resolution).
  - card height: `frontend/src/features/timetable/ScheduledSessionCard.tsx`,
    `BlockCellCard.tsx`, and the slot-height helper (`slots.ts`/grid metrics).
- Do not change validation, which cell a drop is *allowed* into, or persistence —
  only the pointer→slot mapping and the rendered card height.

## Implementation

### 1. Drop slot under the pointer

- Resolve the drop-target slot from the pointer's current grid position so the
  hovered/target cell is the one directly under the cursor.
- Remove any fixed offset that anchors the target to the top of the dragged
  card instead of the pointer. The drop-target highlight (Unit 78) must cover the
  cells the session would occupy starting from the slot under the pointer.
- Keep the existing rule: if the session cannot be placed at the hovered target,
  no cells highlight and no reason is shown until after the drop is attempted.
- The drag preview keeps matching the scheduled-card shape (live cell width, row
  height, duration) and stays centred width-wise on the pointer (Unit 78);
  this unit only corrects the **vertical** slot the drop resolves to.

### 2. Height: +1px per extra slot for multi-slot cards

- A card spanning `n` slots renders with height `n × slotHeight + (n − 1)` px,
  i.e. **+1px per extra slot beyond the first**, so it exactly covers its rows
  (accounting for per-row borders/rounding that currently leave it short).
- Apply to scheduled session cards (`ScheduledSessionCard.tsx`).
- Apply the identical rule to **block cards** (`BlockCellCard.tsx`) **only for
  the vertical span**: a block covering `n` slot-rows gets the same `+ (n − 1)`
  px; a block spanning multiple **room columns** gets **no** width adjustment
  from this rule (width stays `N_rooms × cell width` per the existing block
  rectangle-merge rule).
- Centralise the per-slot height math in the shared slot/metrics helper so
  sessions and blocks stay consistent; do not hardcode the value in two places.
- Single-slot cards are unchanged.

## Dependencies

- Units 30 (scheduled rendering), 78 (drag preview/hover), 85 (block rendering)
  complete. No new packages.

## Tests

Frontend (Vitest + RTL):

- Dragging over a cell resolves the drop target to the slot under the pointer
  (hover highlight starts at that slot).
- A 2-slot session card's computed height is `2 × slotHeight + 1`; a 3-slot card
  is `3 × slotHeight + 2`.
- A block spanning 2 slot-rows gets the same +1px-per-extra-row height; a block
  spanning 2 rooms in a single row gets no extra height.
- Existing drag/drop and hover-highlight tests still pass.

## Verification checklist

- Sessions drop into the slot under the mouse, not an offset slot.
- Multi-slot sessions and multi-row blocks visually fill their slots (no gap).
- Multi-room-only blocks are unchanged in height.
- Single-slot cards unchanged.
- Frontend tests and build pass.
- `context/progress-tracker.md` updated.
