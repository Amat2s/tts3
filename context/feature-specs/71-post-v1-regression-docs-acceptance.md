# Unit 71 Spec: Post-V1 Regression, Docs, and Acceptance Pass

## Goal

Verify the full post-v1 adjustment batch end to end and update the context files so the project documentation matches the new scheduling model. This unit should not add new product behavior except small test-support fixes required to pass the acceptance flow.

## Design

- Full-app verification unit.
- Keep changes limited to tests, documentation, and genuine defect fixes found during verification.
- Do not add v2 features.
- Preserve the single-admin scope.
- Preserve frontend-owned validation and explicit save workflow.
- Update context docs so future implementation agents do not use stale v1 assumptions.

## Implementation

### Backend regression coverage

Ensure backend tests cover:

- unit year-level parser;
- unit code validation;
- student year-level restriction to 1–3;
- student-create automatic enrollment into matching units;
- unit-create default student selection when no explicit list is supplied;
- student/unit enrollment edits use the same `unit_students` relationship;
- unit teaching team migration/CRUD behavior;
- session-level lecturer validation;
- session without lecturer not schedulable;
- lecture/tutorial-only session types;
- lecture allocation includes all enrolled students;
- tutorial allocation is balanced;
- tutorial allocation remains stable where practical;
- allocation rebuild trigger points;
- assignment capacity checks use allocation counts;
- lecturer availability repeated edit/clear behavior;
- solver snapshot uses session lecturer and allocation rows;
- solver respects locked sessions and partial results under the new model;
- failed solver runs preserve existing timetable state.

### Frontend regression coverage

Ensure frontend tests cover:

- unit modal derived year display;
- invalid unit code client-side error;
- unit modal wider layout smoke test where practical;
- unit student selector search/year filter;
- unit teaching-team selector;
- session lecturer selector restricted to teaching team;
- duration stepper min/max and hour label;
- Lecture/Tutorial-only session type controls;
- student modal enrolled-unit selection and default year matching;
- student table unit count;
- lecturer taught-unit read-only display;
- room/student/lecturer/unit management filters;
- timetable validation using session-level lecturers;
- student warnings using allocated student IDs;
- room capacity using allocation count;
- unscheduled pool unit-box redesign;
- unscheduled pool search/year filters;
- all-scheduled completion state;
- Clear All warning dialog and draft-only behavior;
- Save button `Saved` state;
- solver button `Generate Timetable` label and disabled explanation.

### Manual acceptance flow

Create or update a docs file, for example `docs/post-v1-adjustments-acceptance-flow.md`, with a concise pass/fail checklist:

1. Sign in.
2. Create Year 1, Year 2, and Year 3 students.
3. Create units whose codes derive years 1, 2, and 3.
4. Confirm matching students auto-select/enroll.
5. Manually remove/add a student from a unit.
6. Confirm the student page reflects the same enrollment.
7. Add multiple lecturers to a unit.
8. Create Lecture and Tutorial sessions and assign session lecturers.
9. Confirm lecturers page shows taught units read-only.
10. Confirm management search/filter controls work.
11. Confirm unscheduled pool groups sessions into unit boxes.
12. Schedule sessions manually.
13. Confirm room capacity uses lecture/tutorial group size.
14. Confirm lecturer conflict/availability warnings use session lecturer.
15. Confirm tutorial/tutorial overlap only warns when allocated students overlap.
16. Save timetable and refresh.
17. Use Clear All, cancel, then confirm.
18. Confirm Clear All is draft-only until Save.
19. Save cleared timetable.
20. Recreate a valid saved setup and Generate Timetable.
21. Confirm solver success or partial-success behavior.
22. Confirm failed/partial sessions remain visible.

### Context docs to update

Update these files if they live in the repo:

- `architecture-context.md`
- `project-overview.md`
- `code-standards.md`
- `progress-tracker.md`
- `00-build-plan.md` or a post-v1 build plan file

Required documentation changes:

- Unit year level derived from first integer in unit code.
- Student year levels are 1–3 only.
- Units have teaching lecturer teams.
- Sessions have session-level lecturers.
- Session types are Lecture/Tutorial only.
- Hidden session-student allocations drive tutorial membership, capacity, student conflicts, and solver input.
- Tutorial allocations are not user-facing.
- Independent unit/session overlap warning is retired in favor of actual allocated-student overlap.
- Clear All is draft-only.
- Management filters are frontend-only.
- Duration displays as hours but remains integer slot duration internally.

### Commands

Run and record:

- backend test suite from `backend/`;
- frontend test suite from `frontend/`;
- frontend production build;
- backend import/app smoke;
- any migration head/current checks practical in local dev.

## Dependencies

No new product dependencies expected. Test dependencies should already exist from v1.

## Verification checklist

- Backend tests pass.
- Frontend tests pass.
- Frontend production build passes.
- Backend app imports cleanly.
- Alembic head is correct.
- Acceptance flow document is created/updated.
- Context files reflect post-v1 behavior.
- Progress tracker records Units 58–71 accurately.
- No accidental v2 scope is introduced.
- No Redis, blob storage, soft constraints, version history, student-facing views, lecturer-facing views, multi-admin collaboration, import/export, or user-defined constraints are introduced.
