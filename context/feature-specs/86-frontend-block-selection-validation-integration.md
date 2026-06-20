# Unit 86 Spec: Frontend Block Selection Mode and Validation Integration

## Goal

Add block-selection mode and wire timetable blocks into frontend-owned blocking validation. Users can select adjacent room-specific cells, optionally name the block, choose a colour when named, and save it. Sessions must not be manually placeable in blocked cells.

## Design

- System boundary: `frontend/`.
- Use Units 77, 78, 79, and 85 foundations.
- Block controls live in the sticky timetable action bar.
- Blocks persist immediately through the block API.
- Because blocks persist immediately, block creation/edit/delete is disabled while the timetable draft is dirty.
- Blocks are room-specific only.
- Selection should be simple and predictable: same day, adjacent/rectangular slot-room selection, saved as individual cells.
- Unnamed block: no name, no colour, grey display.
- Named block: name plus one of `gold`, `light_blue`, `light_pink`.
- Do not add backend or solver changes in this unit.

## Implementation

### Block mode

Add `Add block` to the sticky timetable action bar.

Disable it when:

- solver is running;
- rooms/block data are not ready;
- block query failed;
- no rooms exist;
- timetable draft is dirty.

Dirty-draft disabled reason:

```text
Save or discard timetable changes before editing blocked slots.
```

When block mode starts:

- disable normal session drag/drop and click placement;
- clear pending session selection;
- show concise instructions;
- provide cancel.

### Cell selection and create dialog

Selection behavior:

- first click creates an anchor;
- extending selection creates a same-day rectangular range across slots and visible room columns;
- already-blocked cells cannot be selected;
- selected cells use temporary token-based styling;
- selected cells are saved individually as `{ day, slot, room_id }`.

Create dialog:

- show selected day/time/room summary using human slot labels;
- optional name field;
- colour selector only when name is non-empty;
- if blank name, send `name: null`, `colour: null`;
- if named, send selected colour, defaulting to `gold` unless explicit selection is preferred.

On success:

- invalidate `['timetable-blocks']`;
- invalidate `['assignments']`;
- exit block mode;
- clear selection;
- show a sticky-bar success message;
- if backend returns affected sessions, show count returned to unscheduled pool.

### Blocking validation

Add blocking issue type:

```ts
"timetable_slot_blocked";
```

Update frontend blocking helpers so:

- proposed placements are rejected if any occupied cell is blocked;
- draft validation detects assignments overlapping blocks;
- automatic draft cleanup removes assignments overlapping blocks;
- messages use block name where available:
  - named: `This time is blocked by Chapel.`
  - unnamed: `This time is blocked.`
- visible messages use human time labels, not raw slot IDs.

### Placement and hover behavior

Update click placement, drag/drop placement, and hover range highlighting.

Rules:

- blocked placements never enter the draft;
- failed drop/place shows reason only after attempt;
- invalid hover over blocked cells shows no highlight and no pre-drop reason;
- deleting a block makes cells usable again but does not reschedule sessions.

## Dependencies

Unit 85.

No new dependencies expected.

## Verification checklist

- Add block action appears in the sticky bar.
- Block editing is disabled while draft is dirty.
- User can select adjacent room-specific cells.
- Blank-name blocks save colourless.
- Named blocks save with allowed colour.
- Click placement cannot use blocked cells.
- Drag/drop cannot use blocked cells.
- Invalid hover over blocked cells shows no highlight/reason.
- Restored drafts overlapping blocks are cleaned up.
- Frontend tests and build pass.
