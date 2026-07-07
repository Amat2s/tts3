"""Deterministic tests for the lecturer-preference soft constraint (Unit 101).

Preferences are the first soft constraint fed into the solver. They must never
reduce the number of sessions the solver can schedule and never reject a feasible
placement; they only bias which feasible arrangement is chosen among otherwise
equally-maximal outcomes.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from solver.model import solve_timetable
from solver.snapshot import build_snapshot_from_data
from solver.types import (
    ORDERED_DAYS,
    ORDERED_SLOTS,
    PreferenceSnapshot,
    RoomSnapshot,
    SessionSnapshot,
    SolverStatus,
)

# ---------------------------------------------------------------------------
# Fixture factories (mirror test_solver.py)
# ---------------------------------------------------------------------------


def make_room(room_id: str, capacity: int = 30, name: str | None = None) -> RoomSnapshot:
    return RoomSnapshot(
        room_id=room_id, name=name or room_id, capacity=capacity, room_type="lecture"
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


def make_pref(
    lecturer_id: str, day: str, slot: str, room_id: str, level: str
) -> PreferenceSnapshot:
    return PreferenceSnapshot(
        lecturer_id=lecturer_id, day=day, slot=slot, room_id=room_id, level=level
    )


def unavailable_except(*allowed: tuple[str, str]) -> frozenset[tuple[str, str]]:
    """All (day, slot) cells unavailable except the given ones."""
    allowed_set = set(allowed)
    return frozenset(
        (day, slot)
        for day in ORDERED_DAYS
        for slot in ORDERED_SLOTS
        if (day, slot) not in allowed_set
    )


def _placement(result, session_id):
    return next(
        g for g in result.generated_assignments if g.session_id == session_id
    )


# ---------------------------------------------------------------------------
# Snapshot carries preference data
# ---------------------------------------------------------------------------


def test_snapshot_includes_and_sorts_preferences():
    prefs = [
        make_pref("lec-1", "Wednesday", "s2", "r2", "avoid"),
        make_pref("lec-1", "Monday", "s1", "r1", "preferred"),
        make_pref("lec-2", "Monday", "s1", "r1", "preferred"),
    ]
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")],
        [make_session("s-a", "unit-a", "lec-1")],
        [],
        [],
        preferences=prefs,
    )
    # All preference rows are carried through verbatim (no integrity dropping).
    assert len(snapshot.preferences) == 3
    # Deterministic ordering: lecturer_id, day, room_id, slot.
    assert [
        (p.lecturer_id, p.day, p.slot, p.room_id) for p in snapshot.preferences
    ] == [
        ("lec-1", "Monday", "s1", "r1"),
        ("lec-1", "Wednesday", "s2", "r2"),
        ("lec-2", "Monday", "s1", "r1"),
    ]


def test_snapshot_preferences_default_empty():
    snapshot = build_snapshot_from_data(
        [make_room("r1")], [make_session("s-a", "unit-a", "lec-1")], [], []
    )
    assert snapshot.preferences == []


# ---------------------------------------------------------------------------
# Preferences bias placement when scheduling count is unaffected
# ---------------------------------------------------------------------------


def test_preferred_cell_is_chosen_when_count_unaffected():
    # One session, two rooms, all days/slots open. A single `preferred` cell is
    # the unique secondary optimum, so the solver must place the session there.
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")],
        [make_session("s-a", "unit-a", "lec-1")],
        [],
        [],
        preferences=[make_pref("lec-1", "Thursday", "s5", "r2", "preferred")],
    )
    result = solve_timetable(snapshot)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 1
    g = _placement(result, "s-a")
    assert (g.day, g.start_slot, g.room_id) == ("Thursday", "s5", "r2")


def test_avoid_cell_is_shunned_when_alternative_exists():
    # Lecturer is only available at two cells in one room; one of them is marked
    # `avoid`. The session must still schedule, choosing the neutral cell.
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1")],
        [
            # available only at Monday s1 and Monday s2
            _avail("lec-1", ("Monday", "s1"), ("Monday", "s2")),
        ],
        [],
        preferences=[make_pref("lec-1", "Monday", "s1", "r1", "avoid")],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    g = _placement(result, "s-a")
    assert (g.day, g.start_slot, g.room_id) == ("Monday", "s2", "r1")


def test_preferred_wins_over_avoid_in_same_room():
    # Both a preferred and an avoid candidate are available; the solver takes the
    # preferred one (net +1 beats net -1).
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1")],
        [_avail("lec-1", ("Monday", "s1"), ("Monday", "s2"))],
        [],
        preferences=[
            make_pref("lec-1", "Monday", "s1", "r1", "avoid"),
            make_pref("lec-1", "Monday", "s2", "r1", "preferred"),
        ],
    )
    result = solve_timetable(snapshot)
    g = _placement(result, "s-a")
    assert (g.day, g.start_slot) == ("Monday", "s2")


# ---------------------------------------------------------------------------
# Preferences never reduce scheduled count / never reject a feasible placement
# ---------------------------------------------------------------------------


def test_avoid_does_not_reject_the_only_feasible_placement():
    # The only feasible cell is marked `avoid`. The session must still be
    # scheduled — preferences carry no feasibility meaning.
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1")],
        [_avail("lec-1", ("Monday", "s1"))],
        [],
        preferences=[make_pref("lec-1", "Monday", "s1", "r1", "avoid")],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 0
    g = _placement(result, "s-a")
    assert (g.day, g.start_slot, g.room_id) == ("Monday", "s1", "r1")


def test_avoid_never_trades_a_scheduled_session_for_a_better_score():
    # Two independent sessions compete for the single feasible room cell, so at
    # most one can be scheduled. That cell is `avoid` for both lecturers; the
    # solver must still schedule one (count dominates the preference penalty).
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [
            make_session("s-a", "unit-a", "lec-1"),
            make_session("s-b", "unit-b", "lec-2"),
        ],
        [
            _avail("lec-1", ("Monday", "s1")),
            _avail("lec-2", ("Monday", "s1")),
        ],
        [],
        preferences=[
            make_pref("lec-1", "Monday", "s1", "r1", "avoid"),
            make_pref("lec-2", "Monday", "s1", "r1", "avoid"),
        ],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1


def test_preferred_optimized_without_reducing_count():
    # Two sessions share a lecturer (conflict → never same time) and one room
    # with two open slots. Both must schedule (count 2); the preferred cell can
    # hold only one of them, so exactly one lands on it and the other stays.
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [
            make_session("s-a", "unit-a", "lec-1"),
            make_session("s-b", "unit-a", "lec-1"),
        ],
        [_avail("lec-1", ("Monday", "s1"), ("Monday", "s2"))],
        [],
        preferences=[make_pref("lec-1", "Monday", "s1", "r1", "preferred")],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 2
    on_preferred = [
        g
        for g in result.generated_assignments
        if (g.day, g.start_slot, g.room_id) == ("Monday", "s1", "r1")
    ]
    assert len(on_preferred) == 1


def test_multislot_session_scores_every_occupied_cell():
    # A duration-2 session earns a preference reward on each occupied slot. With
    # a preferred cell on both s4 and s5, the PM start s4 is chosen over other
    # feasible starts.
    snapshot = build_snapshot_from_data(
        [make_room("r1")],
        [make_session("s-a", "unit-a", "lec-1", duration=2)],
        [],
        [],
        preferences=[
            make_pref("lec-1", "Monday", "s4", "r1", "preferred"),
            make_pref("lec-1", "Monday", "s5", "r1", "preferred"),
        ],
    )
    result = solve_timetable(snapshot)
    g = _placement(result, "s-a")
    assert (g.day, g.start_slot) == ("Monday", "s4")


# ---------------------------------------------------------------------------
# Determinism and no-preference parity
# ---------------------------------------------------------------------------


def test_preferences_do_not_change_objective_without_data():
    # With no preferences, the objective still maximizes count exactly as before.
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")],
        [
            make_session("s-a", "unit-a", "lec-1"),
            make_session("s-b", "unit-b", "lec-2"),
        ],
        [],
        [],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 2


def test_solver_deterministic_with_preferences():
    def build():
        return build_snapshot_from_data(
            [make_room("r1"), make_room("r2")],
            [make_session("s-a", "unit-a", "lec-1")],
            [],
            [],
            preferences=[make_pref("lec-1", "Friday", "s7", "r1", "preferred")],
        )

    r1 = solve_timetable(build())
    r2 = solve_timetable(build())
    assert r1.generated_assignments == r2.generated_assignments


# ---------------------------------------------------------------------------
# Availability helper (kept below to sit near the tests that use it)
# ---------------------------------------------------------------------------

from solver.types import AvailabilitySnapshot  # noqa: E402


def _avail(lecturer_id: str, *allowed: tuple[str, str]) -> AvailabilitySnapshot:
    return AvailabilitySnapshot(
        lecturer_id=lecturer_id, unavailable=unavailable_except(*allowed)
    )
