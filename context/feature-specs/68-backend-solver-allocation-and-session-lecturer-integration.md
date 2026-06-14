# Unit 68 Spec: Backend Solver Allocation and Session-Lecturer Integration

## Goal

Update backend constraint mirror, solver snapshot building, and CP-SAT modeling to use session-level lecturers and hidden session-student allocation data. The solver should match the new frontend validation model while still running only from saved backend state.

## Design

- Keep this unit inside `backend/constraints/` and `backend/solver/`.
- Do not change frontend UI in this unit.
- Do not change Trigger.dev job orchestration unless imports/types require it.
- Solver input must still be compiled from canonical database state.
- Solver code must not query the database directly.
- Session-level lecturer is authoritative.
- Allocated session students are authoritative for student conflicts and room capacity.
- Unit/session-overlap conflict graph should be retired as an active solver constraint unless retained only for compatibility with old tests/types.
- Solver objective remains simple: maximize scheduled unscheduled sessions.
- No soft constraints.

## Implementation

### Constraint types and graph

Update backend constraint mirror:

- Lecturer overlap edges use `session.lecturer_id`.
- Student overlap edges use allocation-derived `student_ids` per session.
- Unit/session overlap is no longer generated as a separate edge category for active scheduling.
- Keep room, capacity, off-timetable, lunch, and availability checks.
- If `ConstraintType.UNIT_SESSION_OVERLAP` remains for backward compatibility, mark it unused/deprecated and ensure it is not generated from normal post-v1 data.

### Snapshot types

Update `SessionSnapshot` or equivalent:

- Include `lecturer_id` from `Session.lecturer_id`.
- Include `student_ids` from `session_student_allocations`.
- Include `student_count` derived from allocation count.
- Include `unit_year_level` if needed for future output/filtering.

### Snapshot builder

Update `build_solver_input_snapshot(db)`:

- Load sessions with session-level lecturers.
- Load allocation rows efficiently.
- Exclude or reject sessions without `lecturer_id` from solver variables according to existing schedulable behavior.
- Build conflict pairs from:
  - session lecturer overlap;
  - allocated student overlap.
- Do not infer all unit students attend every tutorial.
- Validate locked assignments using allocation-derived capacity.

### Solver model

Update `solve_timetable(snapshot, ...)` as needed:

- Use session-level lecturer availability.
- Use allocation-derived conflict pairs.
- Keep locked scheduled sessions fixed.
- Keep room capacity candidate filtering based on `student_count`.
- Keep partial result behavior.
- Keep deterministic settings.

### Result application

Update result application defensive checks:

- Capacity check uses allocation count.
- Lecturer/student conflict checks remain solver-start/snapshot concerns, not assignment save rejection unless already implemented defensively elsewhere.
- Existing saved assignments remain preserved on failed solver runs.

### Tests

Add/update backend tests for:

- two sessions in the same unit with different session lecturers do not lecturer-conflict;
- two sessions with the same session lecturer conflict;
- tutorials with disjoint allocated students do not student-conflict;
- lecture and tutorial sharing allocated students conflict;
- room capacity uses tutorial allocation size, not full unit enrollment;
- solver can overlap tutorial sessions with disjoint students and different lecturers/rooms where room constraints allow;
- solver respects lecturer availability for session lecturer;
- locked assignments are validated against allocation-derived capacity.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Constraint graph uses session-level lecturer IDs.
- Constraint graph uses allocation-derived student IDs.
- Unit/session overlap is not generated as an active conflict.
- Snapshot builder loads allocation data deterministically.
- Snapshot builder excludes/rejects sessions without lecturers according to schedulability rules.
- Solver room capacity uses allocation count.
- Solver lecturer availability uses session-level lecturer.
- Solver student conflicts use allocation intersections.
- Partial result behavior is unchanged.
- Failed solver runs preserve existing saved state.
- Backend tests cover allocation-based solver behavior and remain deterministic.
