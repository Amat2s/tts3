# Unit 63 Spec: Frontend Unit and Session Management Redesign

## Goal

Update the `/units` page to manage derived year levels, multiple teaching lecturers, student selection by year, and session-level lecturer assignment. The modal should be wider and remain the only place where unit teaching assignments are edited.

## Design

- Keep this unit inside `frontend/`.
- Do not change backend APIs in this unit.
- Do not change solver behavior in this unit.
- Keep sessions as inline boxes inside the unit edit flow, not separate session dialogs.
- The unit modal should be wider to handle teaching team, student selection, and session fields comfortably.
- Unit year level is displayed as derived from unit code; it is not a manually editable field.
- Student selection should auto-select all current students in the derived year by default, but the admin can manually add/remove students before saving.
- Multiple lecturers can be selected for a unit teaching team.
- Each session must have one lecturer selected from the unit teaching team.
- If a unit has exactly one lecturer, new sessions automatically use that lecturer.
- Duration remains an integer 1–4 internally but is labeled as hours in the UI.
- Session types are only Lecture and Tutorial.

## Implementation

### Modal layout

Update the create/edit unit dialog:

- Increase width, for example `max-w-4xl` or `max-w-5xl`, using existing dialog patterns and token-based styling.
- Consider a two-column layout inside the modal:
  - left/main: unit identity and teaching team;
  - right/secondary: student selection and session list.
- Keep mobile behavior reasonable; stack columns on narrow screens if needed.
- Do not modify protected shadcn `components/ui/*` primitives.

### Unit code and derived year display

Add a frontend helper mirroring backend parsing:

- Parse first digit in code.
- If it is 1, 2, or 3, show `Year 1`, `Year 2`, or `Year 3`.
- If invalid or missing, show an inline validation message and prevent create/save.
- The helper is for UX only; backend remains authoritative.

### Student selector in unit modal

Update unit create/edit form state:

- `student_ids: string[]` remains the persisted relationship.
- Add a student search input inside the selector area.
- Add a year-level filter inside the selector area.
- On create, when a valid unit code/year is first available, default-select all students whose `year_level` matches the parsed year.
- Preserve manual selection changes after the admin toggles students.
- If the admin changes code before saving, offer predictable behavior:
  - either reset default selection only if the student list has not been manually changed;
  - or provide an explicit `Select all Year X students` action.
- Prefer the first behavior plus a small secondary action for clarity.

### Lecturer teaching-team selector

Update unit create/edit form state:

- Replace `lecturer_id` with `lecturer_ids: string[]`.
- Use a multi-select or checkbox list of lecturers.
- Display selected count.
- Require at least one lecturer before saving.
- Show selected teaching lecturers in the unit table row.
- Invalidating queries after save should refresh:
  - `['units']`
  - `['lecturers']`
  - `['schedulable-sessions']`
  - `['assignments']` when relevant.

### Session panel updates

Update inline session boxes inside the edit modal:

- Session type selector only includes:
  - Lecture
  - Tutorial
- Remove Lab and Workshop UI options.
- Add lecturer selector per session.
- The session lecturer selector options are restricted to the unit's selected teaching lecturers.
- If the unit has exactly one teaching lecturer, default new sessions to that lecturer.
- If the teaching team changes and a session's selected lecturer is no longer valid, show a clear inline error and require reassignment before saving/removing that lecturer.
- Keep add/delete behavior inline.

### Duration stepper

Replace duration dropdown with a small stepper control:

- Minus button.
- Number display/input.
- Plus button.
- Min = 1.
- Max = 4.
- Label text uses `hour`/`hours`.
- Persist the same integer duration field as before.
- Do not change backend duration semantics.

### Error and loading states

- Keep existing mutation loading states.
- Show unit-code parser errors inline before submit.
- Show backend errors in the modal if save fails.
- Do not swallow errors from session create/update/delete.

## Dependencies

No new package dependencies expected unless a current shadcn component is missing. If a common primitive is needed, add it through the shadcn CLI rather than editing `components/ui/*`.

## Verification checklist

- Unit modal is visibly wider and remains token-styled.
- Unit year level is displayed from code and is not editable directly.
- Invalid unit codes are blocked client-side and still rejected backend-side.
- Creating a unit defaults selected students to the parsed year level.
- Admin can manually add/remove students after the default selection.
- Student selector search works inside the modal.
- Student selector year filter works inside the modal.
- Unit teaching team supports multiple lecturers.
- Unit cannot be saved without at least one teaching lecturer.
- New sessions default to the only teaching lecturer when there is exactly one.
- Session lecturer selector only shows the unit teaching team.
- Session cannot be made schedulable without a valid session lecturer.
- Session type UI only shows Lecture/Tutorial.
- Duration stepper persists 1–4 integer values while displaying hours.
- Unit/session mutations invalidate dependent queries.
- Frontend build succeeds and relevant unit-page tests are updated.
