# Unit 100 Spec: Frontend Lecturer Preference API Integration

## Goal

Wire the Unit 99 Preferences grid to the Unit 98 API: loading the selected lecturer's preference cells and toggling cells to set them, saving immediately per click.

## Design

- System boundary: `frontend/`.
- Use the Unit 98 API.
- Each cell cycles neutral -> preferred -> avoid -> neutral on click.
- Each click calls the backend immediately; there is no dirty-draft or explicit save step on this page.
- The frontend does not validate clicks against availability, blocks, or sessions — any cell can be toggled for any lecturer, matching the backend's unvalidated persistence.
- Preferred/avoid colours use dedicated tokens, separate from subject and block tokens.
- Do not modify protected `components/ui/*` primitives.

## Implementation

### API client

Create `frontend/src/lib/api/lecturerPreferences.ts` with:

- `LecturerPreferenceLevel = "preferred" | "avoid"`;
- preference cell DTO;
- `listLecturerPreferences(lecturerId)`;
- `upsertLecturerPreference(cell)`;
- `deleteLecturerPreference(cell)`;
- readable error parsing.

Use the existing authenticated API client.

### Tokens

Add preference tokens to `ui-context.md` and global CSS:

```css
--preference-preferred-bg
--preference-preferred-border
--preference-preferred-text
--preference-avoid-bg
--preference-avoid-border
--preference-avoid-text
```

### Query and interaction

- On lecturer selection, load `['lecturer-preferences', lecturerId]` and render each returned cell's level on the grid.
- Clicking a cell:
  - neutral -> calls upsert with `preferred`;
  - `preferred` -> calls upsert with `avoid`;
  - `avoid` -> calls delete (back to neutral);
- update the grid optimistically and invalidate `['lecturer-preferences', lecturerId]` on settle;
- switching lecturers swaps the loaded/highlighted cell set with no cross-lecturer bleed.

If the preference query fails, show a concise inline error near the grid.

## Dependencies

Unit 99.

No new dependencies expected.

## Verification checklist

- Frontend lecturer preference API client exists.
- Selecting a lecturer loads and renders their saved preference cells.
- Clicking a cell cycles neutral -> preferred -> avoid -> neutral.
- Each click persists immediately via the API.
- Preferred/avoid render with dedicated colour tokens.
- Switching lecturers shows only that lecturer's cells.
- Preference query errors surface near the grid.
- Frontend tests and build pass.
