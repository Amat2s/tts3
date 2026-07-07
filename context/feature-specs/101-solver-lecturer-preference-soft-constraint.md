# Unit 101 Spec: Solver Lecturer Preference Soft Constraint

## Goal

Feed lecturer preferences into the solver as the first soft constraint. Preferences must never reduce the number of sessions the solver can schedule; they only influence which feasible arrangement the solver picks among otherwise-equal outcomes.

## Design

- System boundary: `backend/solver/`.
- This introduces soft constraints into the v1 solver model for the first time; the existing "no soft constraints" invariant is superseded by this unit and must be reconciled in docs during acceptance (Unit 102).
- The solver's primary objective is unchanged: maximize the number of scheduled sessions.
- Preferences add a secondary, lower-priority objective term: reward placing a session's lecturer in a `preferred` cell and penalize placing them in an `avoid` cell, using one fixed uniform weight for all preferences (no per-lecturer or per-cell configurable weight).
- The secondary term must never outweigh the primary objective — a solution that schedules fewer sessions must never be chosen over one that schedules more, regardless of preference score.
- Preferences never affect feasibility: they do not block, restrict, or remove any candidate assignment.

## Implementation

### Constraint mirror and snapshot

Add `PreferenceSnapshot(lecturer_id, day, slot, room_id, level)` and a `preferences` list on `SolverInputSnapshot`.

Snapshot builder should:

- load all lecturer preference cells;
- build deterministic preference data alongside existing snapshot data;
- no integrity rejection is needed — preferences carry no feasibility meaning.

### Solver objective

- Keep candidate generation and feasibility checks (capacity, lunch, off-timetable, availability, blocks, locked occupancy) unchanged.
- For each candidate assignment, look up whether the session's assigned lecturer has a preference at that candidate's `day + slot + room_id`.
- Add a weighted secondary term to the CP-SAT objective: `+weight` for `preferred` matches, `-weight` for `avoid` matches, `0` otherwise.
- Scale the primary (scheduled-count) objective so it always dominates the secondary term (e.g. lexicographic weighting via a large multiplier on the primary term), so preference scoring only breaks ties among equally-maximal scheduling outcomes.

### Result application

No changes to result application beyond consuming the same generated assignments; preferences do not add new rejection paths.

## Dependencies

Unit 98.

No new dependencies expected.

## Verification checklist

- Solver snapshot includes lecturer preference data.
- Solver still maximizes scheduled session count first.
- Solver prefers arrangements matching `preferred` cells when scheduling count is unaffected.
- Solver avoids arrangements matching `avoid` cells when scheduling count is unaffected.
- No scenario schedules fewer sessions for the sake of preferences.
- Preferences never cause a feasible placement to be rejected.
- Backend tests pass.
