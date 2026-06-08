# Unit 38 Spec: Backend Constraint Evaluation Service

## Goal

Add backend hard constraint evaluation for the current timetable state. The result should let backend code produce structured violations for invalid scheduled assignments without exposing an API route yet.

## Design

- Keep this unit inside `backend/constraints/`.
- Use the constraint definitions and conflict graph from Unit 37.
- Evaluate persisted timetable state through backend service logic.
- Return structured violation objects.
- Do not add frontend behavior yet.
- Do not add API routes yet.
- Do not add solver behavior yet.
- Invalid placements should be reported, not silently corrected.
- Unscheduled sessions are not constraint violations.

## Implementation

Create a constraint evaluation service that can check scheduled assignments for:

- lecturer conflicts;
- student conflicts;
- room conflicts;
- room capacity failures;
- lecturer availability conflicts;
- duration boundary failures;
- lunch crossing failures.

Use the fixed timetable model:

- Monday–Friday;
- slots `s1`–`s7`;
- session durations are integer slot spans.

Evaluation should use canonical backend data:

- sessions;
- units;
- lecturers;
- lecturer availability;
- students;
- rooms;
- assignments.

Return violations with enough detail for the frontend to display useful messages later.

Do not mutate timetable state during validation.

Do not treat sessions with no students as invalid.

Add focused tests or fixture checks for the required v1 hard constraints.

## Dependencies

No new package should be required.

This unit depends on:

- Unit 37 constraint definitions and conflict graph;
- existing backend persistence for rooms, lecturers, students, units, sessions, and assignments.

## Verification Checklist

- [ ] Constraint evaluation service exists.
- [ ] Lecturer overlap violations are detected.
- [ ] Student overlap violations are detected.
- [ ] Room double-booking violations are detected.
- [ ] Room capacity violations are detected.
- [ ] Lecturer unavailable-slot violations are detected.
- [ ] Duration boundary violations are detected.
- [ ] Lunch crossing violations are detected.
- [ ] Unscheduled sessions are ignored by validation.
- [ ] Sessions without students are not treated as incomplete.
- [ ] Evaluation returns structured violation objects.
- [ ] Evaluation does not mutate assignments or sessions.
- [ ] Tests or fixture checks cover the main hard-constraint cases.
- [ ] No API route, frontend behavior, or solver behavior is added.
