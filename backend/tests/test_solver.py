"""Deterministic fixture-based tests for the CP-SAT solver module (Unit 42)."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from solver.model import solve_timetable
from solver.snapshot import build_snapshot_from_data
from solver.types import (
    ORDERED_DAYS,
    ORDERED_SLOTS,
    TIMETABLE_CONSTANTS,
    AvailabilitySnapshot,
    GeneratedAssignment,
    LockedAssignment,
    RoomSnapshot,
    SessionSnapshot,
    SolverInputSnapshot,
    SolverRunResult,
    SolverStatus,
)

# ---------------------------------------------------------------------------
# Fixture factories
# ---------------------------------------------------------------------------


def make_room(room_id: str, capacity: int = 30, name: str | None = None) -> RoomSnapshot:
    return RoomSnapshot(
        room_id=room_id,
        name=name or room_id,
        capacity=capacity,
        room_type="lecture",
    )


def make_session(
    session_id: str,
    unit_id: str,
    lecturer_id: str,
    duration: int = 1,
    student_ids: tuple[str, ...] = (),
    session_type: str = "lecture",
) -> SessionSnapshot:
    ids = frozenset(student_ids)
    return SessionSnapshot(
        session_id=session_id,
        unit_id=unit_id,
        unit_code=unit_id.upper(),
        unit_name=f"Unit {unit_id}",
        session_type=session_type,
        duration=duration,
        lecturer_id=lecturer_id,
        student_ids=ids,
        student_count=len(ids),
    )


def unavailable_except(*allowed: tuple[str, str]) -> frozenset[tuple[str, str]]:
    """All (day, slot) cells marked unavailable except the given ones."""
    allowed_set = set(allowed)
    return frozenset(
        (day, slot)
        for day in ORDERED_DAYS
        for slot in ORDERED_SLOTS
        if (day, slot) not in allowed_set
    )


def occupied_time_cells(day: str, start_slot: str, duration: int) -> set[tuple[str, int]]:
    start = ORDERED_SLOTS.index(start_slot)
    return {(day, t) for t in range(start, start + duration)}


def assert_valid_solution(snapshot: SolverInputSnapshot, result: SolverRunResult) -> None:
    """Check the solver output against every v1 hard constraint."""
    slots = list(snapshot.timetable_constants.slots)
    boundary = snapshot.timetable_constants.am_pm_boundary_index
    session_map = {s.session_id: s for s in snapshot.sessions}
    room_map = {r.room_id: r for r in snapshot.rooms}
    unavailable = {a.lecturer_id: a.unavailable for a in snapshot.availability}

    all_placements = list(result.generated_assignments) + list(result.locked_assignments)

    # Room no-overlap across generated and locked placements.
    room_cells: dict[tuple[str, str, int], str] = {}
    time_cells: dict[str, set[tuple[str, int]]] = {}
    for p in all_placements:
        start = slots.index(p.start_slot)
        assert start + p.duration <= len(slots), "placement runs off the timetable"
        time_cells[p.session_id] = {(p.day, t) for t in range(start, start + p.duration)}
        for t in range(start, start + p.duration):
            key = (p.day, p.room_id, t)
            assert key not in room_cells, f"room double-booking at {key}"
            room_cells[key] = p.session_id

    # Generated placements must satisfy every static hard constraint.
    for g in result.generated_assignments:
        session = session_map[g.session_id]
        start = slots.index(g.start_slot)
        end = start + g.duration
        assert g.day in snapshot.timetable_constants.days
        assert g.duration == session.duration
        assert not (start < boundary and end > boundary), "placement crosses lunch"
        assert room_map[g.room_id].capacity >= session.student_count
        lec_unavailable = unavailable.get(session.lecturer_id, frozenset())
        for t in range(start, end):
            assert (g.day, slots[t]) not in lec_unavailable, "placed in unavailable slot"

    # Conflict pairs involving at least one generated placement must not
    # overlap in time. Locked-vs-locked pairs are tolerated (saved warnings).
    generated_ids = {g.session_id for g in result.generated_assignments}
    for pairs in (
        snapshot.lecturer_conflict_pairs,
        snapshot.student_conflict_pairs,
        snapshot.unit_session_conflict_pairs,
    ):
        for a, b in pairs:
            if a not in time_cells or b not in time_cells:
                continue
            if a in generated_ids or b in generated_ids:
                assert not (time_cells[a] & time_cells[b]), f"conflict pair ({a}, {b}) overlaps"

    # Bookkeeping: counts consistent, no session silently dropped.
    assert result.scheduled_count == len(result.generated_assignments)
    assert result.unscheduled_count == len(result.unscheduled_session_ids)
    assert generated_ids | set(result.unscheduled_session_ids) == set(
        snapshot.unscheduled_session_ids
    )
    assert not (generated_ids & set(result.unscheduled_session_ids))
    assert result.locked_assignments == snapshot.locked_assignments


# ---------------------------------------------------------------------------
# 1. Result shape and trivial cases
# ---------------------------------------------------------------------------


def test_empty_snapshot_solves_cleanly():
    snapshot = build_snapshot_from_data([], [], [], [])
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.generated_assignments == []
    assert result.locked_assignments == []
    assert result.unscheduled_session_ids == []
    assert result.scheduled_count == 0
    assert result.unscheduled_count == 0
    assert result.timed_out is False
    assert "0 of 0" in result.message


def test_result_shape():
    snapshot = build_snapshot_from_data(
        [make_room("r1")], [make_session("s-a", "unit-a", "lec-1")], [], []
    )
    result = solve_timetable(snapshot)
    assert isinstance(result, SolverRunResult)
    assert isinstance(result.status, SolverStatus)
    assert all(isinstance(g, GeneratedAssignment) for g in result.generated_assignments)
    assert all(isinstance(a, LockedAssignment) for a in result.locked_assignments)
    assert isinstance(result.unscheduled_session_ids, list)
    assert isinstance(result.scheduled_count, int)
    assert isinstance(result.unscheduled_count, int)
    assert isinstance(result.timed_out, bool)
    assert isinstance(result.message, str)


def test_single_session_is_scheduled():
    snapshot = build_snapshot_from_data(
        [make_room("r1")], [make_session("s-a", "unit-a", "lec-1", duration=2)], [], []
    )
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 1
    assert result.unscheduled_session_ids == []
    [generated] = result.generated_assignments
    assert generated.session_id == "s-a"
    assert generated.duration == 2
    assert generated.day in ORDERED_DAYS
    assert generated.start_slot in ORDERED_SLOTS
    assert generated.room_id == "r1"
    assert_valid_solution(snapshot, result)


def test_timeout_flag_false_on_quick_solve():
    snapshot = build_snapshot_from_data(
        [make_room("r1")], [make_session("s-a", "unit-a", "lec-1")], [], []
    )
    result = solve_timetable(snapshot, time_limit_seconds=10.0)
    assert result.status == SolverStatus.OPTIMAL
    assert result.timed_out is False


# ---------------------------------------------------------------------------
# 2. Locked saved assignments
# ---------------------------------------------------------------------------


def test_locked_assignments_preserved_unchanged():
    sessions = [
        make_session("s-locked", "unit-a", "lec-1", duration=2),
        make_session("s-free", "unit-b", "lec-2"),
    ]
    locked = [LockedAssignment("s-locked", "Monday", "s1", "r1", 2)]
    snapshot = build_snapshot_from_data([make_room("r1")], sessions, [], locked)
    result = solve_timetable(snapshot)
    assert result.locked_assignments == locked
    assert all(g.session_id != "s-locked" for g in result.generated_assignments)
    assert "s-locked" not in result.unscheduled_session_ids
    assert result.scheduled_count == 1
    assert_valid_solution(snapshot, result)


def test_locked_room_occupancy_blocks_placement():
    """A session whose only allowed cell is occupied by a locked assignment
    in the only room must remain unscheduled."""
    sessions = [
        make_session("s-locked", "unit-a", "lec-1"),
        make_session("s-free", "unit-b", "lec-2"),
    ]
    availability = [
        AvailabilitySnapshot("lec-2", unavailable_except(("Monday", "s1"))),
    ]
    locked = [LockedAssignment("s-locked", "Monday", "s1", "r1", 1)]
    snapshot = build_snapshot_from_data([make_room("r1")], sessions, availability, locked)
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 0
    assert result.unscheduled_session_ids == ["s-free"]
    assert_valid_solution(snapshot, result)


def test_locked_conflict_partner_blocks_overlapping_time():
    """An unscheduled session sharing a lecturer with a locked assignment must
    avoid the locked time even when another room is free."""
    sessions = [
        make_session("s-locked", "unit-a", "lec-1"),
        make_session("s-free", "unit-b", "lec-1"),
    ]
    availability = [
        AvailabilitySnapshot(
            "lec-1", unavailable_except(("Monday", "s1"), ("Monday", "s2"))
        ),
    ]
    locked = [LockedAssignment("s-locked", "Monday", "s1", "r1", 1)]
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")], sessions, availability, locked
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    [generated] = result.generated_assignments
    assert (generated.day, generated.start_slot) == ("Monday", "s2")
    assert_valid_solution(snapshot, result)


def test_locked_assignment_in_unavailable_slot_is_tolerated():
    """Saved warning-level data (locked placement during lecturer unavailability)
    must not break the solve or be moved."""
    sessions = [make_session("s-locked", "unit-a", "lec-1")]
    availability = [AvailabilitySnapshot("lec-1", frozenset([("Monday", "s1")]))]
    locked = [LockedAssignment("s-locked", "Monday", "s1", "r1", 1)]
    snapshot = build_snapshot_from_data([make_room("r1")], sessions, availability, locked)
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.locked_assignments == locked
    assert result.unscheduled_session_ids == []


# ---------------------------------------------------------------------------
# 3. Room constraints
# ---------------------------------------------------------------------------


def test_room_capacity_directs_session_to_large_room():
    students = tuple(f"stu-{i}" for i in range(50))
    snapshot = build_snapshot_from_data(
        [make_room("r-small", capacity=10), make_room("r-large", capacity=100)],
        [make_session("s-a", "unit-a", "lec-1", student_ids=students)],
        [],
        [],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.generated_assignments[0].room_id == "r-large"
    assert_valid_solution(snapshot, result)


def test_room_capacity_failure_leaves_session_unscheduled():
    students = tuple(f"stu-{i}" for i in range(50))
    snapshot = build_snapshot_from_data(
        [make_room("r-small", capacity=10)],
        [make_session("s-a", "unit-a", "lec-1", student_ids=students)],
        [],
        [],
    )
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 0
    assert result.unscheduled_session_ids == ["s-a"]


def test_room_no_overlap_between_generated_sessions():
    """Two unrelated sessions restricted to the same single cell with one room:
    only one can be scheduled."""
    sessions = [
        make_session("s-a", "unit-a", "lec-1"),
        make_session("s-b", "unit-b", "lec-2"),
    ]
    availability = [
        AvailabilitySnapshot("lec-1", unavailable_except(("Monday", "s1"))),
        AvailabilitySnapshot("lec-2", unavailable_except(("Monday", "s1"))),
    ]
    snapshot = build_snapshot_from_data([make_room("r1")], sessions, availability, [])
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1
    assert_valid_solution(snapshot, result)


# ---------------------------------------------------------------------------
# 4. Lecturer / student / unit overlap constraints
# ---------------------------------------------------------------------------


def test_lecturer_no_overlap_forces_partial_result():
    """Same lecturer, single allowed cell, two free rooms: only one session
    can be scheduled even though room space exists."""
    sessions = [
        make_session("s-a", "unit-a", "lec-1"),
        make_session("s-b", "unit-b", "lec-1"),
    ]
    availability = [
        AvailabilitySnapshot("lec-1", unavailable_except(("Monday", "s1"))),
    ]
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")], sessions, availability, []
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1
    assert_valid_solution(snapshot, result)


def test_lecturer_no_overlap_spreads_sessions_across_slots():
    sessions = [
        make_session("s-a", "unit-a", "lec-1"),
        make_session("s-b", "unit-b", "lec-1"),
    ]
    availability = [
        AvailabilitySnapshot(
            "lec-1", unavailable_except(("Monday", "s1"), ("Monday", "s2"))
        ),
    ]
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")], sessions, availability, []
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 2
    placements = {(g.day, g.start_slot) for g in result.generated_assignments}
    assert placements == {("Monday", "s1"), ("Monday", "s2")}
    assert_valid_solution(snapshot, result)


def test_student_no_overlap_forces_partial_result():
    """Different lecturers but shared students, single allowed cell, two rooms:
    only one session can be scheduled."""
    shared = ("stu-1", "stu-2")
    sessions = [
        make_session("s-a", "unit-a", "lec-1", student_ids=shared),
        make_session("s-b", "unit-b", "lec-2", student_ids=shared),
    ]
    availability = [
        AvailabilitySnapshot("lec-1", unavailable_except(("Monday", "s1"))),
        AvailabilitySnapshot("lec-2", unavailable_except(("Monday", "s1"))),
    ]
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")], sessions, availability, []
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1
    assert_valid_solution(snapshot, result)


def test_unit_session_overlap_enforced_in_isolation():
    """Manually built snapshot whose only conflict edge is a unit/session pair:
    the two sessions must not be scheduled into the same single allowed cell."""
    sessions = [
        make_session("s-a", "unit-a", "lec-1"),
        make_session("s-b", "unit-a", "lec-2"),
    ]
    snapshot = SolverInputSnapshot(
        rooms=[make_room("r1"), make_room("r2")],
        sessions=sessions,
        availability=[
            AvailabilitySnapshot("lec-1", unavailable_except(("Monday", "s1"))),
            AvailabilitySnapshot("lec-2", unavailable_except(("Monday", "s1"))),
        ],
        locked_assignments=[],
        unscheduled_session_ids=["s-a", "s-b"],
        lecturer_conflict_pairs=[],
        student_conflict_pairs=[],
        unit_session_conflict_pairs=[("s-a", "s-b")],
        timetable_constants=TIMETABLE_CONSTANTS,
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1
    assert_valid_solution(snapshot, result)


# ---------------------------------------------------------------------------
# 5. Lecturer availability
# ---------------------------------------------------------------------------


def test_lecturer_availability_forces_exact_placement():
    availability = [
        AvailabilitySnapshot("lec-1", unavailable_except(("Friday", "s7"))),
    ]
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1")],
        availability,
        [],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    [generated] = result.generated_assignments
    assert (generated.day, generated.start_slot) == ("Friday", "s7")
    assert_valid_solution(snapshot, result)


def test_fully_unavailable_lecturer_leaves_session_unscheduled():
    availability = [AvailabilitySnapshot("lec-1", unavailable_except())]
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1")],
        availability,
        [],
    )
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 0
    assert result.unscheduled_session_ids == ["s-a"]


# ---------------------------------------------------------------------------
# 6. Duration, lunch boundary, and timetable boundary
# ---------------------------------------------------------------------------


def test_duration_four_must_start_at_pm_block():
    """AM has 3 slots, so a 4-slot session can only occupy the full PM block."""
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1", duration=4)],
        [],
        [],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    [generated] = result.generated_assignments
    assert generated.start_slot == "s4"
    assert_valid_solution(snapshot, result)


def test_duration_exceeding_available_block_stays_unscheduled():
    """A 4-slot session whose lecturer is unavailable at s4 every day cannot
    fit any block (AM is only 3 slots) and must remain unscheduled."""
    unavailable = frozenset((day, "s4") for day in ORDERED_DAYS)
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1", duration=4)],
        [AvailabilitySnapshot("lec-1", unavailable)],
        [],
    )
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 0
    assert result.unscheduled_session_ids == ["s-a"]


def test_generated_sessions_never_cross_lunch():
    """Many 2- and 3-slot sessions: no generated placement may span the
    AM/PM boundary."""
    sessions = [
        make_session(f"s-{i}", f"unit-{i}", f"lec-{i}", duration=2 + (i % 2))
        for i in range(6)
    ]
    snapshot = build_snapshot_from_data([make_room("r1")], sessions, [], [])
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 6
    boundary = TIMETABLE_CONSTANTS.am_pm_boundary_index
    for g in result.generated_assignments:
        start = ORDERED_SLOTS.index(g.start_slot)
        assert not (start < boundary and start + g.duration > boundary)
    assert_valid_solution(snapshot, result)


# ---------------------------------------------------------------------------
# 7. Objective and partial results
# ---------------------------------------------------------------------------


def test_objective_schedules_all_when_feasible():
    """Three sessions, one lecturer, exactly three allowed cells, one room:
    the maximize objective must place all three."""
    sessions = [
        make_session("s-a", "unit-a", "lec-1"),
        make_session("s-b", "unit-b", "lec-1"),
        make_session("s-c", "unit-c", "lec-1"),
    ]
    availability = [
        AvailabilitySnapshot(
            "lec-1",
            unavailable_except(("Monday", "s1"), ("Monday", "s2"), ("Monday", "s3")),
        ),
    ]
    snapshot = build_snapshot_from_data([make_room("r1")], sessions, availability, [])
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 3
    assert result.unscheduled_session_ids == []
    assert_valid_solution(snapshot, result)


def test_partial_result_is_explicit():
    students = tuple(f"stu-{i}" for i in range(200))
    sessions = [
        make_session("s-possible", "unit-a", "lec-1"),
        make_session("s-impossible", "unit-b", "lec-2", student_ids=students),
    ]
    snapshot = build_snapshot_from_data(
        [make_room("r1", capacity=30)], sessions, [], []
    )
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1
    assert result.unscheduled_session_ids == ["s-impossible"]
    assert "Scheduled 1 of 2" in result.message
    assert_valid_solution(snapshot, result)


# ---------------------------------------------------------------------------
# 8. Determinism and input integrity
# ---------------------------------------------------------------------------


def _mixed_snapshot() -> SolverInputSnapshot:
    shared = ("stu-1", "stu-2", "stu-3")
    sessions = [
        make_session("s-a1", "unit-a", "lec-1", duration=2, student_ids=shared),
        make_session("s-a2", "unit-a", "lec-1", duration=1, student_ids=shared),
        make_session("s-b1", "unit-b", "lec-2", duration=3, student_ids=shared[:2]),
        make_session("s-c1", "unit-c", "lec-1", duration=1),
        make_session("s-d1", "unit-d", "lec-3", duration=4),
    ]
    availability = [
        AvailabilitySnapshot("lec-1", frozenset([("Monday", "s1"), ("Tuesday", "s4")])),
        AvailabilitySnapshot("lec-3", frozenset((day, "s1") for day in ORDERED_DAYS)),
    ]
    locked = [LockedAssignment("s-c1", "Monday", "s4", "r1", 1)]
    return build_snapshot_from_data(
        [make_room("r1", capacity=20), make_room("r2", capacity=5)],
        sessions,
        availability,
        locked,
    )


def test_solver_is_deterministic():
    first = solve_timetable(_mixed_snapshot())
    second = solve_timetable(_mixed_snapshot())
    assert first == second
    assert_valid_solution(_mixed_snapshot(), first)


def test_solver_does_not_mutate_input_snapshot():
    snapshot = _mixed_snapshot()
    rooms_before = list(snapshot.rooms)
    sessions_before = list(snapshot.sessions)
    locked_before = list(snapshot.locked_assignments)
    unscheduled_before = list(snapshot.unscheduled_session_ids)
    solve_timetable(snapshot)
    assert snapshot.rooms == rooms_before
    assert snapshot.sessions == sessions_before
    assert snapshot.locked_assignments == locked_before
    assert snapshot.unscheduled_session_ids == unscheduled_before
