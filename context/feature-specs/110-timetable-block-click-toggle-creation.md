# Unit 110 Spec: Timetable Block Click-Toggle Creation

## Goal

Change how blocks are built in block-selection mode. Today the admin drags a
**rectangular range** of cells. Replace that with **per-cell click toggling**,
the same interaction as the `/preferences` grid: while in block-creation mode,
clicking a cell toggles it in/out of the current selection individually. The
drag-rectangle selection is removed.

Frontend-only — no schema, API, or solver changes.

## Design

- System boundary: `frontend/` only.
- Do not modify protected `components/ui/*` primitives.
- Files: `frontend/src/features/timetable/blockSelection.ts`,
  `TimetableGrid.tsx`, `GridCell.tsx`, `BlockCreateDialog.tsx`,
  `TimetableActionBar.tsx`.
- Builds on Unit 109 (blocks are edited in the draft). Do this after 109.
- Persistence, colours, naming, and the unnamed/named block rules
  (Units 84/85/109) are unchanged — only the **cell-selection interaction** changes.

## Implementation

### Click-toggle selection

- In block-creation mode, a cell click **toggles** that cell's membership in the
  pending selection (neutral → selected → neutral), mirroring the preferences
  cell-cycle interaction pattern.
- Selection is an arbitrary set of individually chosen cells; it no longer has to
  be a drag-defined rectangle and no longer requires cells to be adjacent to
  start selecting. Remove the rectangular drag-select code path in
  `blockSelection.ts`.
- Selected cells use the existing temporary token-based selection styling.
- Saving the selection creates the block(s) from the selected cells. Keep the
  existing rule that contiguous same-group cells forming a rectangle render as a
  single merged card, and non-contiguous/ gapped selections produce multiple
  independent rectangles (UI-context rectangle-merge rule) — merging is a
  **render** concern and does not constrain how cells are selected.
- Keep the existing constraint that a selection spans a **single day** if that
  rule still applies to the block model; state explicitly in the component
  whether cross-day multi-select is allowed (default: keep single-day to match
  the current block model).
- Naming + colour still happen via the block dialog after cells are chosen.

### Exiting / clearing

- Entering block mode starts with an empty selection; leaving block mode without
  saving discards the pending selection (no draft/block change).
- Provide a clear-selection affordance (or toggle each cell off) consistent with
  the existing action-bar controls.

## Dependencies

- Unit 109 (draft-integrated blocks). Units 84/85 (block model/rendering). No new
  packages.

## Tests

Frontend (Vitest + RTL):

- In block mode, clicking a cell selects it and clicking again deselects it.
- A non-rectangular set of clicked cells can be saved and produces the expected
  block cells (rendered as merged rectangles where contiguous, separate where not).
- Leaving block mode without saving discards the selection and changes nothing.
- The old drag-rectangle path is gone (no regression test depends on it; update
  or remove `blockSelection` tests that assert rectangle-drag).

## Verification checklist

- Block cells are chosen by clicking/toggling individual cells (no drag rectangle).
- Non-contiguous selections are allowed and save correctly.
- Merged-rectangle rendering still applies to contiguous same-group cells.
- Discarding block mode leaves the draft unchanged.
- Frontend tests and build pass; `context/progress-tracker.md` updated (and
  `ui-context.md` if it describes rectangle drag-selection).
