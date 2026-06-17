# Unit 81 Spec: Frontend Timetable Visual Styling and Navbar Polish

## Goal

Polish the timetable workspace visuals and navbar branding without changing scheduling behavior. The timetable grid should have darker borders, the lunch row should become a red/gold `Lunch/Mass` divider using new tokens, the timetable page should remove unnecessary headers, the navbar brand should read `Campion - Timetable`, and the solver action should remain blue with the label `Generate Timetable`.

## Design

- Keep this unit inside `frontend/`, with `ui-context.md`/global CSS token updates where needed.
- Do not change scheduling, validation, solver, or persistence logic.
- All styling must use tokens or Tailwind theme values.
- Add new lunch/mass tokens rather than reusing error colours.
- Navbar brand typography intentionally uses the title font as an exception to the normal nav typography rule.
- Remove timetable page headers/descriptions between navbar and sticky display/action bar.
- Management pages keep their normal headers unless separately changed.

## Implementation

### Timetable border tokens

Update timetable grid styling:

- Make grid borders visually darker/clearer while preserving the light academic theme.
- Prefer token updates or new tokens instead of repeated arbitrary classes.
- Suggested additions or updates:
  - `--grid-line`
  - `--grid-line-strong`
  - optional `--grid-border-emphasis`
- Ensure empty, hover, selected, warning, dragging, and solver-running states remain readable.

### Lunch/Mass row tokens

Add new tokens to `ui-context.md` and global CSS:

- `--grid-lunch-mass-bg`
- `--grid-lunch-mass-text`
- optional `--grid-lunch-mass-border`

Suggested values harmonious with the existing palette:

- `--grid-lunch-mass-bg: #7A1F2B`
- `--grid-lunch-mass-text: #F7F0D8`
- `--grid-lunch-mass-border: #C9A646`

Update the lunch divider:

- Label text becomes exactly `Lunch/Mass`.
- Use the new tokens.
- Keep label non-interactive.
- Keep right-click/text-selection behavior consistent with existing headers.

### Timetable page header removal

Update `/timetable` route layout:

- Remove page title and description between navbar and action bar.
- The sticky action bar should be the first major element below the navbar.
- Do not remove headings from `/rooms`, `/lecturers`, `/students`, or `/units`.
- Preserve accessibility where practical; if removing visible H1, consider an `sr-only` page heading.

### Navbar brand text

Update top nav brand:

- Text: `Campion - Timetable`.
- Font: title/serif font token.
- Weight: bold.
- Colour: same current brand colour.
- Keep left-corner placement.
- Ensure nav links remain centered and layout does not break.

### Solver button label/style

Update solver action:

- Label idle state: `Generate Timetable`.
- Running state can remain `Solving…` or `Generating…`; prefer `Generating…` for label consistency.
- Button remains blue/solver-accent even when enabled.
- Disabled state should still clearly look disabled while preserving the solver accent identity where possible.
- Keep disabled reason in title/status text.

### Tests

Add/update tests for:

- timetable page no longer renders visible page header/description;
- lunch row displays `Lunch/Mass`;
- navbar brand displays `Campion - Timetable`;
- solver button displays `Generate Timetable` when idle;
- save/solver visual state snapshots do not rely on hardcoded colours.

## Dependencies

No new dependencies expected.

## Verification checklist

- Timetable borders are darker and still token-based.
- Lunch row says `Lunch/Mass`.
- Lunch/Mass row uses new tokens.
- Timetable page visible header/description is removed.
- Other management page headers remain.
- Navbar brand says `Campion - Timetable`.
- Navbar brand uses title font, bold weight, and current brand colour.
- Solver button says `Generate Timetable` and remains blue/solver-accent.
- Frontend tests and build pass.
