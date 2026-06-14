# Unit 60 Spec: Backend Session Types and Hidden Session-Student Allocations

## Goal

Reduce session types to Lecture and Tutorial, then introduce hidden persistent session-student allocations so lectures include all enrolled students and tutorials evenly divide enrolled students. Room capacity, student conflicts, frontend validation data, and solver input must eventually use these allocations instead of assuming all unit students attend every session.

## Design

- Keep this unit inside `backend/`.
- Do not change frontend UI in this unit.
- Do not change solver modeling in this unit; later units consume the new allocation data.
- `SessionType` values become only:
  - `lecture`
  - `tutorial`
- Add hidden table `session_student_allocations`.
- Allocations are system-owned and not user-editable.
- There is no API route for viewing or editing tutorial allocations.
- Lecture sessions allocate every student enrolled in the parent unit.
- Tutorial sessions allocate each enrolled unit student to exactly one tutorial session when at least one tutorial exists.
- Tutorial groups should be as even as possible.
- Tutorial allocation should be as stable as practical when enrolments or tutorial sessions change.
- Allocation refresh runs whenever student/session data relevant to enrolments changes.

## Implementation

### Migration

Create the next Alembic migration.

- Create `session_student_allocations` table:
  - `session_id` FK to `sessions.id`, cascade delete;
  - `student_id` FK to `students.id`, cascade delete;
  - `created_at` timestamp;
  - unique constraint on `(session_id, student_id)`;
  - indexes on `session_id` and `student_id`.
- Reduce the Postgres session type enum to `lecture` and `tutorial`.
- Existing `lab` and `workshop` sessions should be mapped to `tutorial` during migration unless the migration can prove none exist.
- Existing `lecture` and `tutorial` values remain unchanged.

### Models

Add `SessionStudentAllocation` model.

Update `Session`:

- Relationship to allocation rows.
- Session type enum limited to lecture/tutorial.

### Allocation service

Create a backend service module such as `backend/services/session_allocation.py`.

Core public function:

- `rebalance_unit_session_allocations(db, unit_id: str) -> None`

Behavior:

1. Load the unit's currently enrolled students from `unit_students`.
2. Load the unit's sessions split into lecture sessions and tutorial sessions.
3. For every lecture session:
   - ensure every enrolled student has an allocation row;
   - remove allocation rows for students no longer enrolled.
4. For tutorial sessions:
   - if there are no tutorial sessions, remove tutorial allocation rows for that unit;
   - otherwise ensure every enrolled student is allocated to exactly one tutorial session;
   - preserve existing valid tutorial allocations where they do not create imbalance beyond the target distribution;
   - move the smallest practical number of students to correct imbalance;
   - assign new students deterministically to the tutorial with the fewest students, using stable ordering by student ID/name and session ID.
5. Delete allocation rows for sessions that no longer exist through cascade, but also make service behavior robust if stale rows are found.

Do not use truly random allocation unless seeded deterministically. The user said random division, but stability is more important for repeated edits.

### Trigger points

Call `rebalance_unit_session_allocations` after successful mutations that affect unit/session membership:

- unit create/update when `student_ids` changes;
- unit delete is handled by cascade;
- student create after automatic year-level enrollment;
- student update if unit enrollment is changed in a later endpoint/request;
- student delete is handled by cascade plus affected units should be rebalanced when practical;
- session create;
- session update when `session_type` changes;
- session delete.

Use a transaction boundary that prevents partially updated allocations.

### Response shape changes

Update schedulable session responses and assignment responses to derive:

- `student_count` from allocation rows;
- optional hidden validation data for frontend later:
  - `allocated_student_ids: string[]`.

The UI must not display tutorial allocation membership. IDs are allowed as internal validation payload only.

### Capacity and defensive save checks

Update assignment save defensive checks to use allocated student count rather than total unit enrollment.

- Lecture capacity = enrolled unit student count.
- Tutorial capacity = allocated tutorial group size.

### Incomplete data behavior

- A unit with no students can still have sessions with `student_count = 0`.
- A tutorial session with no allocated students is valid and schedulable if it otherwise has a lecturer and duration.
- Do not treat zero-student sessions as incomplete.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Only `lecture` and `tutorial` session types are accepted after migration.
- Old lab/workshop rows are mapped to tutorial or the migration proves none exist.
- Lecture allocation includes every student enrolled in the unit.
- Tutorial allocation gives every enrolled student exactly one tutorial allocation when tutorials exist.
- Tutorial allocations are balanced as evenly as possible.
- Rebalancing preserves existing allocations where possible.
- Adding a student assigns them to all lecture sessions and one tutorial session for each relevant unit.
- Removing a student removes their allocation rows.
- Adding a tutorial session rebalances with minimal movement.
- Removing a tutorial session reassigns its students to remaining tutorial sessions.
- Assignment defensive capacity checks use allocation count.
- Schedulable-session DTO `student_count` uses allocation count.
- No user-facing route exposes tutorial allocation membership.
- Backend tests cover lecture allocation, tutorial balancing, stability, trigger points, and capacity count behavior.
