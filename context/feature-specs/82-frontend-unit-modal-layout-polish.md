# Unit 82 Spec: Frontend Unit Modal Layout Polish

## Goal

Clean up the unit create/edit modal layout for the richer post-v1 unit model. The modal should use a two-column structure with unit identity, teaching team, and students on one side, and sessions on the other side. Both the create and edit modals support live session management in the sessions column, and student selection should include a clear-all action beside the select-year-students action.

## Design

- Keep this unit inside `frontend/`.
- Do not change backend APIs.
- Do not change unit/session persistence behavior.
- Do not add separate session dialogs.
- Apply the same two-column layout to both create and edit modals.
- Both the create and edit modals' sessions column should show live session management on the right side.
- When no sessions have been added yet, the sessions column shows a `No sessions yet` style empty state with an add-session action.
- Keep modal wide enough for two columns.
- Stack columns on narrow screens.
- Do not modify protected shadcn UI primitives.

## Implementation

### Modal structure

Refactor the unit modal content into clear sections:

Left column:

- Unit Code.
- Parser feedback from Unit 74.
- Unit Name.
- Teaching Team selector.
- Students selector.

Right column:

- Sessions heading.
- Both modes: inline session management (add/edit/remove sessions, session type, per-session lecturer from the teaching team, and duration).
- When the unit has no sessions yet, show a `No sessions yet` empty state with an add-session action.
- Create mode persists the added sessions after the unit is created, exactly as before this layout change.

Suggested layout:

- desktop: two-column grid, roughly `minmax(0, 1fr) minmax(22rem, 28rem)`;
- mobile/narrow: single column stack;
- modal width around `max-w-5xl` where consistent with existing style.

### Students selector actions

Update the student selector action row:

- Add `Select Year X Students` action based on parsed unit year.
- Add `Clear All` action on the same line.
- `Clear All` clears selected students only.
- It must not clear teaching team, sessions, or other form fields.
- Disable/select-year action when unit code year is invalid.
- Keep manual student toggles after using either action.

### Visual cleanup

Improve hierarchy without adding decoration:

- Use section headings.
- Use compact helper text.
- Keep spacing consistent with management pages.
- Use token-based borders/backgrounds.
- Avoid dense nested cards where possible.
- Keep action buttons aligned and predictable.

### Create modal behavior

In create mode:

- Sessions column shows live session management on the right side, exactly as before this layout change.
- Added sessions are held in form state and persisted after the unit is created on save.
- When no sessions have been added, the column shows a `No sessions yet` empty state with an add-session action.
- Create save remains disabled until required unit fields pass validation (including any added session having a valid teaching-team lecturer).
- No fake/persisted session records are created before the unit itself is saved.

### Edit modal behavior

In edit mode:

- Sessions column shows existing live session panel.
- Session lecturer/type/duration behavior from the post-v1 model remains unchanged.
- Changing the teaching team should continue to validate session lecturers as previously specified.

### Tests

Add/update tests for:

- create modal renders two conceptual columns;
- edit modal renders sessions on the sessions side;
- create modal supports adding sessions on the sessions side;
- the sessions column shows a no-sessions empty state until a session is added;
- clear-all clears selected students only;
- select-year-students still works;
- unit code parser feedback remains visible;
- modal remains usable with many students/lecturers/sessions.

## Dependencies

No new dependencies expected.

## Verification checklist

- Unit modal is wide and uses two-column structure.
- Unit code/name/teaching team/students are grouped together.
- Sessions are grouped on the other side.
- Create and edit modals both keep inline session management on the sessions side.
- The sessions column shows a no-sessions empty state until a session is added.
- Student `Clear All` clears only student selection.
- `Select Year X Students` remains available and parser-driven.
- Layout uses tokens and responsive behavior.
- Frontend build and tests pass.
