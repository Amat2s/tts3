# Unit 34 Spec: Frontend Manual Scheduling Controls

## Goal

Allow the admin to manually schedule, move, and unschedule sessions inside frontend draft state, without persisting every action immediately.

## Design

- Keep this unit inside `frontend/`.
- Use real schedulable sessions and real draft assignment state.
- No backend mutation should happen on placement, move, or unschedule.
- Save remains the only persistence action.
- Validation is introduced in the following units; this unit should keep structure ready for it.

## Implementation

### Scope

Build:

- select unscheduled session for placement;
- place selected session into a timetable cell in draft state;
- move scheduled session to another cell in draft state;
- remove scheduled session back to the unscheduled pool in draft state;
- derive unscheduled sessions from sessions not present in the draft assignment set;
- maintain unsaved-change state.

### Manual Controls

Provide non-drag controls first so scheduling remains accessible before drag-and-drop is introduced.

Possible controls:

- select a card from the unscheduled pool, then click a grid cell;
- action on scheduled card to unschedule;
- simple move interaction if already supported by the current rendering structure.

## Dependencies

Unit 33.

## Verification Checklist

- [ ] Admin can place an unscheduled session into draft state.
- [ ] Admin can move a scheduled draft assignment.
- [ ] Admin can unschedule a draft assignment.
- [ ] Unscheduled pool updates from draft state.
- [ ] No backend mutation occurs until save.
- [ ] Save button persists changes from Unit 33 behavior.
