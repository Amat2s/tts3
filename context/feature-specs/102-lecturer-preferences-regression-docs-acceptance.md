# Unit 102 Spec: Lecturer Preferences Regression, Docs, and Acceptance Pass

## Goal

Verify the full lecturer preferences batch and update docs/progress so the implemented behavior, including the new soft-constraint capability, is accurately recorded. This unit is verification and documentation only unless defects from Units 98-101 are found.

## Design

- Full-app regression pass.
- Do not add new feature behavior unless fixing a defect.
- Confirm preferences did not introduce:
  - fake sessions;
  - hard-constraint behavior (preferences must never block placement or reduce solver feasibility);
  - a dirty-draft/save step on `/preferences`;
  - regressions to availability or timetable-block hard-constraint behavior.

## Implementation

### Documentation updates

Update:

- `progress-tracker.md`
  - Units 98-101 completion notes;
  - Unit 102 final evidence;
  - remaining follow-ups.
- `project-overview.md`
  - add the `/preferences` tab to the core user flow and navbar list;
  - add a Lecturer Preferences feature section (soft constraint, room-specific, preferred/avoid);
  - move "soft constraints" and "preference optimization" out of Out of Scope, scoped specifically to lecturer scheduling preferences (other soft constraints, such as similarity-to-last-save, remain out of scope unless separately specced).
- `architecture-context.md`
  - `LecturerPreference` storage model;
  - solver snapshot's `preferences` field and secondary objective term.
- `code-standards.md`
  - update the "do not introduce soft constraints into the v1 solver model" line to reflect the lecturer preference exception;
  - module locations for preference schemas/services/API.
- `ui-context.md`
  - final preference tokens.

### Regression coverage

Backend tests should cover:

- model/schema validation for preference cells;
- upsert overwrite and delete-to-neutral behavior;
- no cross-validation against availability/blocks/sessions;
- snapshot preference loading;
- solver preferring `preferred` and avoiding `avoid` without reducing scheduled count;
- solver behavior unchanged when no preferences exist.

Frontend tests should cover:

- preference API client;
- `/preferences` route and navbar entry;
- grid renders with no sessions;
- lecturer selector loads and switches cleanly;
- cell click cycle (neutral -> preferred -> avoid -> neutral) and immediate persistence;
- preferred/avoid colour rendering.

### Manual acceptance checklist

Create a checklist covering:

1. Sign in and open `/preferences` from the navbar.
2. Confirm the grid matches the real timetable's day/room/slot layout with no sessions.
3. Select a lecturer and confirm their existing preferences (if any) highlight correctly.
4. Click a neutral cell and confirm it becomes `preferred`.
5. Click again and confirm it becomes `avoid`.
6. Click again and confirm it returns to neutral.
7. Refresh the page and confirm saved preferences persist without an explicit save action.
8. Switch to a different lecturer and confirm only their own cells are highlighted.
9. Run the solver and confirm it still schedules the maximum possible sessions.
10. Confirm the solver favors `preferred` cells and avoids `avoid` cells when it doesn't cost scheduled sessions.

### Final evidence

Record:

- backend test result;
- frontend test result;
- frontend production build result;
- backend import smoke where practical;
- Alembic current/head after the Unit 98 migration;
- any manual checklist items still pending.

## Dependencies

Units 98-101.

No new dependencies expected.

## Verification checklist

- Backend tests pass.
- Frontend tests pass.
- Frontend build passes.
- Context docs updated, including the soft-constraint scope change.
- Progress tracker updated.
- Manual checklist exists.
- Preferences remain a soft constraint only.
- Existing availability, block, and scheduling behavior is not regressed.
