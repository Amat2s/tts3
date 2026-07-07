# Unit 103 Spec: Preferences Tab and Grid Bug Fixes

## Goal

Fix a set of UX/behaviour bugs found after shipping the Preferences
(Constraints) tab (Units 98-102). All fixes are **frontend-only** — no schema,
API, or solver changes. Two of the items (grid room-text sizing, the extend
control, and the day selector) apply to **both** the `/preferences` grid and the
main `/timetable` grid because they share the same day/room/slot grid structure.

The bugs to fix:

1. **Lecturer selector shows an ID after selection.** After a lecturer is
   picked, the selector trigger displays the raw lecturer ID instead of the
   lecturer's name.
2. **Backend round-trips drive the preference grid.** Each cell click refetches
   from the backend and re-renders from server state, so the backend "controls"
   what the grid shows (flicker/lag/reversion on rapid clicks). The frontend
   should own the displayed cell state; the backend/DB just stores it.
3. **Preference cells look heavy.** Remove the in-cell `Prefer`/`Avoid` text and
   make the cells look nicer and rounder.
4. **Grid room columns are cramped and fixed.** Room header text is too large,
   there is no way to widen the grid for legibility, and there is no way to focus
   on particular days. Add smaller room text, an **extend** control (widens the
   grid and adds horizontal scroll), and a **particular-days selector** to both
   grids.
5. **No preference legend.** Add a legend (green = Prefer, red = Avoid) so the
   level is still conveyed once the in-cell text is removed.
6. **Preferences nav tab position.** Move the `Preferences` nav link to the far
   right end of the (still-centered) nav list, after `Rooms`.

## Design

- System boundary: `frontend/` only.
- Do not modify protected `components/ui/*` primitives; implement all behaviour
  in app-level components.
- Preferences remains a soft-constraint, immediate-persist page: click still
  cycles neutral -> preferred -> avoid -> neutral and still persists per click.
  This unit changes only *how* the local grid state is owned and *how* cells
  render — not the persistence contract (Unit 98/100 API is unchanged).
- Day filtering and grid extension are **view-only**. They must never unschedule,
  delete, or alter any assignment, block, or preference. Hidden days keep all
  their data and reappear unchanged when re-shown. Validation and the solver
  continue to operate on the full dataset, not the filtered view.
- This unit intentionally deviates from two existing context rules; update the
  context files as part of the work (see **Context updates** below):
  - the preference-cell rendering rule in `ui-context.md` (in-cell text label);
  - the Unit 100 "invalidate on settle" interaction note.

## Implementation

### 1. Lecturer selector shows the name after selection

File: `frontend/src/features/preferences/LecturerSelector.tsx`.

- After a lecturer is selected, the trigger currently shows the raw
  `lecturer.id` (a UUID) instead of the display name. The `SelectValue` is not
  resolving the selected item's label.
- Fix so the trigger always shows the selected lecturer's full display name
  (`lecturerDisplayName` = `title first_name last_name`).
- Do not rely on Radix resolving the item text implicitly. Resolve the selected
  lecturer from the `lecturers` list by `value` and render its display name
  explicitly as the trigger content (falling back to the placeholder when no
  lecturer is selected).
- Keep the dropdown list items rendering names (already correct).

Related polish (same "human labels, not raw ids" theme): the preference cell's
accessible label currently reads raw ids (e.g. `Monday s1 <uuid>: Prefer`). Give
`PreferenceCell` the day, human time label, and room **name**, and build an
`aria-label` from those (e.g. `Monday 9:00-9:50, Room L1.05: Prefer`). The level
word must remain in the `aria-label` so the state is never conveyed by colour
alone (see item 3/5).

### 2. Frontend owns the preference grid state

File: `frontend/src/routes/preferences.tsx`.

- Remove the per-click backend round-trip that re-drives the grid: do **not**
  `invalidateQueries(['lecturer-preferences', lecturerId])` on every mutation
  settle. The optimistic cache write (`onMutate`) is the source of truth for the
  displayed grid while a lecturer is selected.
- Keep:
  - loading the lecturer's preferences once on lecturer selection
    (`['lecturer-preferences', selectedLecturerId]`, `enabled` on selection);
  - the optimistic cache update on click;
  - the `onError` rollback to the last confirmed state plus the inline error;
  - immediate persistence of every click via the Unit 98 API.
- Switching lecturers must still swap to that lecturer's set with no
  cross-lecturer bleed (the query key already scopes this; a fresh load on
  (re)selection is fine and is the intended point at which server state is
  reconciled).
- Net effect: clicking a cell updates the grid instantly and stays put; the
  backend is written to but never reorders, reverts, or re-renders the grid
  mid-interaction.

### 3. Rounder, text-free preference cells + 5. legend

Files: `frontend/src/features/preferences/PreferenceCell.tsx`,
`frontend/src/features/preferences/PreferenceGrid.tsx` (or the `/preferences`
route for legend placement).

- Preference cells: remove the in-cell `Prefer`/`Avoid` text. A preferred/avoid
  cell renders only its token fill + border, with a modest rounded radius
  (`rounded-md`, consistent with session cards — do **not** round the underlying
  grid cell geometry, only the coloured fill), inset slightly from the cell edge
  so the rounded fill reads as a chip.
- Neutral cells stay empty.
- Keep the full `aria-label` (including `Prefer`/`Avoid`) on every cell so the
  level is available to assistive tech without colour (item 1 polish).
