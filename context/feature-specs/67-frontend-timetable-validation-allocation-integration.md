# Unit 67 Spec: Frontend Timetable Validation and Allocation Integration

## Goal

Update frontend timetable validation and assignment rendering data to use the new session-level lecturer and hidden session-student allocation data. Manual scheduling should continue to use frontend-owned validation, but conflicts and capacity should be judged against the actual students allocated to each session.

## Design

- Keep this unit inside `frontend/validation` and `frontend/features/timetable`.
- Do not redesign the unscheduled pool in this unit.
- Do not change backend solver behavior in this unit.
- Preserve blocking vs warning severities.
- Preserve explicit-save workflow.
- Preserve ability to save warning-invalid assignments.
- Use session-level `lecturer_id`, not lecturer display name, for lecturer overlap and availability matching.
- Use `allocated_student_ids` for student conflict warnings.
- Use `student_count` from allocation rows for room capacity blocking.
- Remove independent unit/session-overlap warning from active validation. Shared allocated students now determine overlap conflicts.

## Implementation

### Timetable assignment model

Update `TimetableAssignment` frontend model to include:

- `lecturer_id`
- `lecturer_display_name`
- `student_count`
- `allocated_student_ids: string[]`
- `unit_year_level: 1 | 2 | 3` if needed by filters later

Update conversion from assignment API response to draft assignment.

### Schedulable session placement

When placing from unscheduled pool into the draft:

- Build draft assignment using session-level lecturer fields from `SchedulableSession`.
- Copy `allocated_student_ids` and allocation-derived `student_count`.
- Do not infer students from unit membership in the frontend.

### Blocking validation

Update `checkProposedPlacement` and draft blocking validation:

- Room capacity uses `assignment.student_count`.
- Automatic unscheduling after data changes uses refreshed allocation-derived counts.
- Existing blocking rules remain unchanged:
  - room double-booking;
  - room capacity too small;
  - crossing lunch;
  - off timetable.

### Warning validation

Update warning engine:

- Lecturer overlap compares `lecturer_id`.
- Lecturer availability finds lecturer by `lecturer_id`.
- Student overlap compares intersections of `allocated_student_ids`.
- Remove or deactivate `unit_session_overlap` as an independent warning type.
- Keep warning objects structured and human-readable.
- Warning messages should not reveal hidden tutorial allocation groups; they can say sessions share enrolled/allocated students.

### Loaded warning-invalid assignments

Saved assignments may become warning-invalid after allocation data changes. On load/refetch:

- Recompute warnings from draft assignment data.
- Keep warning-invalid assignments visible.
- Continue blocking solver execution while warnings exist.

### Query invalidation expectations

After unit/student/session changes from earlier units, refetched schedulable sessions and assignments should supply updated allocation data.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Manual placement uses session-level lecturer ID/display data.
- Lecturer overlap warning fires for sessions with the same `lecturer_id` and overlapping times.
- Lecturer overlap does not fire merely because two sessions belong to units with the same teaching team.
- Lecturer availability warning uses session-level lecturer ID.
- Student conflict warning uses allocated student ID intersection.
- Two tutorials from the same unit can overlap when their allocation sets do not intersect.
- Lecture and tutorial from the same unit conflict only through shared allocated students.
- Room capacity uses allocation-derived `student_count`.
- Blocking auto-unschedule still works when allocation counts change.
- Solver gating remains false when any blocking or warning issue exists.
- Independent `unit_session_overlap` no longer creates false warnings.
- Frontend validation tests are updated for lecture/tutorial allocation cases.
