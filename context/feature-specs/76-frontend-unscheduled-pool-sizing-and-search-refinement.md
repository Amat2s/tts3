# Unit 76 Spec: Frontend Unscheduled Pool Sizing and Search Refinement

## Goal

Refine the unscheduled sessions pool layout and search behavior without changing scheduling functionality. Unit boxes should have consistent fixed widths and wrap across the page, and search should only match unit code/name and unit teaching-team lecturers.

## Design

- Keep this unit inside `frontend/`.
- Do not change backend APIs.
- Do not change drag/drop scheduling behavior.
- Do not change solver behavior.
- Unscheduled unit boxes should have fixed width, but height may grow based on the number of sessions inside.
- All unit boxes in the pool should have the same width.
- Unit boxes should wrap/fill across the available page width.
- Type/session-kind search is removed.
- Search matches only:
  - unit code;
  - unit name;
  - unit teaching team lecturer names.
- Search should not match `Lecture`/`Tutorial` type text.

## Implementation

### Unit box layout

Update the unscheduled pool container:

- Use a wrapping layout, for example CSS grid with `auto-fill`/`minmax` or flex-wrap.
- Ensure every unit box has equal width.
- Recommended fixed range:
  - preferred width around `17rem`–`20rem`;
  - allow minor responsive adjustment through `minmax` but keep boxes visually equal.
- Do not make unit boxes full row width.
- Do not use horizontal scrolling unless the viewport is too narrow.
- Height should grow naturally as session cards stack.
- Unit boxes with no sessions should not render.

### Session cards inside unit boxes

Preserve current session-card functionality:

- Cards remain draggable.
- Cards still show necessary session information.
- Cards no longer need to repeat full unit code/name if the unit box header already displays it.
- Keep enough information to distinguish lecture/tutorial, duration, lecturer, and student count.
- Preserve selected/dragging/disabled states.

### Search behavior

Update unscheduled pool search:

- Remove type from the searchable text index.
- Search unit code and unit name.
- Search unit teaching team names, not just the session lecturer.
- If teaching-team data is not directly available on the session DTO, derive it from loaded units or add the required frontend query in an earlier/integrated step.
- Keep matching case-insensitive.
- Do not filter by session type.

### Existing filters

Preserve existing year-level filter from the previous batch:

- Year filter remains parser-derived where relevant.
- Search and year filter compose.
- Empty-state copy should distinguish:
  - no schedulable sessions exist;
  - filters hide all sessions;
  - all sessions are scheduled.

### Tests

Add/update tests for:

- unit boxes render with equal-width class/style treatment;
- empty unit boxes are hidden;
- search matches unit code;
- search matches unit name;
- search matches teaching-team lecturer name;
- search does not match session type;
- scheduling/selection callbacks still work from inside the redesigned pool.

## Dependencies

No new dependencies expected.

## Verification checklist

- Unit boxes are equal width and wrap across the page.
- Unit box height grows with session count.
- Session cards remain draggable/selectable.
- Session type is not searchable.
- Unit code/name are searchable.
- Unit teaching team is searchable.
- Year filter still works.
- Empty states are correct for filtered/all-scheduled conditions.
- Frontend build and tests pass.
