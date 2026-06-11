# Unit 37 Spec: Frontend Validation Display and Solver Gate Shell

## Goal

Display frontend validation results in the timetable UI and prepare solver gating based on frontend validation. The UI should distinguish blocked placement attempts from warning placements that remain visible.

## Design

- Keep this unit inside `frontend/`.
- Use existing timetable action bar and card components.
- Blocking issues should be shown as rejected placement feedback.
- Warning issues should be shown on/near scheduled cards and in a validation summary.
- Solver button shell should be disabled whenever any frontend validation issue exists.

## Implementation

### Scope

Build:

- validation status area;
- rejected placement feedback for blocking issues;
- warning summary;
- warning styling for scheduled session cards;
- warning icon treatment;
- violation detail popover/panel if practical;
- solver blocked message area.

### Solver Gate Shell

The solver button may still be a shell at this stage, but its enabled/disabled state should derive from frontend validation results.

Disabled state must explain why the solver cannot run.

## Dependencies

Unit 36.

## Verification Checklist

- [ ] Blocking placement rejection is visible.
- [ ] Warning placements are visibly marked.
- [ ] Warning detail messages are accessible.
- [ ] Solver button is disabled when any issue exists.
- [ ] Solver disabled state explains why.
- [ ] No backend validation API is added.
