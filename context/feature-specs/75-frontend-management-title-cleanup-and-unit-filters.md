# Unit 75 Spec: Frontend Management Title Cleanup and Unit Filters

## Goal

Update management pages to match the new title contracts and extend unit-based filtering with parser-derived subject/year options. Students no longer have titles anywhere in the UI, lecturers use the final title list, and lecturer/student unit filters can filter by subject derived from unit code.

## Design

- Keep this unit inside `frontend/`.
- Use frontend-only filtering over currently loaded query data.
- Use the Unit 73 parser for subject/year derivation.
- Do not add backend query parameters.
- Do not add backend subject fields.
- Keep management-page filters simple and visible near existing search controls.
- Filters should compose predictably with search text.

## Implementation

### Student title removal in UI

Update `/students`:

- Remove title field from create modal.
- Remove title field from edit modal.
- Remove title column from the student table.
- Remove title from display names.
- Update validation to require only:
  - first name;
  - last name;
  - year level;
  - enrolled unit selection where already implemented.
- Update test fixtures and UI tests.

### Lecturer title selector

Update `/lecturers`:

- Replace title select options with:
  - `Mr`
  - `Ms`
  - `Mrs`
  - `Dr`
  - `Fr`
  - `A/Prof.`
  - `Prof.`
- Display titles exactly as selected.
- Remove assumptions that every title has or lacks a dot.
- Ensure old cached data does not crash if an unsupported title appears during transition; show it as text if returned but do not include it in the selector options.

### Unit subject filters for students

On `/students`, add unit-related filters:

- Existing search remains.
- Existing year-level filter remains.
- Add subject filter based on units the student is enrolled in.
- Subject options come from parsing loaded units with the frontend parser.
- A student matches the subject filter if any enrolled unit has that parsed subject.
- Unknown/invalid unit codes should not appear as subject filter options.

### Unit subject and year filters for lecturers

On `/lecturers`, add filters based on units taught:

- Existing search remains.
- Existing unit-teaching filter remains if present.
- Add subject filter based on units in the lecturer teaching team.
- Add year filter based on parsed unit year.
- Subject/year options come from loaded units and the frontend parser.
- A lecturer matches if any taught unit has the selected subject/year.
- Do not filter by session assignment alone; use the unit teaching-team relationship.

### Units page filter extension

If the `/units` page already has filters from the previous batch:

- Ensure unit subject filter is available and parser-derived.
- Ensure lecturer filter works against the unit teaching team.
- Ensure year filter uses parser-derived year.
- Keep all filtering frontend-only.

### Query/data requirements

Use existing loaded API data where possible:

- `students` should include enrolled unit summaries/counts from previous post-v1 work.
- `lecturers` should include units taught from previous post-v1 work.
- If a page lacks required unit summary data, fetch units once with TanStack Query and derive filters client-side.
- Do not store server-owned data in Zustand.

### Tests

Add/update tests for:

- student forms have no title field;
- student table has no title column;
- lecturer title selector uses the final options;
- student subject filter matches enrolled units;
- lecturer subject filter matches teaching-team units;
- lecturer year filter matches parser-derived year;
- invalid unit codes are ignored in filter option generation.

## Dependencies

No new dependencies expected.

## Verification checklist

- Student title is gone from all student UI.
- Lecturer title selector matches the final title list.
- Student filters include parser-derived subject.
- Lecturer filters include parser-derived subject and year.
- Unit filters include lecturer/subject/year where applicable.
- Filtering is frontend-only.
- Search and filters compose without losing loaded data.
- Frontend tests and build pass.
