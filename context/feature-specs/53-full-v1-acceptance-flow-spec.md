# Unit 53 Spec: Full V1 Acceptance Flow

## Goal

Run and document a complete v1 acceptance pass across auth, CRUD, timetable drafting, frontend validation, saving, solver execution, and partial-result handling. The result should prove the implemented system works end to end within v1 scope.

## Design

- Keep this unit as full-app verification, not new feature implementation.
- The acceptance flow should use the actual app locally or in a staging-like environment.
- Do not introduce new features to make the flow pass; failures should be logged as defects or follow-up tasks.
- The flow should explicitly verify the new frontend-owned validation model.
- The flow should verify that timetable edits persist only after explicit Save.

## Implementation

### Scope

Create a manual acceptance checklist or executable acceptance script covering:

1. Sign in.
2. Create a room.
3. See timetable canvas appear.
4. Create a lecturer with availability.
5. Create a student.
6. Create a unit.
7. Create a session.
8. See the session appear in the unscheduled pool.
9. Manually schedule the session in frontend draft state.
10. Confirm refresh before save does not persist unsaved draft changes if that is the expected current behavior.
11. Save the timetable draft.
12. Refresh and confirm saved assignment persists.
13. Move the scheduled session in the draft.
14. Remove the scheduled session back to the pool.
15. Attempt blocked placements and confirm they are rejected.
16. Create an allowed warning placement.
17. Confirm warning is visible and specific.
18. Confirm solver is disabled with explanation while any issue exists.
19. Fix warnings/blocking issues.
20. Save a solver-ready timetable.
21. Run solver.
22. See success or partial-success result.
23. Confirm failed/unscheduled sessions remain visible.

### Acceptance Output

Record:

- environment used;
- date of pass;
- test account/context used without sensitive credentials;
- pass/fail for each step;
- defects found;
- follow-up tasks.

### Out of Scope

Do not build new features, change architecture, add soft constraints, add imports/exports, add multi-admin behavior, or add student/lecturer-facing views in this unit.

## Dependencies

This unit depends on Units 1–52.

## Verification Checklist

- [ ] Acceptance checklist exists.
- [ ] Full auth-to-solver user flow is executed.
- [ ] Timetable draft behavior is verified before save.
- [ ] Saved assignment persistence is verified after refresh.
- [ ] Blocked placements are verified as rejected.
- [ ] Warning placements are verified as allowed with visible warning feedback.
- [ ] Solver is verified as blocked by any validation issue.
- [ ] Solver success or partial-success result is verified.
- [ ] Unscheduled sessions remain visible after partial solver result.
- [ ] Any defects are documented rather than hidden.
