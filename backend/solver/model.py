"""CP-SAT solver model for Unit 42.

Turns a SolverInputSnapshot into a valid (possibly partial) timetable
solution. The module receives an explicit snapshot object only — it never
queries the database, fetches API data, or reads frontend draft state.

Modeling approach: each unscheduled session gets one optional placement
variable per feasible (day, start slot, room) candidate. Candidates that
violate static hard constraints (room capacity, lunch crossing, off
timetable, lecturer unavailability, overlap with locked occupancy) are
never created, so constraints are enforced only when a session is
scheduled and locked saved assignments can never be moved.
"""

from ortools.sat.python import cp_model

from solver.types import (
    GeneratedAssignment,
    LockedAssignment,
    SessionSnapshot,
    SolverInputSnapshot,
    SolverRunResult,
    SolverStatus,
)

DEFAULT_TIME_LIMIT_SECONDS = 30.0

# Fixed seed + single worker keep CP-SAT runs deterministic for a given model.
_RANDOM_SEED = 0

# Unit 101: one fixed uniform weight for every lecturer preference cell. A
# `preferred` cell contributes +PREFERENCE_WEIGHT and an `avoid` cell
# -PREFERENCE_WEIGHT to the secondary objective term. There is no per-lecturer
# or per-cell configurable weight.
PREFERENCE_WEIGHT = 1


# ---------------------------------------------------------------------------
# Static placement helpers
# ---------------------------------------------------------------------------


def _valid_start_indices(duration: int, num_slots: int, boundary_index: int) -> list[int]:
    """Start indices where the session fits entirely inside the AM or PM block.

    Excludes starts that would run past the last slot (off timetable) or span
    the AM/PM boundary (lunch crossing). Contiguity is inherent: a candidate
    always occupies `duration` consecutive slots from its start.
    """
    starts: list[int] = []
    for start in range(num_slots):
        end = start + duration  # exclusive
        if end > num_slots:
            continue
        if start < boundary_index and end > boundary_index:
            continue
        starts.append(start)
    return starts


def _locked_time_cells(locked: LockedAssignment, slots: tuple[str, ...]) -> set[tuple[str, int]]:
    start = slots.index(locked.start_slot)
    return {(locked.day, t) for t in range(start, start + locked.duration)}


# ---------------------------------------------------------------------------
# Solver entry function
# ---------------------------------------------------------------------------


