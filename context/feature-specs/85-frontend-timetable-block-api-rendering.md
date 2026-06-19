# Unit 85 Spec: Frontend Timetable Block API and Rendering

## Goal

Add the frontend API client, styling tokens, query loading, and passive rendering for persisted timetable blocks. Blocked timetable cells should appear on the timetable grid as unavailable cells, with unnamed blocks rendered as plain grey and named blocks rendered with their selected colour and label. This unit displays and manages existing blocks, but it does not yet add block-selection mode or placement validation.

## Design

- Keep this unit inside `frontend/`, plus required updates to `ui-context.md` and global CSS tokens.
- Use the backend routes created in Unit 84.
- Do not change solver behavior.
- Do not add frontend blocking validation yet.
- Do not add drag-to-create block selection mode yet.
- Do not modify protected `components/ui/*` primitives.
- All block colours must come from CSS tokens.
- Do not reuse subject colour tokens for timetable blocks.
- Blocks are visually distinct from scheduled session cards.
- Blocks should sit in the timetable grid as blocked-cell overlays, not as sessions.
- A named block displays a lock icon and the block name.
- An unnamed block is greyed out and may show only a lock icon.
- Existing scheduled sessions should not visually fight with blocks; after Unit 84, saved overlapping assignments should already be unscheduled on block create/update, but the frontend must still render defensively.

## Implementation

### API client

Create a frontend API client, for example:

- `frontend/src/lib/api/timetableBlocks.ts`

Export DTOs and client functions:

```ts
type TimetableBlockColour = "gold" | "light_blue" | "light_pink";

type TimetableBlockCell = {
  id: string;
  day: AvailabilityDay;
  slot: AvailabilitySlot;
  room_id: string;
};

type TimetableBlock = {
  id: string;
  name: string | null;
  colour: TimetableBlockColour | null;
  cells: TimetableBlockCell[];
  unscheduled_session_ids?: string[];
  created_at: string;
  updated_at: string;
};

type TimetableBlockCreate = {
  name?: string | null;
  colour?: TimetableBlockColour | null;
  cells: {
    day: AvailabilityDay;
    slot: AvailabilitySlot;
    room_id: string;
  }[];
};
```

Functions:

- `listTimetableBlocks()`;
- `createTimetableBlock(input)`;
- `updateTimetableBlock(id, input)`;
- `deleteTimetableBlock(id)`.

Use the existing authenticated `apiRequest` helper.

Parse backend errors into readable messages for:

- duplicate blocked cell;
- missing room;
- missing name/colour consistency;
- empty cell list;
- block not found.

### Block colour tokens

Update `ui-context.md` and global CSS with block-specific tokens.

Suggested token names:

```css
--block-empty-bg
--block-empty-border
--block-empty-text

--block-gold-bg
--block-gold-border
--block-gold-text

--block-blue-bg
--block-blue-border
--block-blue-text

--block-pink-bg
--block-pink-border
--block-pink-text
```

Suggested values should harmonise with the current academic palette:

```css
--block-empty-bg: var(--disabled-bg);
--block-empty-border: var(--border-strong);
--block-empty-text: var(--disabled-text);

--block-gold-bg: #F7F0D8;
--block-gold-border: #C9A646;
--block-gold-text: #6F5518;

--block-blue-bg: #E7EEF7;
--block-blue-border: #6F91B8;
--block-blue-text: #244D73;

--block-pink-bg: #F5E9EB;
--block-pink-border: #B77A86;
--block-pink-text: #7A1F2B;
```

These hex values are allowed only as central token definitions, not repeated in components.

### Query integration

On `/timetable`, add a TanStack Query:

```ts
queryKey: ["timetable-blocks"]
queryFn: listTimetableBlocks
```

Load blocks independently from rooms, sessions, and assignments.

Behavior:

- If blocks fail to load, show a concise system error inside the sticky timetable action bar.
- Disable block editing when block data cannot be trusted.
- Do not block basic timetable viewing solely because blocks failed to load, unless the implementation cannot safely prevent invalid actions.
- Existing assignment and schedulable-session queries remain unchanged.

### Block view model

Create a pure helper to flatten block groups into cell lookup data, for example:

```ts
type BlockedCellView = {
  blockGroupId: string;
  name: string | null;
  colour: TimetableBlockColour | null;
  day: AvailabilityDay;
  slot: AvailabilitySlot;
  room_id: string;
};
```

Build a lookup key:

```ts
`${day}:${room_id}:${slot}`
```

The view model should support:

- finding whether a cell is blocked;
- rendering a block overlay in the correct grid cell;
- grouping cells by block group for future edit/delete.

### Timetable grid rendering

Update timetable grid rendering to accept blocked cells:

- `TimetableGrid` receives block view data.
- `GridCell` receives the blocked cell for its day/room/slot when present.
- A blocked cell renders a block overlay with:
  - lock icon;
  - optional name;
  - colour variant classes based on block colour;
  - grey style when unnamed.
- Block rendering must not be confused with scheduled session rendering.
- Block rendering should use `pointer-events` intentionally:
  - clicking an existing block should open edit/delete behavior if implemented in this unit;
  - otherwise keep it non-interactive until Unit 86.
- Ensure non-colour-only indication through a lock icon.

### Existing block edit/delete

Implement basic edit/delete for existing blocks if the API client is ready:

- Clicking a block opens a dialog or sheet.
- The dialog shows:
  - current name;
  - current colour if named;
  - read-only list/summary of affected day/time/room cells;
  - delete action;
  - save action for name/colour changes only.
- Do not add cell re-selection in this unit.
- Deleting a block invalidates:
  - `["timetable-blocks"]`;
  - `["assignments"]`.
- Updating a block invalidates:
  - `["timetable-blocks"]`;
  - `["assignments"]`.
- If the backend response includes `unscheduled_session_ids`, show a concise sticky-bar message after refetch.

### Defensive rendering

Handle edge cases:

- If a block references a room that is no longer in the loaded room list, do not crash.
- If a named block has an unexpected colour due to old/bad data, render it as unnamed grey.
- If a block and scheduled session somehow appear in the same cell because of stale data, render the block state clearly and let later validation cleanup resolve the assignment.
- Do not silently mutate draft state in this unit.

### Tests

Add/update frontend tests for:

- API client request/response types where practical;
- block-cell view model flattening;
- unnamed block renders as grey/disabled with lock icon and no label;
- named gold block renders with label;
- named light-blue block renders with label;
- named light-pink block renders with label;
- block rendering does not use session card presentation;
- block query error appears in sticky action bar;
- existing block delete invalidates block and assignment queries;
- invalid/missing room block data does not crash rendering.

## Dependencies

No new dependencies expected.

If an additional dialog/sheet primitive is needed, add it through the existing shadcn workflow rather than modifying protected UI primitives.

## Verification checklist

- Frontend has a timetable block API client.
- Timetable page loads `["timetable-blocks"]`.
- Block cells render on the timetable grid.
- Unnamed blocks render as plain grey/disabled.
- Named blocks render with lock icon, label, and selected colour.
- Block colours use dedicated tokens, not subject tokens.
- Blocks are visually distinct from scheduled sessions.
- Existing block edit/delete works if included.
- No block-selection mode is added yet.
- No validation or solver behavior changes are added in this unit.
- Frontend tests and build pass.
