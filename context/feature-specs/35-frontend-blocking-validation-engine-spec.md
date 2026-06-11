# Unit 35 Spec: Frontend Blocking Validation Engine

## Goal

Add frontend validation for impossible placements that must be blocked before they enter the timetable draft. These rules are user-facing and should run immediately during manual scheduling.

## Design

- Keep validation logic in frontend modules, not React rendering components.
- Use pure helper functions where practical.
- Use the severity name `blocking`.
- Blocking issues reject proposed placement and prevent the assignment from entering the draft.
- Data changes that create blocking issues for existing assignments should automatically unschedule affected sessions.

## Implementation

### Scope

Build frontend validation helpers for:

- proposed placement checks;
- full draft blocking checks;
- automatic unscheduling after data changes;
- structured blocking issue objects.

### Blocking Rules

The blocking rules are:

- room duplication / room double-booking;
- room capacity too small;
- session crossing lunch;
- session running off the timetable.

### Issue Shape

Each issue should include:

- issue type;
- severity: `blocking`;
- affected session ids;
- affected room id when relevant;
- affected day and slot when relevant;
- human-readable message.

### Automatic Unscheduling

When room, session, unit, student, or lecturer data changes, the frontend should re-check existing draft/saved assignments. Any assignment that now violates a blocking rule should be removed from the scheduled draft and returned to the unscheduled pool.

## Dependencies

Unit 34.

## Verification Checklist

- [ ] Room double-booking blocks placement.
- [ ] Insufficient room capacity blocks placement.
- [ ] Lunch crossing blocks placement.
- [ ] Off-timetable placement blocks placement.
- [ ] Blocking issue objects are structured.
- [ ] Data changes can automatically unschedule blocking-invalid assignments.
- [ ] No warning rules have been added in this unit.