def solve_timetable(
    snapshot: SolverInputSnapshot,
    time_limit_seconds: float = DEFAULT_TIME_LIMIT_SECONDS,
) -> SolverRunResult:
    """Solve the CP-SAT placement model for all unscheduled sessions.

    Locked saved assignments are treated as fixed occupied intervals and are
    returned unchanged. Partial results are valid: sessions that cannot be
    placed remain explicitly listed in `unscheduled_session_ids`.
    """
    constants = snapshot.timetable_constants
    days = constants.days
    slots = constants.slots
    boundary = constants.am_pm_boundary_index

    session_map: dict[str, SessionSnapshot] = {s.session_id: s for s in snapshot.sessions}
    unavailable_by_lecturer: dict[str, frozenset[tuple[str, str]]] = {
        a.lecturer_id: a.unavailable for a in snapshot.availability
    }

    locked = list(snapshot.locked_assignments)
    locked_ids = {a.session_id for a in locked}

    # Unit 87: cells reserved by timetable blocks. A candidate occupying any of
    # these (day, room, slot) cells is never created — blocks are a hard
    # cell-feasibility constraint that composes with the checks below.
    blocked_room_cells: set[tuple[str, str, int]] = set()
    for bc in snapshot.blocked_cells:
        if bc.slot not in slots:
            continue
        blocked_room_cells.add((bc.day, bc.room_id, slots.index(bc.slot)))

    # Fixed occupancy from locked assignments: room cells block any candidate
    # in the same room, time cells block conflict partners in any room.
    locked_room_cells: set[tuple[str, str, int]] = set()
    locked_time_cells_by_session: dict[str, set[tuple[str, int]]] = {}
    for a in locked:
        cells = _locked_time_cells(a, slots)
        locked_time_cells_by_session[a.session_id] = cells
        for day, t in cells:
            locked_room_cells.add((day, a.room_id, t))

    # All three conflict types are identical hard no-time-overlap rules for
    # the solver, so merge them into one deduplicated pair set.
    all_conflict_pairs = sorted(
        {
            (min(a, b), max(a, b))
            for a, b in (
                snapshot.lecturer_conflict_pairs
                + snapshot.student_conflict_pairs
                + snapshot.unit_session_conflict_pairs
            )
        }
    )

    # Time cells an unscheduled session may never occupy because a locked
    # conflict partner (same lecturer, shared students, or same unit) already
    # occupies them. Locked-vs-locked pairs are ignored: saved warning-level
    # conflicts must not make the model infeasible.
    forbidden_time_cells: dict[str, set[tuple[str, int]]] = {}
    unscheduled_vs_unscheduled_pairs: list[tuple[str, str]] = []
    for a_id, b_id in all_conflict_pairs:
        a_locked, b_locked = a_id in locked_ids, b_id in locked_ids
        if a_locked and b_locked:
            continue
        if not a_locked and not b_locked:
            unscheduled_vs_unscheduled_pairs.append((a_id, b_id))
            continue
        free_id, locked_id = (a_id, b_id) if b_locked else (b_id, a_id)
        forbidden_time_cells.setdefault(free_id, set()).update(
            locked_time_cells_by_session[locked_id]
        )

    # Unit 101: lookup for room-specific lecturer preferences. Key is
    # (lecturer_id, day, slot, room_id) -> "preferred" | "avoid". A missing key
    # means neutral (no preference).
    preference_map: dict[tuple[str, str, str, str], str] = {
        (p.lecturer_id, p.day, p.slot, p.room_id): p.level
        for p in snapshot.preferences
    }

    model = cp_model.CpModel()

    # Per-session decision variables and candidate placements.
    scheduled_vars: dict[str, cp_model.IntVar] = {}
    # Unit 101: (score, var) secondary-objective terms; score is the net
    # preference reward/penalty for a candidate's occupied cells.
    preference_terms: list[tuple[int, cp_model.IntVar]] = []
    # candidate -> (day, start index, room_id, var), in deterministic order
    candidates_by_session: dict[str, list[tuple[str, int, str, cp_model.IntVar]]] = {}
    # (day, room_id, slot index) -> candidate vars occupying that room cell
    room_cell_vars: dict[tuple[str, str, int], list[cp_model.IntVar]] = {}
    # (session_id, day, slot index) -> candidate vars occupying that time cell
    time_cell_vars: dict[tuple[str, str, int], list[cp_model.IntVar]] = {}

    for session_id in snapshot.unscheduled_session_ids:
        session = session_map[session_id]
        unavailable = unavailable_by_lecturer.get(session.lecturer_id, frozenset())
        forbidden = forbidden_time_cells.get(session_id, set())

        scheduled = model.NewBoolVar(f"scheduled[{session_id}]")
        scheduled_vars[session_id] = scheduled
        candidates: list[tuple[str, int, str, cp_model.IntVar]] = []

        for day in days:
            for start in _valid_start_indices(session.duration, len(slots), boundary):
                occupied = range(start, start + session.duration)
                if any((day, slots[t]) in unavailable for t in occupied):
                    continue
                if any((day, t) in forbidden for t in occupied):
                    continue
                for room in snapshot.rooms:
                    if room.capacity < session.student_count:
                        continue
                    if any((day, room.room_id, t) in locked_room_cells for t in occupied):
                        continue
                    if any((day, room.room_id, t) in blocked_room_cells for t in occupied):
                        continue
                    var = model.NewBoolVar(
                        f"x[{session_id},{day},{slots[start]},{room.room_id}]"
                    )
                    candidates.append((day, start, room.room_id, var))
                    for t in occupied:
                        room_cell_vars.setdefault((day, room.room_id, t), []).append(var)
                        time_cell_vars.setdefault((session_id, day, t), []).append(var)

                    # Unit 101: net preference score for this candidate — reward
                    # `preferred` cells and penalise `avoid` cells occupied by the
                    # session's lecturer. Preferences never gate the candidate.
                    if preference_map:
                        score = 0
                        for t in occupied:
                            level = preference_map.get(
                                (session.lecturer_id, day, slots[t], room.room_id)
                            )
                            if level == "preferred":
                                score += PREFERENCE_WEIGHT
                            elif level == "avoid":
                                score -= PREFERENCE_WEIGHT
                        if score:
                            preference_terms.append((score, var))

        candidates_by_session[session_id] = candidates
        # Exactly one candidate when scheduled, none otherwise. A session with
        # no feasible candidate is forced unscheduled rather than dropped.
        model.Add(sum(c[3] for c in candidates) == scheduled)

    # Room no-overlap among solver placements (locked occupancy was excluded
    # at candidate level).
    for cell_vars in room_cell_vars.values():
        if len(cell_vars) > 1:
            model.AddAtMostOne(cell_vars)

    # Lecturer / student / unit no-overlap between two unscheduled sessions:
    # they may never occupy the same (day, slot) time cell.
    for a_id, b_id in unscheduled_vs_unscheduled_pairs:
        for day in days:
            for t in range(len(slots)):
                vars_a = time_cell_vars.get((a_id, day, t))
                vars_b = time_cell_vars.get((b_id, day, t))
                if vars_a and vars_b:
                    model.Add(sum(vars_a) + sum(vars_b) <= 1)

    # Objective (Unit 101): a lexicographic two-term objective. The primary term
    # maximises the number of previously unscheduled sessions that get scheduled;
    # the secondary term rewards `preferred` and penalises `avoid` preference
    # cells. The primary term is scaled by a multiplier strictly larger than the
    # widest possible secondary swing, so preferences only break ties among
    # equally-maximal scheduling outcomes and can never trade a scheduled session
    # for a better preference score.
    #
    # Each scheduled session contributes at most `duration` cells of magnitude
    # PREFERENCE_WEIGHT, so the secondary term lies in [-B, +B] where
    # B = PREFERENCE_WEIGHT * sum(durations). Scheduling one extra session must
    # beat the full 2B swing, so the multiplier is 2B + 1.
    max_secondary = PREFERENCE_WEIGHT * sum(
        session_map[sid].duration for sid in snapshot.unscheduled_session_ids
    )
    primary_multiplier = 2 * max_secondary + 1
    objective = primary_multiplier * sum(scheduled_vars.values())
    if preference_terms:
        objective += sum(score * var for score, var in preference_terms)
    model.Maximize(objective)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = _RANDOM_SEED
    raw_status = solver.Solve(model)

    status = {
        cp_model.OPTIMAL: SolverStatus.OPTIMAL,
        cp_model.FEASIBLE: SolverStatus.FEASIBLE,
        cp_model.INFEASIBLE: SolverStatus.INFEASIBLE,
    }.get(raw_status, SolverStatus.UNKNOWN)
    # The time limit is the only stopping criterion configured, so a search
    # that ends without an optimality proof was cut off by it.
    timed_out = raw_status in (cp_model.FEASIBLE, cp_model.UNKNOWN)

    generated: list[GeneratedAssignment] = []
    remaining_unscheduled: list[str] = []
    if status in (SolverStatus.OPTIMAL, SolverStatus.FEASIBLE):
        for session_id in snapshot.unscheduled_session_ids:
            if not solver.Value(scheduled_vars[session_id]):
                remaining_unscheduled.append(session_id)
                continue
            day, start, room_id, _ = next(
                c for c in candidates_by_session[session_id] if solver.Value(c[3])
            )
            generated.append(
                GeneratedAssignment(
                    session_id=session_id,
                    day=day,
                    start_slot=slots[start],
                    room_id=room_id,
                    duration=session_map[session_id].duration,
                )
            )
    else:
        remaining_unscheduled = list(snapshot.unscheduled_session_ids)

    generated.sort(
        key=lambda g: (
            days.index(g.day),
            g.room_id,
            slots.index(g.start_slot),
            g.session_id,
        )
    )

    attempted = len(snapshot.unscheduled_session_ids)
    message = (
        f"Scheduled {len(generated)} of {attempted} unscheduled sessions; "
        f"{len(locked)} locked assignments preserved; status={status.value}"
    )
    if timed_out:
        message += "; stopped by time limit"

    return SolverRunResult(
        status=status,
        generated_assignments=generated,
        locked_assignments=locked,
        unscheduled_session_ids=remaining_unscheduled,
        scheduled_count=len(generated),
        unscheduled_count=len(remaining_unscheduled),
        timed_out=timed_out,
        message=message,
    )
