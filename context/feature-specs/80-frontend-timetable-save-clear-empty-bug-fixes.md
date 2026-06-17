# Unit 80 Spec: Frontend Timetable Save, Clear, and Empty-Draft Bug Fixes

## Goal

Fix timetable save-state edge cases, especially saving an empty timetable draft, and polish save/clear behavior. The Save button should clearly show `Saved` when there are no unsaved changes, and draft-only Clear All should work correctly with local draft persistence.

## Design

- Keep this unit inside `frontend/`.
- Do not change backend assignment API unless an actual backend bug is found.
- Preserve explicit-save architecture.
- Clear All remains draft-only and requires confirmation.
- Saving an empty assignment set is valid and should persist an empty timetable.
- Save button text should reflect state:
  - dirty and idle: `Save Timetable`;
  - saving: `Saving…`;
  - clean: `Saved`.
- Solver button label changes are handled in Unit 81 unless already centralized.

## Implementation

### Empty draft save investigation

Audit the save path:

- `handleSave` should not return early solely because `draft.length === 0`.
- The save mutation should send `{ assignments: [] }` when the draft is empty and dirty.
- The save button should be enabled when the draft is dirty, even if the draft has zero assignments.
- The backend `saveAssignments` client should not reject empty arrays.
- Dirty state should distinguish clean empty saved timetable from dirty empty draft after Clear All.

Likely issue patterns to check:

- `if (!draft.length) return;`
- disabled button tied to `draft.length > 0` instead of `isDirty`;
- mutation payload builder dropping empty arrays;
- stored draft restore treating empty assignment list as absent.

### Save state labels

Update `TimetableActionBar` save button:

- Clean: disabled or neutral button labelled `Saved`.
- Dirty: primary/active button labelled `Save Timetable`.
- Saving: spinner and `Saving…`.
- Save error: keep the draft visible and show error in sticky bar.
- After successful save and refetch, label becomes `Saved`.

### Clear All behavior

Ensure existing Clear All behavior remains draft-only:

- Requires warning confirmation dialog.
- Clears all draft assignments.
- Marks `isDirty = true` if saved assignments or current draft were non-empty.
- Persists empty dirty draft to local storage from Unit 79.
- Does not call backend immediately.
- User must click Save Timetable to persist empty assignment set.
- After successful save, stored draft is cleared and button shows `Saved`.

### Interaction with solver gate

Ensure solver gate remains correct:

- If Clear All creates unsaved changes, solver is blocked because solver runs from saved state.
- After empty draft is saved successfully, solver may run only if other rules allow it.
- Empty timetable itself should not be treated as a validation issue.

### Tests

Add/update frontend tests for:

- Clear All makes an empty dirty draft;
- Save button enabled after Clear All;
- saving empty draft calls `saveAssignments({ assignments: [] })`;
- successful empty save resets dirty state;
- button shows `Saved` when clean;
- button shows `Save Timetable` when dirty;
- empty dirty draft survives local storage restore from Unit 79;
- solver remains blocked while empty draft is dirty.

## Dependencies

No new dependencies expected.

## Verification checklist

- Empty timetable draft can be saved.
- Clear All is draft-only and confirmed.
- Clear All does not immediately call backend.
- Save button is enabled for dirty empty draft.
- Save request sends an empty assignments array.
- Successful empty save persists and resets dirty state.
- Save button shows `Saved` when clean.
- Save errors preserve the draft.
- Frontend tests and build pass.
