# Unit 85 Spec: Frontend Timetable Block API and Rendering

## Goal

Add the frontend API client, tokens, query loading, and passive grid rendering for timetable blocks. Users should be able to see persisted blocked cells on the timetable, but this unit does not add block-selection mode or validation behavior yet.

## Design

- System boundary: `frontend/` plus `ui-context.md` and global CSS tokens.
- Use the Unit 84 API.
- Do not add solver behavior.
- Do not add placement validation yet.
- Blocks render in the timetable grid, not in the unscheduled pool.
- Blocks must look distinct from scheduled session cards.
- Unnamed blocks render as grey/disabled with a lock icon.
- Named blocks render with lock icon, name, and selected colour.
- Block colour tokens must be separate from subject tokens.
- Do not modify protected `components/ui/*` primitives.

## Implementation

### API client

Create `frontend/src/lib/api/timetableBlocks.ts` with:

- `TimetableBlockColour = "gold" | "light_blue" | "light_pink"`;
- block group/cell DTOs;
- create/update input types;
- `listTimetableBlocks`;
- `createTimetableBlock`;
- `updateTimetableBlock`;
- `deleteTimetableBlock`;
- readable error parsing.

Use the existing authenticated API client.

### Tokens

Add block tokens to `ui-context.md` and global CSS:

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

### Timetable query and rendering

On `/timetable`:

- load blocks with `['timetable-blocks']`;
- flatten block groups into a cell lookup keyed by `day:room_id:slot`;
- pass blocked-cell data into `TimetableGrid` / `GridCell`;
- render blocked cells with a lock icon;
- show named labels only when `name` exists;
- fallback to grey if colour is missing/unknown.

If block loading fails, show a concise error inside the sticky timetable action bar.

### Existing block edit/delete

Add basic existing-block management if practical:

- clicking a block opens a dialog/sheet;
- allow editing name/colour;
- allow delete;
- do not add cell re-selection yet;
- invalidate `['timetable-blocks']` and `['assignments']` after update/delete;
- surface `unscheduled_session_ids` count from backend responses when present.

## Dependencies

Unit 84.

No new dependencies expected.

## Verification checklist

- Frontend block API client exists.
- `/timetable` loads `['timetable-blocks']`.
- Unnamed blocks render grey with lock icon.
- Named blocks render with label and colour.
- Block colours use dedicated tokens.
- Blocks are visually distinct from scheduled sessions.
- Blocks do not appear in the unscheduled pool.
- Block query errors surface in the sticky bar.
- No placement validation is added yet.
- Frontend tests and build pass.
