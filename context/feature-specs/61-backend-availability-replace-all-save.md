# Unit 61 Spec: Backend Lecturer Availability Replace-All Save Hardening

## Goal

Fix lecturer availability persistence so saved availability can be edited reliably. The save operation should replace the lecturer's unavailable-slot set transactionally instead of attempting incremental mutation that can leave stale rows or uniqueness conflicts.

## Design

- Keep this unit inside `backend/`.
- Do not change the availability UI in this unit.
- Keep the existing `lecturer_availability` table shape unless a real schema defect is found.
- Preserve the existing meaning: stored rows represent unavailable/blocked slots.
- Use a delete/flush/reinsert transaction for each save.
- Keep the unique constraint on `(lecturer_id, day, slot)`.
- Repeated saves with different slot sets must work.
- Repeated saves with an empty set must clear all unavailable slots.

## Implementation

### Service update

Update `set_availability` or the equivalent lecturer service function:

1. Validate the lecturer exists.
2. Validate each requested day/slot value.
3. Deduplicate identical day/slot pairs in the request.
4. Start a transaction using the existing request DB session.
5. Delete all existing `LecturerAvailability` rows for the lecturer.
6. Flush the delete before inserting replacements.
7. Insert the new unavailable rows.
8. Commit once at the service/API boundary according to the existing service convention.
9. Return the lecturer response with the new unavailable slots.

Avoid relationship assignment if it has been causing stale ORM state or duplicate-row problems. A direct delete query plus explicit inserts is acceptable here because this endpoint semantically replaces the full set.

### Error handling

- Missing lecturer returns structured 404.
- Invalid slot/day returns structured 422.
- Duplicate entries in the request should not produce duplicate rows.
- Unexpected persistence errors rollback and surface the existing structured error shape.

### Tests

Add backend tests for:

- create availability from empty;
- replace one set with a different set;
- clear all availability by saving an empty list;
- save the same set twice;
- duplicate request entries deduplicate safely;
- no rows for other lecturers are affected.

## Dependencies

No new package dependencies expected.

## Verification checklist

- A lecturer's availability can be saved, edited, and saved again.
- Saving an empty availability list removes all blocked slots for that lecturer.
- Saving duplicate day/slot pairs creates only one row per pair.
- Other lecturers' availability rows are untouched.
- The API response reflects the final saved state.
- Existing lecturer availability frontend behavior continues to work.
- Backend tests cover repeated edits and clearing.
