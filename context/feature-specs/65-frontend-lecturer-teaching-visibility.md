# Unit 65 Spec: Frontend Lecturer Teaching Visibility

## Goal

Show which units each lecturer teaches without allowing the teaching relationship to be edited from the lecturer modal. Teaching assignments remain owned by the unit modal.

## Design

- Keep this unit inside `frontend/`.
- Do not change backend APIs in this unit.
- Do not add lecturer-side teaching assignment editing.
- Lecturer page display is read-only for taught units.
- Units page remains the edit source for teaching lecturers.
- Unit code/name should be shown for lecturer teaching visibility.

## Implementation

### Lecturer table

Update `/lecturers` table:

- Add a column or compact display for taught units.
- Show unit code and optionally unit name.
- Use concise formatting:
  - `No units assigned` for none.
  - Chips/badges for a small number.
  - Truncated text or count + tooltip/popover if many.
- Keep table readable and compact.

### Lecturer create/edit modal

- Do not add editable unit fields.
- Optionally show a read-only summary of taught units in edit mode.
- Include helper text: `Teaching assignments are managed from Units.`
- Do not submit any unit IDs from the lecturer modal.

### Units page display

Ensure `/units` table and modal show teaching lecturers clearly:

- Unit table should list selected lecturers or a count with names.
- Unit modal remains the only editing place for `lecturer_ids`.

### Query invalidation

When unit teaching teams are changed in Unit 63, lecturer list should be invalidated/refetched so this page stays up to date.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Lecturer table shows units taught by code/name.
- Lecturer with no units has a clear empty teaching state.
- Lecturer create/edit modal does not allow unit assignment changes.
- Unit teaching changes made from `/units` appear on `/lecturers` after refetch.
- No mutation from lecturer page sends unit IDs.
- UI remains compact and token-styled.
- Frontend tests cover read-only display and absence of edit controls.