- Add a **legend** near the grid (above or below it, on `/preferences` only):
  - a green swatch labelled `Prefer` using `--preference-preferred-*`;
  - a red swatch labelled `Avoid` using `--preference-avoid-*`.
  - The legend uses the same tokens as the cells and must never inline hex.

### 4. Room text sizing, extend control, day selector (both grids)

These apply to **both** `PreferenceGrid` and `TimetableGrid`. Prefer factoring
the shared bits (day-visibility filtering, width/extended mode, room-header
sizing) so both grids behave identically; avoid duplicating divergent logic.

- **Smaller room text.** Reduce the room sub-header font size in both grids
  (currently `text-xs`) to a smaller size while keeping truncation
  (`truncate`) and the existing token colours. Keep it readable; do not shrink
  day headers or time labels.
- **Extend control.** Add a toggle (button) that switches the grid into an
  "extended" width mode:
  - Default (collapsed) mode is unchanged: the grid fits its container with
    `flex-1` columns.
  - Extended mode gives each room column a comfortable fixed minimum width so
    columns stop squeezing, makes the grid wider than its container, and wraps
    the grid in a horizontally scrollable container (`overflow-x: auto`). The
    page itself must not scroll horizontally — only the grid container.
  - The button is a view toggle only; it persists nothing to the backend.
  - Timetable-specific requirement: extending changes the measured cell width.
    Drag/drop must keep working — the existing `ResizeObserver`/`onMetricsChange`
    metrics recompute must fire when width mode changes so the drag preview and
    hover highlighting stay aligned to the new cell width. Verify drag/drop (or
    the equivalent click-scheduling path) after extending.
- **Particular-days selector.** Add a control to choose which weekdays are shown
  (Monday-Friday), defaulting to all days visible:
  - Hiding a day removes only its columns from the rendered grid; it does not
    touch assignments, blocks, or preferences.
  - On `/timetable`, sessions/blocks on a hidden day remain saved and reappear
    when the day is shown again; validation and the solver still see all days.
  - Guard against hiding every day (keep at least one visible, or render the
    grid empty-but-intact — pick one and state it in the component).

Place the new controls where each page already hosts its toolbar: the
`/preferences` page header area (near the lecturer selector), and the timetable
`TimetableActionBar` (or an adjacent grid toolbar) for `/timetable`. Keep them
out of the grid components' render loops.

### 6. Move the Preferences nav tab to the far right

File: `frontend/src/components/layout/TopNav.tsx`.

- Reorder `NAV_LINKS` so `Preferences` is last (after `Rooms`):
  `Timetable, Units, Lecturers, Students, Rooms, Preferences`.
- Keep the nav group centered as it is today; only the item order changes.
- Update `TopNav.test.tsx` expectations if they assert link order.

## Context updates

Per `CLAUDE.md`, update context files where this unit changes documented
standards:

- `context/ui-context.md`:
  - Update the **Lecturer Preference Colors** rendering rules: preferred/avoid
    cells render a rounded token-filled chip with **no in-cell text**; the level
    is conveyed by a grid **legend** (Prefer/Avoid) plus the cell `aria-label`,
    so status is still not conveyed by colour alone (Design Invariant 8 is
    satisfied at the grid level, not per-cell text).
  - Note the room-header text size reduction and the extend/day-selector view
    controls as grid conventions shared by `/timetable` and `/preferences`.
- `context/feature-specs/100-frontend-lecturer-preference-api-integration.md`:
  note that Unit 103 supersedes the "invalidate `['lecturer-preferences']` on
  settle" step — the frontend optimistic cache is the source of truth between
  loads.
- `context/progress-tracker.md`: record this bug-fix unit after implementation.

## Dependencies

Units 98-102 (Preferences tab and lecturer preferences) complete. No new
package dependencies expected.

## Tests

Frontend (Vitest + React Testing Library):

- Selecting a lecturer shows the lecturer's **name** in the selector trigger,
  not the ID.
- Clicking a preference cell updates it optimistically and it stays set without
  a refetch reverting it; a rapid neutral->prefer->avoid->neutral cycle ends in
  the expected state.
- A failed mutation rolls the cell back and surfaces the inline error.
- Preferred/avoid cells render the token fill with no `Prefer`/`Avoid` text,
  while the `aria-label` still includes the level word.
- The legend renders both `Prefer` and `Avoid` entries.
- The day selector hides/shows day columns without changing the underlying
  assignment/preference data.
- The extend toggle widens the grid and makes its container horizontally
  scrollable without horizontally scrolling the page.
- `TopNav` renders `Preferences` as the last nav link.
- Existing timetable drag/drop (or the click-scheduling equivalent) still passes
  in extended mode.

## Verification checklist

- Selecting a lecturer displays their name in the selector trigger.
- Preference cell clicks are instant, stable, and persist without the backend
  re-driving the grid; no per-click refetch reverts the UI.
- Preference cells have no in-cell text and render as rounded coloured chips.
- A Prefer/Avoid legend is present near the preferences grid.
- Cell `aria-label`s still convey the level (not colour alone) using human
  day/time/room-name labels.
- Room header text is smaller in both grids and still truncates.
- The extend control widens both grids and adds horizontal scroll to the grid
  container only (page does not scroll horizontally).
- The particular-days selector filters visible days in both grids without
  altering saved data; the solver/validation are unaffected.
- Timetable drag/drop, hover highlighting, and blocks still work in extended and
  day-filtered views.
- `Preferences` is the right-most nav tab.
- `ui-context.md`, Unit 100 spec note, and `progress-tracker.md` are updated.
- Frontend tests and build pass.
