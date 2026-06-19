# Unit 88 Spec: Timetable Blocks Regression, Docs, and Acceptance Pass

## Goal

Verify the full timetable blocks batch and update project documentation so the new block feature is recorded accurately. This unit is a regression and documentation pass only; it should not introduce new product behavior unless a defect from Units 84–87 is found.

## Design

- Treat this as a full-app verification unit.
- Do not add new block functionality unless required to fix a defect.
- Update context and progress docs to reflect actual implementation.
- Confirm that timetable blocks did not accidentally introduce soft constraints, fake sessions, all-room abstraction, timetable version history, or new role views.
- Keep verification focused on product outcomes:
  - blocks render correctly;
  - manual placement is blocked;
  - solver avoids blocked cells;
  - saved state remains recoverable.

## Implementation

### Documentation updates

Update relevant context files:

- `progress-tracker.md`:
  - mark Units 84–87 complete as implementation reaches them;
  - summarize final Unit 88 verification;
  - record any remaining follow-ups clearly.
- `project-overview.md`:
  - add timetable blocks to the timetable workspace feature description;
  - state that blocks are room-specific hard constraints;
  - state that unnamed blocks render grey;
  - state that named blocks may use gold, light blue, or light pink.
- `architecture-context.md`:
  - add timetable block groups/cells to the storage model;
  - record that blocks are canonical persisted constraints;
  - record that frontend validation and solver mirror both consume blocks.
- `code-standards.md`:
  - add module/file organization for timetable block API/client/service modules;
  - add validation rule expectations for `timetable_slot_blocked`;
  - add solver snapshot/application expectations for blocked cells.
- `ui-context.md`:
  - add final timetable block tokens if not already documented in Unit 85.

### Backend regression

Run backend tests and ensure coverage for:

- timetable block model/schema validation;
- unnamed block with no colour;
- named block with each allowed colour;
- named/colour consistency errors;
- duplicate blocked cell prevention;
- block create/update unscheduling overlapping saved assignments;
- assignment save defensive rejection against blocks;
- solver snapshot blocked-cell loading;
- solver candidate filtering against blocks;
- solver partial result when blocks make some sessions impossible;
- solver result application rollback on blocked overlap;
- existing solver/session/allocation tests still pass.

Backend verification should confirm:

- blocks are not sessions;
- no soft-constraint objective was added;
- no all-rooms database abstraction was added.

### Frontend regression

Run frontend tests/build and ensure coverage for:

- timetable block API client;
- block view model flattening;
- grey unnamed block rendering;
- named gold block rendering;
- named light-blue block rendering;
- named light-pink block rendering;
- block action in sticky timetable action bar;
- dirty-draft guard before block editing;
- block-selection mode;
- adjacent/rectangular selection behavior;
- blank-name submission payload;
- named-colour submission payload;
- manual click placement rejection into blocked cells;
- drag/drop rejection into blocked cells;
- hover over blocked cells showing no highlight and no pre-drop reason;
- restored local draft cleanup when assignments overlap blocks;
- block query error display inside sticky bar;
- block delete makes cells usable again without rescheduling sessions.

Frontend verification should confirm:

- no hardcoded colour values in components;
- block tokens are separate from subject tokens;
- block UI does not modify protected shadcn primitives.

### Manual acceptance checklist

Create or update a docs checklist for the block feature:

1. Sign in.
2. Open `/timetable`.
3. Confirm the sticky timetable action bar shows an `Add block` action when the draft is clean.
4. Create or load rooms so the timetable grid is visible.
5. Click `Add block`.
6. Select one room-specific cell.
7. Save with no name and confirm the cell renders grey with a lock icon.
8. Confirm a session cannot be placed into the unnamed blocked cell.
9. Click `Add block` again.
10. Select adjacent slots in the same room.
11. Name the block `Chapel` and choose Gold.
12. Confirm adjacent cells show the name and gold block style.
13. Create another named block using Light blue.
14. Create another named block using Light pink.
15. Confirm blocks are room-specific by placing a session at the same day/time in a different unblocked room.
16. Confirm dragging over a blocked target shows no hover highlight and no reason before drop.
17. Drop onto a blocked target and confirm the sticky bar shows the blocking reason after the failed drop.
18. Save or restore a local draft that overlaps a block and confirm the invalid assignment is returned to the unscheduled pool.
19. Create a block over an already saved scheduled assignment and confirm the saved session is unscheduled after refetch.
20. Delete a block and confirm the cell becomes usable again.
21. Run the solver with blocked cells present.
22. Confirm the solver does not place any generated session into blocked cells.
23. Confirm the solver returns a partial result if blocks make some sessions impossible.
24. Confirm existing saved locked assignments are still respected when they do not overlap blocks.
25. Confirm no block appears in the unscheduled session pool.
26. Confirm blocks are not counted as sessions.

### Scope guard

Confirm this batch did not introduce:

- fake block sessions;
- all-rooms block abstraction;
- soft constraints;
- timetable version history;
- file import/export;
- student-facing views;
- lecturer-facing views;
- multi-admin collaboration;
- Redis/cache infrastructure;
- object/blob storage;
- hidden backend mutation on timetable drag/drop;
- immediate backend mutation for normal session placement;
- user-editable solver constraint rules.

### Final evidence

Record final verification evidence in `progress-tracker.md`, including:

- backend test command and result;
- frontend test command and result;
- frontend production build result;
- backend import smoke result where practical;
- Alembic current/head revision if migrations were added;
- any manual checklist items still pending a human browser run.

## Dependencies

No new dependencies expected.

## Verification checklist

- Backend tests pass.
- Frontend tests pass.
- Frontend production build passes.
- Timetable blocks are documented in project overview and architecture context.
- UI tokens are documented.
- Progress tracker reflects Units 84–88.
- Manual acceptance checklist exists.
- Blocks remain room-specific.
- Unnamed blocks are grey.
- Named blocks use only gold, light blue, or light pink.
- Manual placement is blocked.
- Solver placement is blocked.
- Existing v1/post-v1 scheduling behavior is not regressed.
