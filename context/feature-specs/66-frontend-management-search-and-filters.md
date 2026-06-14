# Unit 66 Spec: Frontend Management Search and Filters

## Goal

Add frontend-only search and filtering to the management pages: units, lecturers, students, and rooms. These controls should improve usability without adding backend query parameters or changing persistence behavior.

## Design

- Keep this unit inside `frontend/`.
- Filters are client-side over currently loaded TanStack Query data.
- Do not add backend search endpoints or query params.
- Do not store filters in the database.
- Use local route/component state or a small reusable hook. Zustand is allowed only if the filter state is shared beyond a page; it should not be necessary here.
- Keep empty states clear: distinguish `No records yet` from `No records match your filters`.
- Use existing design tokens and shadcn primitives.

## Implementation

### Reusable filter patterns

Create small helpers/components where useful:

- `SearchInput` wrapper if existing inputs are duplicated heavily.
- `FilterBar` layout for search + select controls.
- Pure filter functions per domain for testability.

Do not overbuild a generic filtering framework.

### Rooms page

Add controls above the rooms table:

- Search by room name only.
- Filter by room type:
  - All types
  - Lecture
  - Tutorial
- Filtering should not change create/edit/delete behavior.
- Empty match state should say no rooms match the current filters.

### Students page

Add controls above the students table:

- Search by student first name, last name, and title where useful.
- Filter by year level:
  - All years
  - Year 1
  - Year 2
  - Year 3
- Filter by enrolled unit:
  - All units
  - Unit code/name options from loaded units/student summaries.
- Student table still shows unit count.

### Lecturers page

Add controls above the lecturers table:

- Search by lecturer title, first name, and last name.
- Filter by taught unit:
  - All units
  - Unit code/name options.
- Filtering should use lecturer response taught-unit summaries.
- Teaching assignments remain read-only here.

### Units page

Add controls above the units table:

- Search by unit code and unit name.
- Filter by derived year level:
  - All years
  - Year 1
  - Year 2
  - Year 3
- Filter by teaching lecturer:
  - All lecturers
  - Lecturer display names.
- Filtering should use `unit.year_level` and `unit.lecturers`.

### Accessibility and UX

- Search inputs have clear labels/placeholders.
- Select filters have accessible labels.
- Add a `Clear filters` action when any filter is active.
- Filter controls should not hide loading/error states.
- Debouncing is optional; dataset is small enough for immediate filtering.

## Dependencies

No new package dependencies expected.

## Verification checklist

- Rooms search filters by name only.
- Rooms type filter works.
- Students search works.
- Students year filter works.
- Students unit-enrolled filter works.
- Lecturers search works.
- Lecturers taught-unit filter works.
- Units search works by code/name.
- Units year filter works from derived year level.
- Units teaching-lecturer filter works.
- Empty match states are distinct from true empty data states.
- No backend query params are introduced.
- No server-owned data is stored in Zustand.
- Frontend tests cover all filter types with real-shaped fixtures.
