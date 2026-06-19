# Unit 87 Spec: Solver and Backend Defensive Block Integration

## Goal

Make persisted timetable blocks a hard scheduling constraint across backend assignment save, solver input compilation, solver candidate generation, and solver result application. It must be impossible for the solver to place a session in a blocked cell, and impossible for stale frontend data to save or apply assignments that overlap blocks.

## Design

- Keep this unit inside `backend/`.
- Do not add frontend UI behavior in this unit.
- Do not change the block CRUD API except where defensive validation response details require minor schema additions.
- Blocks are hard constraints.
- Blocks are room-specific:
  - candidate feasibility checks compare `(day, slot, room_id)`;
  - no all-rooms abstraction is introduced.
- Timetable blocks are not sessions.
- Timetable blocks are not soft constraints.
- Solver objective remains simple:
  - maximize the number of scheduled unscheduled sessions.
- Solver output may remain partial when blocks prevent all sessions from being placed.
- Saved assignments are still locked solver inputs, but snapshot building must reject or guard impossible saved states that overlap blocks.

## Implementation

### Backend constraint type

Add a new constraint type to the backend constraint mirror:

```py
TIMETABLE_SLOT_BLOCKED = "timetable_slot_blocked"
```

Severity:

```py
blocking
```

This is a cell feasibility constraint, not a conflict-graph edge.

Do not add pairwise conflict edges for blocks. Blocks should be checked by expanding occupied cells and intersecting with blocked cells.

### Solver snapshot types

Extend solver snapshot types with blocked-cell data.

Suggested dataclass:

```py
@dataclass(frozen=True)
class BlockedCellSnapshot:
    day: str
    slot: str
    room_id: str
    block_group_id: str
    block_name: str | None
```

Extend `SolverInputSnapshot`:

```py
blocked_cells: frozenset[BlockedCellSnapshot]
```

Ensure deterministic ordering where snapshots are converted to sorted collections or test output.

### Snapshot builder

Update DB snapshot loading:

- load all timetable block cells;
- include group name for diagnostics;
- build a fast lookup of blocked `(day, slot, room_id)` cells;
- validate saved locked assignments against blocked cells.

If a saved locked assignment overlaps a block, choose one defensive behavior and keep it explicit:

Recommended behavior:

- raise `SnapshotIntegrityError` with a structured code such as `assignment_overlaps_timetable_block`.

Reason: the block API already unschedules overlapping saved assignments when blocks are created/updated. If a saved overlap still exists at solver-start time, it is an impossible persisted state and the solver should not run from it.

### Assignment save defensive validation

Update `save_assignments`:

- load blocked cells;
- reject any requested assignment whose occupied cells intersect a blocked cell;
- return a structured validation error:
  - code: `assignment_overlaps_timetable_block`;
  - message: `This assignment overlaps a blocked timetable slot.`
- Include affected session/block metadata in logs where safe.

This protects stale frontend drafts after blocks are created in another browser tab.

### Solver model candidate filtering

Update CP-SAT candidate construction:

- When generating candidate placements for an unscheduled session, expand candidate occupied cells.
- Reject the candidate if any occupied cell is in `snapshot.blocked_cells`.
- This should happen at candidate generation time, alongside:
  - room capacity;
  - lunch crossing;
  - off-timetable;
  - lecturer availability;
  - locked room occupancy.

No variable should be created for a blocked candidate.

### Solver result application defensive validation

Update `apply_solver_result`:

- before inserting generated assignments, load blocked cells;
- reject any generated assignment that overlaps a block;
- rollback and raise `SolverResultApplicationError` with:
  - code: `blocking_integrity_violation`;
  - detail/code metadata indicating `assignment_overlaps_timetable_block`.
- Existing saved state must remain unchanged on failure.

This is defensive protection in case candidate filtering regresses.

### Job/API behavior

Existing solver start/status behavior should remain:

- `POST /solver/start` builds the snapshot from saved backend state.
- If snapshot integrity fails due to blocked overlap, return the existing structured solver integrity failure path.
- Do not expose internal solver stack details.
- Do not create a new user-facing validation API.

### Logging

Add structured logs where appropriate:

- assignment save rejected due to block overlap;
- snapshot build rejected due to block overlap;
- solver result apply rejected due to block overlap.

Prefer counts and IDs over raw student payloads.

### Tests

Add/update backend tests for:

- constraint enum includes `timetable_slot_blocked` as blocking;
- snapshot includes blocked cells;
- snapshot ordering is deterministic;
- snapshot rejects a saved assignment overlapping a block;
- snapshot allows saved assignments not overlapping blocks;
- assignment save rejects a single-slot assignment into a blocked cell;
- assignment save rejects a multi-slot assignment whose second/third slot overlaps a block;
- assignment save allows same day/slot in a different room;
- assignment save allows same room/slot on a different day;
- solver does not create placements in blocked cells;
- solver schedules around a block when another feasible cell exists;
- solver returns a partial result when blocks make a session impossible;
- solver respects locked sessions and blocks at the same time;
- apply_solver_result rejects generated blocked assignment and rolls back;
- solver job surfaces blocked-overlap snapshot failure as a failed/safe run or structured start rejection according to current service behavior.

## Dependencies

No new dependencies expected.

## Verification checklist

- Backend has a `timetable_slot_blocked` blocking constraint type.
- Solver snapshot includes blocked cells.
- Saved locked assignments overlapping blocks cannot be used as solver input.
- Assignment save defensively rejects blocked overlaps.
- Solver never creates candidates occupying blocked cells.
- Solver can schedule around blocks when possible.
- Solver partial results work when blocks reduce feasibility.
- Solver result application defensively rejects blocked overlaps.
- Failure paths preserve existing saved timetable state.
- Backend tests pass.
