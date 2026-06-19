# Unit 86 Spec: Frontend Block Selection Mode and Validation Integration

## Goal

Add manual block creation to the timetable workspace and wire timetable blocks into frontend-owned blocking validation. The admin should be able to enter block-selection mode, select adjacent room-specific timetable cells, optionally name the block, choose a colour when named, and save it. Sessions must not be manually placeable into blocked cells, and restored/local drafts must be cleaned up if they overlap blocks.

## Design

- Keep this unit inside `frontend/`.
- Use the API client and rendering foundations from Unit 85.
- Use the sticky timetable action bar from Unit 77.
- Preserve explicit-save scheduling architecture:
  - timetable assignments still mutate the frontend draft first;
  - blocks are persisted through the block API, not through assignment save.
- Because blocks persist immediately, block creation/editing should be disabled while the timetable draft has unsaved changes.
- Do not add backend or solver logic in this unit.
- Do not modify protected `components/ui/*` primitives.
- Blocks are room-specific:
  - every selected cell has a specific room;
  - no all-rooms shortcut.
- Block creation selection should be intentionally simple:
  - select adjacent cells;
  - prefer a rectangular selection within one day;
  - allow one or multiple room columns;
  - store every selected cell individually.
- If no name is given:
  - save `name = null`;
  - save `colour = null`;
  - render as plain grey.
- If a name is given:
  - require or preselect one of `gold`, `light_blue`, or `light_pink`;
  - render with label and colour.

## Implementation

### Block mode entry

Add an action to the sticky timetable action bar:

- Button label: `Add block`.
- Button enters block-selection mode.
- Block mode should be unavailable when:
  - solver is running;
  - timetable data is still loading;
  - timetable block data failed to load;
  - timetable draft is dirty/unsaved;
  - there are no rooms.
- If the draft is dirty, show a concise disabled reason:
  - `Save or discard timetable changes before editing blocked slots.`

When block mode starts:

- Disable normal session drag/drop.
- Clear pending session selection.
- Clear active drag state.
- Show short instructions in the sticky bar:
  - `Select adjacent timetable cells to block.`
- Provide cancel action.

### Cell selection behavior

Implement block selection on the timetable grid:

- Clicking the first empty/blockable cell starts a selection anchor.
- Hovering/clicking another cell extends the selection.
- Selection should resolve to a contiguous rectangular cell set within one day:
  - same day only;
  - slot range from min slot to max slot;
  - room range from min visible room column to max visible room column within that day.
- Every selected cell is still saved individually with its own `room_id`.
- Already-blocked cells should not be selectable.
- Cells with scheduled draft assignments should be treated as selectable only if the draft is clean and the backend will unschedule saved assignments; however, because block mode is disabled while dirty, the normal case is saved assignments only.
- If a selected block overlaps saved assignments, rely on the Unit 84 backend response/refetch to unschedule and report affected sessions.

Keep selection predictable rather than supporting irregular freeform shapes in this unit.

### Selection visual state

Update `GridCell` or the grid overlay layer:

- show selected cells with temporary block-selection styling;
- use token-based styles;
- include non-colour indication where practical;
- do not reuse scheduled-card styling;
- existing named/unnamed blocks remain visible.

### Block creation dialog

After the selection is confirmed, open a dialog/sheet with:

- summary of selected cells:
  - day;
  - human slot labels;
  - room names/count;
- optional name field;
- colour selector shown/enabled only when the normalized name is non-empty;
- colour options:
  - Gold;
  - Light blue;
  - Light pink.
- If name is blank:
  - submit with `name: null`, `colour: null`.
- If name is present:
  - submit with selected colour.
  - Default/preselect `gold` if the user has not chosen a colour, or require an explicit choice. Prefer preselecting `gold` for smoother UX.
- Submit calls `createTimetableBlock`.

On success:

