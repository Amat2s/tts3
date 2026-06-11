# Unit 33 Spec: Frontend Timetable Draft Assignment State

## Goal

Introduce a frontend draft assignment layer for timetable editing. The timetable should load saved assignments from the backend, initialize a local draft, track unsaved changes, and persist changes only through an explicit save button.

## Design

- Keep this unit inside `frontend/`.
- Saved assignments are server state and should be loaded with TanStack Query.
- The current editing draft is frontend UI/application state.
- Manual scheduling must not persist automatically.
- Add a visible save button to the timetable action bar.

## Implementation

### Scope

Build:

- saved assignment query on `/timetable`;
- draft assignment initialization from saved assignments;
- dirty/clean state tracking;
- save timetable button;
- save mutation using the assignment API client;
- save loading, success, and error states;
- reset/refetch behavior after successful save.

### Draft State

The draft assignment set should be the source used for scheduled-session rendering while editing. It should be initialized from saved backend assignments and remain separate until the admin saves.

The unscheduled pool should eventually derive from sessions not present in the draft assignment set, but full manual scheduling behavior is introduced in the next unit.

### Save Behavior

The save button sends the complete draft assignment set to the backend. On success, refetch saved assignments and mark the draft clean.

If save fails, preserve the current draft and show an actionable save error.

## Dependencies

Unit 32.

## Verification Checklist

- [ ] Timetable loads saved assignments.
- [ ] Timetable initializes a draft assignment set.
- [ ] Scheduled cards render from draft assignments.
- [ ] Save button exists in the timetable action bar.
- [ ] Save persists the full draft assignment set.
- [ ] Unsaved changes are visible.
- [ ] Failed save does not discard the draft.
