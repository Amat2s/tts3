# Unit 77 Spec: Frontend Sticky Timetable Action Bar and Validation Message Consolidation

## Goal

Consolidate all timetable feedback into one sticky action/notification bar that does not shift the page when validation, save, solver, or details messages change. The details extension should open as an overlay/dropdown above the timetable, and user-facing messages should show human time labels instead of raw slot IDs.

## Design

- Keep this unit inside `frontend/`.
- Do not change validation rules.
- Do not change solver behavior.
- Do not change backend APIs.
- The timetable page should have one sticky bar responsible for:
  - save state;
  - solver action/state;
  - blocking placement messages after failed drop/place;
  - warning summary;
  - validation details;
  - solver status/failure/partial/success messages where currently displayed near the timetable.
- No separate message panel should appear outside the bar and push the timetable down.
- Details should open as an anchored overlay/dropdown from the sticky bar.
- Slot IDs such as `s4` must be replaced by human labels such as `1:30-2:20` in all validation messages displayed to users.

## Implementation

### Sticky bar layout

Refactor `TimetableActionBar` and related status components:

- Use `position: sticky` near the top of the timetable workspace.
- Choose a top offset that sits below the navbar.
- Give it a stable min-height so normal state changes do not resize surrounding layout dramatically.
- Keep it visually connected to the timetable canvas.
- Use `z-index` high enough to stay above the grid but below modal/dialog overlays.
- Keep token-based background, border, and shadow.

### Single message surface

Move all current timetable status surfaces into the action bar:

- save errors;
- blocking placement errors after failed attempts;
- warning summary;
- solver blocked reason;
- solver running state;
- solver success/partial/failure state;
- solver status polling error;
- assignment-load error if it is currently shown above the canvas.

If a severe assignment-load error means the timetable cannot safely render, keep the error inside the bar and disable interactions rather than rendering a separate full-width panel that shifts the page.

### Details overlay

Replace the current expanding detail panel with an overlay/dropdown:

- Trigger remains something like `View details` / `Hide details`.
- Overlay is anchored to the bar.
- Overlay opens over the timetable area without adding layout height.
- Include blocking and warning details grouped by severity.
- Keep icons for non-colour-only status.
- Allow dismissal by clicking the trigger again and by normal focus/escape behavior where practical.
- Do not use hover-only disclosure.

### Slot label messages

Update validation display helpers:

- Use Unit 73 slot label utility for any visible message containing slot IDs.
- Replace raw slot IDs in:
  - blocking placement messages;
  - warning details;
  - automatic unschedule messages if shown;
  - solver-disabled messages if they include slots;
  - tests/snapshots.
- Internal issue objects may continue using slot IDs.
- User-facing strings must use display labels.

### Message priority

Define a deterministic priority order inside the bar:

1. assignment-load/save system error;
2. solver running/status error;
3. blocking placement failure after attempted drop/place;
4. blocking validation summary;
5. warning validation summary;
6. unsaved changes / saved state;
7. neutral ready state.

The visible message should be concise, with details available in the overlay where relevant.

### Tests

Add/update tests for:

- action bar stays rendered as one surface;
- warning/details opening does not insert a layout panel below the bar;
- details overlay contains blocking/warning messages;
- user-facing messages show time labels, not slot IDs;
- solver and save states render inside the bar;
- bar disables solver with explanation when relevant.

## Dependencies

No new dependencies expected. If a popover/dropdown primitive is needed, add it through the shadcn CLI rather than editing protected UI primitives.

## Verification checklist

- Timetable feedback appears in one sticky bar.
- No separate validation textbox pushes the page down.
- Details open as an overlay/dropdown above the timetable.
- Raw slot IDs do not appear in user-facing validation text.
- Blocking/warning details remain accessible.
- Save/solver statuses remain visible and actionable.
- Existing validation behavior is unchanged.
- Frontend build and tests pass.