- invalidate `["timetable-blocks"]`;
- invalidate `["assignments"]`;
- invalidate `["schedulable-sessions"]` only if current pool derivation depends on saved assignments through refetch;
- exit block mode;
- clear block selection;
- show a concise sticky-bar message:
  - `Blocked slots added.`
  - If sessions were unscheduled: `Blocked slots added. N scheduled sessions were returned to the unscheduled pool.`
- Ensure saved assignments refetch resets the clean draft from backend state.

### Frontend blocking validation rule

Add a new blocking issue type:

```ts
type BlockingIssueType =
  | "room_double_booking"
  | "room_capacity_too_small"
  | "session_crossing_lunch"
  | "session_off_timetable"
  | "timetable_slot_blocked";
```

Update validation helpers in `frontend/src/lib/validation/blocking.ts`:

- `checkProposedPlacement` should accept blocked cell data.
- `checkDraftForBlockingViolations` should accept blocked cell data.
- `getBlockingViolatorIds` should account for blocks.
- A proposed assignment violates the rule if any occupied `(day, slot, room_id)` cell is blocked.
- Message should identify the block name when available:
  - `This time is blocked by Chapel.`
- If the block is unnamed:
  - `This time is blocked.`
- User-facing messages must use human time labels where relevant, not raw slot IDs.

### Manual placement and drag/drop integration

Update both placement paths:

- click-based scheduling;
- drag-and-drop scheduling.

Behavior:

- blocked placements are rejected before entering the draft;
- after a failed drop/place attempt, the sticky action bar shows the blocking reason;
- invalid hover over blocked cells shows no highlighted target and no reason before drop;
- successful placement behavior remains unchanged.

This must compose with Unit 78 hover behavior:

- if the hovered range intersects a blocked cell, highlight no cells;
- do not show a pre-drop reason.

### Local draft restoration cleanup

Update the draft cleanup path from Unit 79:

- restored drafts should run through blocking validation including blocked cells;
- any assignment overlapping a blocked cell should be automatically unscheduled;
- show a concise message in the sticky action bar when this cleanup occurs, if the current UI already surfaces cleanup reasons.
- Do not treat unscheduled sessions as validation issues.

### Existing block edit/delete integration

If Unit 85 added edit/delete:

- enforce the same dirty-draft guard before editing or deleting blocks;
- on delete, invalidate `["timetable-blocks"]`;
- deleting a block should not restore assignments automatically;
- after delete, the cells become valid future placement targets.

### Tests

Add/update frontend tests for:

- Add block button appears in the sticky timetable action bar;
- Add block is disabled with an explanatory reason while the timetable draft is dirty;
- entering block mode disables normal scheduling interactions;
- rectangular same-day selection builds the correct room-specific cells;
- selection cannot include already-blocked cells;
- blank-name submit sends `name: null` and `colour: null`;
- named submit sends selected colour;
- named submit defaults or requires colour according to implementation choice;
- successful create invalidates block and assignment queries;
- backend unscheduled-session count is surfaced when present;
- click placement into a blocked cell is rejected;
- drag/drop placement into a blocked cell is rejected after drop;
- hover over a blocked target shows no range highlight;
- restored local draft overlapping a block is cleaned up.

## Dependencies

No new dependencies expected.

If a colour picker, popover, or dialog primitive is needed, add it through the existing shadcn workflow and do not edit protected UI primitives directly.

## Verification checklist

- Admin can enter and cancel block-selection mode.
- Block mode is unavailable while the timetable draft is dirty.
- User can select adjacent room-specific cells.
- Selected cells are persisted as individual day/slot/room cells.
- Blank-name blocks are saved unnamed and colourless.
- Named blocks use gold, light blue, or light pink.
- Manual click placement cannot place sessions on blocked cells.
- Drag/drop cannot place sessions on blocked cells.
- Invalid hover over blocked cells shows no highlight or reason.
- Failed drop/place shows the block reason after the attempt.
- Restored drafts overlapping blocks are automatically cleaned.
- Frontend tests and build pass.
