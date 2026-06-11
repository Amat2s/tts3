# Unit 39 Spec: Frontend Drag-and-Drop Save Integration

## Goal

Finalize the frontend/backend connection for drag/drop-edited timetable drafts. The admin should be able to drag sessions locally, review warnings, and explicitly save the resulting assignment set.

## Design

- Keep this unit in the frontend/backend connection boundary.
- Save sends the complete draft assignment set.
- Backend defensive rejections are handled as save errors, not as normal validation UX.
- Failed saves must not discard the frontend draft.

## Implementation

### Scope

Build:

- save state integration after drag/drop changes;
- save loading state;
- save success state;
- save failure state;
- refetch saved assignments after successful save;
- draft preservation after failed save;
- dirty-state reset after successful save.

### Save Errors

If the backend rejects a save because of a defensive invariant, show a clear save error and preserve the draft. The frontend validation engine should be checked for a missing blocking rule if this occurs during testing.

## Dependencies

Units 32 and 38.

## Verification Checklist

- [ ] Drag/drop changes mark the draft dirty.
- [ ] Save persists the drag/drop-edited draft.
- [ ] Successful save refetches saved assignments.
- [ ] Failed save preserves the draft.
- [ ] Backend defensive errors are visible as save errors.
