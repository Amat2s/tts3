# Unit 70 Spec: Frontend Timetable Action Polish

## Goal

Add the requested timetable interaction polish: draft-only Clear All with confirmation, sticky action/notification bar, `Saved` clean-state button text, and a blue `Generate Timetable` solver button.

## Design

- Keep this unit inside `frontend/features/timetable` and the timetable route.
- Do not change backend APIs in this unit.
- Clear All affects only the frontend draft until the admin clicks Save.
- Clear All requires a warning confirmation dialog.
- The sticky notification/action bar should stay visible above the timetable without causing the whole page to jump when messages change.
- Solver button should always use solver-blue styling and label `Generate Timetable` when not actively solving.
- Save button should show `Saved` when the frontend draft is clean.
- Preserve all existing solver gating reasons and validation detail access.

## Implementation

### Clear All draft assignments

Add a `Clear all` button to `TimetableActionBar` or adjacent timetable controls.

Behavior:

- Disabled when there are no draft assignments or editing is disabled.
- Opens a confirmation dialog.
- Dialog copy should clearly say this clears the current timetable draft and must be saved to persist.
- Confirm action:
  - sets `draft` to `[]`;
  - sets `isDirty = true` if there were assignments;
  - clears pending session selection;
  - clears blocking placement error if relevant;
  - leaves backend assignments unchanged until Save.
- Cancel action leaves draft unchanged.

Do not call `clearAssignments()` from the API client in this unit.

### Sticky action/notification bar

Update timetable action/notification area:

- Use `position: sticky` with a top offset below the app nav.
- Add z-index and surface styling using tokens.
- Avoid hardcoded hex values.
- Keep the grid readable; do not overlay session cards in a way that hides the first row.
- Validation detail panel should not push the whole page down unexpectedly. Prefer a popover/dropdown overlay or reserve stable space if simpler.
- Keep accessible status announcements.

### Save button wording

Update save button states:

- Dirty and idle: `Save Timetable` or existing save label if desired.
- Saving: existing loading label/spinner.
- Clean/saved: `Saved`.
- Save button may be disabled while clean, but it should visibly communicate saved state.

### Solver button wording and styling

Update solver button:

- Idle label: `Generate Timetable`.
- Starting/running label can remain `Solving…` or `Generating…` with spinner.
- Use solver-blue tokens for enabled and disabled states.
- Disabled state must still explain why through visible status text and `title` attribute.
- Do not change solver start gating.

### Tests

Update frontend tests for:

- Clear All dialog opens and cancel preserves draft.
- Confirm clears draft and returns sessions to unscheduled pool.
- Clear All does not call backend clear API.
- Save persists cleared draft only when clicked.
- Clean state button shows `Saved`.
- Solver button label is `Generate Timetable`.
- Solver disabled reasons remain visible.
- Action bar has sticky class/style behavior where practical to assert.

## Dependencies

No new package dependencies expected. Use existing Dialog/Alert/Button primitives.

## Verification checklist

- Clear All button appears when timetable draft has assignments.
- Clear All is disabled while solver editing lock is active.
- Clear All confirmation warns before clearing.
- Confirming Clear All clears only frontend draft.
- Backend is unchanged until Save is clicked.
- Save after Clear All persists empty assignments.
- Save button shows `Saved` when clean.
- Solver button says `Generate Timetable` when idle.
- Solver button remains blue and still explains disabled states.
- Action/notification bar is sticky above the timetable.
- Validation detail display does not cause disruptive page movement.
- Frontend tests cover the new states.
