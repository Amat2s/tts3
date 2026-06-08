# Unit 37 Spec: Backend Constraint Definitions and Conflict Graph

## Goal

Add the backend foundation for hard constraint definitions and conflict graph generation. The result should give the backend a centralized, typed way to describe constraint rules and derive session conflicts from real timetable data.

## Design

- Keep this unit inside `backend/constraints/`.
- Build constraint definitions and conflict graph logic only.
- Do not evaluate timetable placements yet.
- Do not add API routes yet.
- Do not add solver behavior yet.
- Constraint definitions must remain hardcoded and developer-defined for v1.
- Students are optional in v1 and sessions without students should not create student-conflict edges.
- Use real domain shapes from rooms, lecturers, students, units, sessions, and assignments.

## Implementation

Create centralized constraint types for v1 hard constraints:

- lecturer conflict;
- student conflict;
- room conflict;
- room capacity;
- lecturer availability;
- duration boundary;
- lunch crossing.

Create typed violation-related structures for later units, including:

- violation type;
- severity;
- affected session ids;
- affected room id where relevant;
- affected lecturer id where relevant;
- affected student ids where relevant;
- human-readable message.

Create deterministic conflict graph helpers that derive:

- lecturer overlap conflicts between sessions sharing a lecturer;
- student overlap conflicts between sessions sharing one or more students.

The conflict graph should be independent of FastAPI route handlers, React code, and database session objects.

Use pure functions where practical.

Add small backend tests or fixtures using real-format data.

## Dependencies

No new package should be required.

This unit depends on existing backend models for:

- lecturers;
- students;
- units;
- sessions;
- assignments.

## Verification Checklist

- [ ] Constraint type definitions exist in a centralized backend constraints module.
- [ ] Violation shape/type definitions exist for later evaluation.
- [ ] Conflict graph generation handles lecturer conflicts.
- [ ] Conflict graph generation handles student conflicts.
- [ ] Sessions without students do not create student-conflict edges.
- [ ] Conflict graph output is deterministic.
- [ ] Constraint code does not query the database directly.
- [ ] Constraint code is independent of API routes and solver code.
- [ ] Tests or fixture checks cover lecturer and student conflict graph cases.
- [ ] No API route, solver behavior, or frontend behavior is added.
