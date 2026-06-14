# Unit 64 Spec: Frontend Student Enrollment Management

## Goal

Allow the admin to view and edit a student's enrolled units from the `/students` page while using the exact same underlying unit-student relationship as the `/units` page. The student table should show how many units each student is enrolled in.

## Design

- Keep this unit inside `frontend/`.
- Do not add a second enrollment model.
- Do not change backend schemas in this unit.
- Editing from the student modal and editing from the unit modal must reflect the same source of truth after refetch.
- New students should default-select all current units whose derived year level matches the student's year level.
- The admin can manually add/remove units before saving.
- Student year levels are only 1, 2, and 3.

## Implementation

### Student table

Update `/students` table:

- Add an enrolled-units/count column.
- Display `0 units`, `1 unit`, or `N units`.
- Keep row actions unchanged.

### Student form state

Update create/edit student modal state:

- Add `unit_ids: string[]` or equivalent based on Unit 62 API client shape.
- Create form initial state:
  - title;
  - first name;
  - last name;
  - year level;
  - selected units defaulted to units matching the selected year level.
- Edit form initial state:
  - current student fields;
  - current enrolled units from `student.units`.

### Year level behavior

- Student year-level selector only offers Year 1, Year 2, Year 3.
- On create, changing the year level before any manual unit selection should reset default selected units to that year.
- Once the admin manually changes unit selection, do not silently overwrite their choices.
- Provide a small secondary action such as `Select all Year X units` if useful.

### Unit selector in student modal

Add an enrolled-units selector:

- Search by unit code/name.
- Filter by derived unit year level.
- Checkbox list or compact multi-select.
- Show selected count.
- Do not show tutorial allocations or session-level data.

### Mutations and invalidation

When creating/updating a student with enrollment changes, invalidate:

- `['students']`
- `['units']`
- `['schedulable-sessions']`
- `['assignments']` if assignment validation data can change.

If the backend uses a separate student-enrollment endpoint, call it in the same mutation flow and handle failures explicitly. Do not partially hide failures.

### Delete behavior

Student deletion remains destructive and should already have confirmation. After deletion, invalidate units/schedulable sessions/assignments where needed because allocation and capacity data may change.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Student table shows enrolled unit count.
- Student create modal includes unit enrollment selection.
- New student defaults to all units matching selected year level.
- Admin can manually change the selected units before saving.
- Student edit modal loads current enrolled units.
- Student edit can add/remove unit enrollments.
- Changes made from `/students` are reflected on `/units` after refetch.
- Changes made from `/units` are reflected on `/students` after refetch.
- No separate enrollment state is stored in Zustand.
- Tutorial allocations remain hidden.
- Query invalidation refreshes timetable-dependent data.
- Frontend tests cover create defaults, edit persistence, and unit count display.
