# Unit 88 Spec: Timetable Blocks Regression, Docs, and Acceptance Pass

## Goal

Verify the full timetable blocks batch and update docs/progress so the implemented behavior is accurately recorded. This unit is verification and documentation only unless defects from Units 84–87 are found.

## Design

- Full-app regression pass.
- Do not add new feature behavior unless fixing a defect.
- Confirm blocks did not introduce:
  - fake sessions;
  - all-rooms abstraction;
  - soft constraints;
  - timetable version history;
  - imports/exports;
  - student/lecturer-facing views;
  - hidden backend mutation on normal drag/drop.

## Implementation

### Documentation updates

Update:

- `progress-tracker.md`
  - Units 84–87 completion notes;
  - Unit 88 final evidence;
  - remaining follow-ups.
- `project-overview.md`
  - room-specific timetable blocks;
  - hard constraint behavior;
  - unnamed grey blocks;
  - named gold/light-blue/light-pink blocks.
- `architecture-context.md`
  - block group/cell storage model;
  - frontend validation consumes blocks;
  - solver mirror consumes blocks.
- `code-standards.md`
  - block module locations;
  - `timetable_slot_blocked` validation expectations;
  - solver snapshot/application expectations.
- `ui-context.md`
  - final block tokens.

### Regression coverage

Backend tests should cover:

- model/schema validation;
- named/unnamed colour rules;
- duplicate blocked-cell prevention;
- saved assignment unscheduling on block create/update;
- assignment-save defensive rejection;
- snapshot blocked-cell loading;
- solver avoiding blocks;
- solver partial result due to blocks;
- result application rollback on blocked overlap.

Frontend tests should cover:

- block API/client or view-model helpers;
- grey unnamed rendering;
- named colour rendering;
- `Add block` action;
- dirty-draft guard;
- selection behavior;
- blank-name payload;
- named-colour payload;
- click and drag/drop rejection;
- no invalid-hover highlight;
- restored draft cleanup;
- block delete making cells usable again.

### Manual acceptance checklist

Create a checklist covering:

1. Sign in and open `/timetable`.
2. Confirm `Add block` appears when draft is clean.
3. Create an unnamed one-cell block and confirm grey/lock rendering.
4. Confirm a session cannot be placed there.
5. Create adjacent named blocks using Gold, Light blue, and Light pink.
6. Confirm blocks are room-specific by using the same time in another unblocked room.
7. Confirm invalid hover over a blocked target gives no highlight/reason.
8. Drop onto blocked target and confirm feedback appears after the attempt.
9. Confirm restored drafts overlapping blocks are cleaned.
10. Create a block over a saved assignment and confirm that session returns to the unscheduled pool.
11. Delete a block and confirm the cell becomes usable.
12. Run solver and confirm generated assignments avoid blocked cells.
13. Confirm partial solver result if blocks make some sessions impossible.
14. Confirm blocks do not appear in the unscheduled pool or count as sessions.

### Final evidence

Record:

- backend test result;
- frontend test result;
- frontend production build result;
- backend import smoke where practical;
- Alembic current/head if migrations were added;
- any manual checklist items still pending.

## Dependencies

Units 84–87.

No new dependencies expected.

## Verification checklist

- Backend tests pass.
- Frontend tests pass.
- Frontend build passes.
- Context docs updated.
- Progress tracker updated.
- Manual checklist exists.
- Blocks remain room-specific.
- Manual placement is blocked.
- Solver placement is blocked.
- Existing scheduling behavior is not regressed.
