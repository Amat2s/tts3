# Unit 78 Spec: Frontend Drag Preview and Hover Highlighting Upgrade

## Goal

Improve drag-and-drop fidelity so dragged sessions match the shape they will have on the timetable, and hovered valid placements highlight all grid cells the session would occupy. Invalid hover targets should show no highlight and no reason until the user drops.

## Design

- Keep this unit inside `frontend/`.
- Do not change backend APIs.
- Do not change validation rule definitions.
- Do not change save behavior.
- Drag preview should match scheduled timetable card dimensions, not unscheduled card dimensions.
- Preview width should use live timetable cell/column width.
- Preview height should use live row height multiplied by session duration.
- Preview should be centered on the pointer horizontally and aligned around the first slot vertically.
- Hover highlighting should cover the exact slots that would be occupied.
- Invalid targets should not highlight.
- Invalid hover should not show a reason.
- Blocking reason should only appear after a drop/place attempt fails.

## Implementation

### Grid measurement

Add a small measurement layer for timetable geometry:

- Measure a representative grid cell width.
- Measure row height.
- Recompute on window resize and when rooms/grid layout changes.
- Avoid layout thrashing; use refs and effects carefully.
- Store only UI measurement state, not server state.

Suggested shape:

```ts
type TimetableGridMetrics = {
  cellWidth: number;
  rowHeight: number;
};
```

### Drag preview dimensions

Update `DragOverlay` / preview component:

- Render the scheduled-card visual shape.
- Width = measured cell width.
- Height = measured row height × session duration.
- Use the same subject colour tokens and card styling as scheduled cards.
- Use the same compact content density as scheduled cards.
- If measurement is unavailable, fall back to a safe approximate size.

### Pointer alignment

Adjust drag overlay modifiers or transform handling:

- Center preview width-wise on the pointer.
- Vertically align pointer around the center of the first slot, not the full card height.
- This matters for multi-hour sessions: the top of the preview should still indicate the first slot that will be placed.
- Keep keyboard drag behavior functional.

### Occupied-cell hover highlight

Update droppable hover state:

- When a session is dragged over a cell, compute the slot range it would occupy.
- If the proposed placement passes blocking validation, highlight all grid cells in that range for that room/day.
- Highlight should not appear on invalid proposals:
  - room double-booking;
  - room capacity too small;
  - crossing lunch;
  - off timetable;
  - occupied/overlapping placement.
- Do not show a blocking reason during hover.
- On actual drop, keep current behavior of rejecting and showing a blocking message in the sticky bar.

### Interaction compatibility

Preserve existing controls:

- click-based scheduling fallback still works;
- scheduled card drag still works;
- unschedule button does not start drag;
- editing disabled while solver runs still disables drag/drop;
- warning recalculation still occurs after successful placement.

### Tests

Add/update tests where practical:

- preview uses scheduled-card content/styling rather than unscheduled-card shape;
- metrics helper computes duration height correctly;
- hover range computation returns all covered slots;
- invalid hover returns no highlighted slots;
- failed drop still surfaces blocking message only after drop;
- click-based scheduling remains functional.

Avoid brittle low-level pointer tests if they become unstable; test pure range/metrics helpers and visible outcomes where possible.

## Dependencies

No new dependencies expected.

## Verification checklist

- Drag preview width matches timetable cell width.
- Drag preview height reflects session duration.
- Preview is centered width-wise on the cursor.
- Preview aligns vertically to the first slot, not the full card center.
- Valid hover highlights all occupied cells.
- Invalid hover highlights no cells.
- Invalid hover does not show a reason before drop.
- Failed drop still shows blocking feedback after release.
- Existing drag/drop and click scheduling still work.
- Frontend build and tests pass.
