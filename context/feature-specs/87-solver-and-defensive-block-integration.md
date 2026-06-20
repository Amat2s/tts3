# Unit 87 Spec: Solver and Backend Defensive Block Integration

## Goal

Make timetable blocks a hard backend and solver constraint. Stale frontend data must not save assignments into blocked cells, and the solver must never generate assignments occupying blocked cells.

## Design

- System boundary: `backend/`.
- Blocks are hard constraints, not soft constraints.
- Blocks are room-specific `day + slot + room_id` cells.
- Blocks are not sessions.
- Solver objective remains: maximize the number of scheduled sessions.
- Solver output may be partial when blocks reduce feasibility.
- No frontend UI changes in this unit.

## Implementation

### Constraint and snapshot

Add backend constraint type:

```py
TIMETABLE_SLOT_BLOCKED = "timetable_slot_blocked"
```

Severity: `blocking`.

This is a cell feasibility constraint, not a conflict-graph edge.

Extend solver snapshot types with blocked cells:

```py
BlockedCellSnapshot(day, slot, room_id, block_group_id, block_name)
```

Add `blocked_cells` to `SolverInputSnapshot`.

Snapshot builder should:

- load all block cells with group names;
- build deterministic blocked-cell data;
- reject saved locked assignments that overlap blocks with `SnapshotIntegrityError`.

### Assignment save defensive validation

Update assignment save service:

- load blocked cells;
- reject any requested assignment whose occupied cells intersect a blocked cell;
- use structured error code `assignment_overlaps_timetable_block`;
- keep this as defensive persistence validation, not normal UX validation.

### Solver model

During candidate generation:

- expand candidate occupied cells;
- reject candidate if any occupied cell is blocked;
- do this before creating CP-SAT variables.

This should compose with existing feasibility checks for capacity, lunch, off-timetable, lecturer availability, and locked room occupancy.

### Result application

Update solver result application:

- defensively reject generated assignments overlapping blocks;
- rollback on failure;
- preserve existing saved state;
- report a structured integrity failure.

### Job/API behavior

Existing solver start/status behavior should remain.

If snapshot integrity fails because a saved assignment overlaps a block, the solver start path should fail safely through the existing structured solver-integrity path.

## Dependencies

Unit 84.

No new dependencies expected.

## Verification checklist

- Constraint mirror includes `timetable_slot_blocked`.
- Solver snapshot includes blocked cells.
- Saved assignments overlapping blocks cannot be solver input.
- Assignment save rejects blocked overlaps.
- Solver creates no blocked-cell candidates.
- Solver schedules around blocks when possible.
- Solver returns partial when blocks make some sessions impossible.
- Result application rejects blocked generated assignments.
- Failure paths preserve saved state.
- Backend tests pass.
