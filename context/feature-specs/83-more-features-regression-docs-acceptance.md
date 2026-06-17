# Unit 83 Spec: More Features Regression, Docs, and Acceptance Pass

## Goal

Verify the full Units 72–82 batch and update project documentation so the implemented behavior is recorded accurately. This unit is a regression and documentation pass only; it should not introduce new product features.

## Design

- Treat this as a full-app verification unit.
- Do not add new UI behavior unless a defect from Units 72–82 is found.
- Update context/progress docs to reflect actual implementation state.
- Keep verification focused on product outcomes and architecture invariants.
- Ensure the new batch did not accidentally add broader v2 scope.

## Implementation

### Documentation updates

Update relevant context files:

- `progress-tracker.md`:
  - mark Units 72–82 complete as implementation reaches them;
  - summarize final verification in Unit 83;
  - record any remaining follow-ups clearly.
- `ui-context.md`:
  - subject colour tokens;
  - lunch/mass tokens;
  - navbar brand exception if appropriate.
- `architecture-context.md` if the persisted data model changed:
  - student titles removed;
  - lecturer title values updated;
  - unit-code format contract;
  - frontend-only subject parser.
- `code-standards.md` if new helper/module locations were added:
  - parser utility;
  - draft storage utility;
  - timetable display helpers.

### Backend regression

Run backend tests and ensure coverage for Unit 72 changes:

- student title removal;
- lecturer title values;
- unit-code format validation;
- unit-code uniqueness normalization;
- existing scheduling/solver tests still pass.

Backend verification should confirm no backend subject parser/subject colour logic was introduced.

### Frontend regression

Run frontend tests/build and ensure coverage for:

- parser utility;
- subject colours;
- unit create/save invalid-code blocking;
- student title removal;
- lecturer title options;
- subject/year filters;
- unscheduled pool fixed-width layout/search behavior;
- sticky action bar and overlay details;
- slot-label display instead of slot IDs;
- drag preview/range highlighting helpers and visible behavior where practical;
- local draft persistence;
- empty timetable save;
- Clear All draft-only behavior;
- Lunch/Mass row;
- navbar brand;
- unit modal two-column layout.

### Manual acceptance checklist

Create or update a short docs checklist covering:

1. Sign in.
2. Open `/units`.
3. Try invalid unit codes and confirm create/save disabled.
4. Enter a valid code such as `HIS101` and confirm parser display shows class/colour/year.
5. Confirm unit colours follow subject prefix.
6. Create/edit a student without title.
7. Create/edit lecturers using the final title list.
8. Confirm lecturer/student subject filters work from unit relationships.
9. Confirm unscheduled unit boxes are equal width and wrap across the page.
10. Confirm unscheduled search matches unit/lecturer but not Lecture/Tutorial.
11. Confirm timetable action bar is sticky and details overlay does not move layout.
12. Confirm validation details show time labels, not raw slot IDs.
13. Drag a multi-hour session and confirm preview/hover range matches placement.
14. Hover an invalid placement and confirm no highlight/reason appears before drop.
15. Drop invalid placement and confirm the sticky bar shows feedback after drop.
16. Leave and return to `/timetable`; confirm unsaved draft restores.
17. Refresh the page; confirm safe draft restore.
18. Clear all sessions; confirm warning dialog and draft-only behavior.
19. Save an empty timetable; confirm request succeeds and button shows `Saved`.
20. Confirm lunch row says `Lunch/Mass`.
21. Confirm navbar says `Campion - Timetable`.
22. Confirm solver button says `Generate Timetable` and remains blue.

### Scope guard

Confirm this batch did not introduce:

- backend subject parser or subject storage;
- soft constraints;
- timetable version history;
- file import/export;
- student-facing views;
- lecturer-facing views;
- multi-admin collaboration;
- Redis/cache infrastructure;
- object/blob storage;
- hidden backend mutations on drag/drop;
- immediate backend mutation on Clear All.

## Dependencies

No new dependencies expected.

## Verification checklist

- Backend tests pass.
- Frontend tests pass.
- Frontend production build passes.
- Context docs reflect implemented behavior.
- Subject parser remains frontend-only.
- Backend enforces persisted title/unit-code contracts only.
- Sticky bar/details behavior is verified.
- Empty save bug is fixed and covered.
- Draft persistence is safe and covered.
- Scope guard passes.
