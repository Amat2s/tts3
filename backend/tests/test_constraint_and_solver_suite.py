"""Unit 51: Backend Constraint and Solver Test Suite.

A cohesive, fixture-driven suite that verifies backend solver correctness
*independently of frontend UX validation*. It exercises the solver-side
constraint mirror, the conflict-graph generation, the solver input snapshot
compiler, the CP-SAT scheduler, async result application, and failure safety.

Design notes (per the Unit 51 spec):

- Fixtures use the same DTO/domain shapes the solver input builder and the
  result-application service consume in production — no frontend draft state and
  no production mock state.
- Assertions check product outcomes (what was scheduled / persisted / rejected),
  except for the pure conflict-graph helper where structural output *is* the
  product.
- Solver runs use an explicit small time limit and the module's deterministic
  settings so results are stable.

The required cases from the spec are each covered below and labelled inline.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# --- Constraint mirror (Unit 40) -------------------------------------------
from constraints.graph import (
    build_conflict_graph,
    check_lecturer_availability,
    check_lunch_crossing,
    check_off_timetable,
    check_room_capacity,
    check_room_double_booking,
    check_student_overlap,
    check_unit_session_overlap,
)
from constraints.types import (
    AssignedSession,
    ConstraintSeverity,
    ConstraintType,
    LecturerInput,
    RoomInput,
    SessionInput,
)

# --- Snapshot builder + CP-SAT solver (Units 41/42) ------------------------
from solver.model import solve_timetable
from solver.snapshot import build_snapshot_from_data
from solver.types import (
    ORDERED_DAYS,
    ORDERED_SLOTS,
    AvailabilitySnapshot,
    GeneratedAssignment,
    LockedAssignment,
    RoomSnapshot,
    SessionSnapshot,
    SolverRunResult,
    SolverStatus,
)

# --- Result application (Unit 43) ------------------------------------------
from models.assignment import TimetableAssignment
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.student import Student, StudentTitle
from models.unit import Unit
from solver.apply import (
    ApplicationStatus,
    SolverResultApplicationError,
    apply_solver_result,
)

# Fast, deterministic time limit for every solver run in this suite.
SOLVE_LIMIT = 10.0


# ===========================================================================
# Fixture factories — minimal, readable, real-format DTOs.
# ===========================================================================


def session_input(
    session_id: str,
    unit_id: str = "unit-a",
    duration: int = 1,
    lecturer_id: str = "lec-1",
    student_ids: tuple[str, ...] = (),
) -> SessionInput:
    return SessionInput(
        session_id=session_id,
        unit_id=unit_id,
        duration=duration,
        lecturer_id=lecturer_id,
        student_ids=frozenset(student_ids),
    )


def assigned(
    session: SessionInput, day: str, start_slot: str, room_id: str = "r1"
) -> AssignedSession:
    return AssignedSession(
        session=session, day=day, start_slot=start_slot, room_id=room_id
    )


def room_snapshot(
    room_id: str, capacity: int = 30, name: str | None = None
) -> RoomSnapshot:
    return RoomSnapshot(
        room_id=room_id, name=name or room_id, capacity=capacity, room_type="lecture"
    )


def session_snapshot(
    session_id: str,
    unit_id: str = "unit-a",
    lecturer_id: str = "lec-1",
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


def only_available(*allowed: tuple[str, str]) -> frozenset[tuple[str, str]]:
    """Mark every (day, slot) unavailable except the listed cells."""
    allowed_set = set(allowed)
    return frozenset(
        (day, slot)
        for day in ORDERED_DAYS
        for slot in ORDERED_SLOTS
        if (day, slot) not in allowed_set
    )


# ===========================================================================
# 1. Constraint mirror — assignment-based checks
#    (lecturer, student, availability, room, capacity, lunch, boundary)
# ===========================================================================


def test_mirror_lecturer_conflict_flagged():
    """Required case: lecturer conflict (same lecturer, overlapping time)."""
    lec_session_a = session_input("s-a", lecturer_id="lec-1")
    lec_session_b = session_input("s-b", unit_id="unit-b", lecturer_id="lec-1")
    from constraints.graph import check_lecturer_overlap

    violations = check_lecturer_overlap(
        [
            assigned(lec_session_a, "Monday", "s1"),
            assigned(lec_session_b, "Monday", "s1", room_id="r2"),
        ]
    )
    assert len(violations) == 1
    v = violations[0]
    assert v.constraint_type == ConstraintType.LECTURER_OVERLAP
    assert v.severity == ConstraintSeverity.WARNING
    assert v.affected_session_ids == ("s-a", "s-b")


def test_mirror_lecturer_conflict_not_flagged_when_disjoint():
    a = session_input("s-a", lecturer_id="lec-1")
    b = session_input("s-b", unit_id="unit-b", lecturer_id="lec-1")
    from constraints.graph import check_lecturer_overlap

    violations = check_lecturer_overlap(
        [assigned(a, "Monday", "s1"), assigned(b, "Monday", "s2")]
    )
    assert violations == []


def test_mirror_student_conflict_flagged():
    """Required case: student conflict (shared student, overlapping time)."""
    a = session_input("s-a", lecturer_id="lec-1", student_ids=("stu-1", "stu-2"))
    b = session_input("s-b", unit_id="unit-b", lecturer_id="lec-2", student_ids=("stu-2",))
    violations = check_student_overlap(
        [assigned(a, "Monday", "s1", "r1"), assigned(b, "Monday", "s1", "r2")]
    )
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.STUDENT_OVERLAP
    assert violations[0].affected_session_ids == ("s-a", "s-b")


def test_mirror_student_conflict_ignores_unshared_students():
    a = session_input("s-a", student_ids=("stu-1",))
    b = session_input("s-b", unit_id="unit-b", lecturer_id="lec-2", student_ids=("stu-9",))
    violations = check_student_overlap(
        [assigned(a, "Monday", "s1", "r1"), assigned(b, "Monday", "s1", "r2")]
    )
    assert violations == []


def test_mirror_lecturer_unavailable_slot_flagged():
    """Required case: lecturer unavailable slot."""
    s = session_input("s-a", lecturer_id="lec-1")
    lecturer = LecturerInput(lecturer_id="lec-1", unavailable=frozenset([("Monday", "s1")]))
    violations = check_lecturer_availability([assigned(s, "Monday", "s1")], [lecturer])
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.LECTURER_AVAILABILITY
    assert violations[0].severity == ConstraintSeverity.WARNING


def test_mirror_lecturer_available_slot_not_flagged():
    s = session_input("s-a", lecturer_id="lec-1")
    lecturer = LecturerInput(lecturer_id="lec-1", unavailable=frozenset([("Tuesday", "s1")]))
    violations = check_lecturer_availability([assigned(s, "Monday", "s1")], [lecturer])
    assert violations == []


def test_mirror_unit_session_overlap_flagged():
    """Required case: unit/session overlap conflict (same unit, overlapping time)."""
    a = session_input("s-a", unit_id="unit-a", lecturer_id="lec-1")
    b = session_input("s-b", unit_id="unit-a", lecturer_id="lec-2", duration=2)
    violations = check_unit_session_overlap(
        [assigned(a, "Monday", "s2", "r1"), assigned(b, "Monday", "s1", "r2")]
    )
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.UNIT_SESSION_OVERLAP
    assert violations[0].unit_id == "unit-a"


def test_mirror_room_double_booking_flagged():
    """Required case: room double-booking."""
    a = session_input("s-a")
    b = session_input("s-b", unit_id="unit-b", lecturer_id="lec-2")
    violations = check_room_double_booking(
        [assigned(a, "Monday", "s1", "r1"), assigned(b, "Monday", "s1", "r1")]
    )
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.ROOM_DOUBLE_BOOKING
    assert violations[0].severity == ConstraintSeverity.BLOCKING
    assert violations[0].room_id == "r1"


def test_mirror_room_double_booking_detects_multislot_overlap():
    """A 2-slot session overlapping a 1-slot session in the same room is caught
    even though their start slots differ."""
    a = session_input("s-a", duration=2)
    b = session_input("s-b", unit_id="unit-b", lecturer_id="lec-2")
    violations = check_room_double_booking(
        [assigned(a, "Monday", "s1", "r1"), assigned(b, "Monday", "s2", "r1")]
    )
    assert len(violations) == 1


def test_mirror_room_capacity_failure_flagged():
    """Required case: room capacity failure."""
    students = tuple(f"stu-{i}" for i in range(40))
    s = session_input("s-a", student_ids=students)
    rooms = [RoomInput(room_id="r1", capacity=10)]
    violations = check_room_capacity([assigned(s, "Monday", "s1", "r1")], rooms)
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.ROOM_CAPACITY
    assert violations[0].severity == ConstraintSeverity.BLOCKING


def test_mirror_room_capacity_ok_when_room_large_enough():
    students = tuple(f"stu-{i}" for i in range(5))
    s = session_input("s-a", student_ids=students)
    rooms = [RoomInput(room_id="r1", capacity=30)]
    assert check_room_capacity([assigned(s, "Monday", "s1", "r1")], rooms) == []


def test_mirror_lunch_crossing_flagged():
    """Required case: duration crossing lunch (AM block ends at s3)."""
    s = session_input("s-a", duration=2)  # s3 -> s4 spans the AM/PM boundary
    violations = check_lunch_crossing([assigned(s, "Monday", "s3")])
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.LUNCH_CROSSING
    assert violations[0].severity == ConstraintSeverity.BLOCKING


def test_mirror_lunch_crossing_not_flagged_within_block():
    s = session_input("s-a", duration=3)  # s1->s3 stays inside the AM block
    assert check_lunch_crossing([assigned(s, "Monday", "s1")]) == []


def test_mirror_off_timetable_boundary_flagged():
    """Required case: duration exceeding available block (runs off the grid)."""
    s = session_input("s-a", duration=2)  # s7 is the last slot; s7+2 runs off
    violations = check_off_timetable([assigned(s, "Monday", "s7")])
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.OFF_TIMETABLE
    assert violations[0].severity == ConstraintSeverity.BLOCKING


def test_mirror_off_timetable_not_flagged_when_fits():
    s = session_input("s-a", duration=1)
    assert check_off_timetable([assigned(s, "Monday", "s7")]) == []


# ===========================================================================
# 2. Conflict graph generation — deterministic structural output
# ===========================================================================


def _graph_pairs(sessions):
    graph = build_conflict_graph(sessions)
    return sorted(
        (tuple(sorted((e.session_a, e.session_b))), e.constraint_type)
        for e in graph.edges
    )


def test_conflict_graph_is_deterministic():
    sessions = [
        session_input("s-a", unit_id="unit-a", lecturer_id="lec-1", student_ids=("p1",)),
        session_input("s-b", unit_id="unit-a", lecturer_id="lec-2", student_ids=("p1",)),
        session_input("s-c", unit_id="unit-b", lecturer_id="lec-1", student_ids=("p9",)),
    ]
    first = _graph_pairs(sessions)
    second = _graph_pairs(sessions)
    assert first == second


def test_conflict_graph_edges_cover_each_category():
    sessions = [
        session_input("s-a", unit_id="unit-a", lecturer_id="lec-1", student_ids=("p1",)),
        session_input("s-b", unit_id="unit-a", lecturer_id="lec-2", student_ids=("p1",)),
    ]
    pairs = _graph_pairs(sessions)
    kinds = {kind for _pair, kind in pairs}
    # s-a/s-b share a unit (unit overlap) and a student (student overlap);
    # they have different lecturers so there is no lecturer-overlap edge.
    assert ConstraintType.UNIT_SESSION_OVERLAP in kinds
    assert ConstraintType.STUDENT_OVERLAP in kinds
    assert ConstraintType.LECTURER_OVERLAP not in kinds


def test_conflict_graph_neighbors_lookup():
    sessions = [
        session_input("s-a", lecturer_id="lec-1"),
        session_input("s-b", unit_id="unit-b", lecturer_id="lec-1"),
    ]
    graph = build_conflict_graph(sessions)
    assert graph.neighbors("s-a") == ["s-b"]
    assert graph.neighbors("s-b") == ["s-a"]


# ===========================================================================
# 3. Snapshot builder — compiles real-format data into solver input
# ===========================================================================


def test_snapshot_builder_compiles_real_format_data():
    rooms = [room_snapshot("r1", capacity=40)]
    sessions = [
        session_snapshot("s-locked", unit_id="unit-a", lecturer_id="lec-1"),
        session_snapshot("s-free", unit_id="unit-a", lecturer_id="lec-1"),
    ]
    availability = [AvailabilitySnapshot("lec-1", frozenset([("Monday", "s1")]))]
    locked = [LockedAssignment("s-locked", "Monday", "s4", "r1", 1)]

    snapshot = build_snapshot_from_data(rooms, sessions, availability, locked)

    # Locked assignment is extracted; only the unscheduled session is to be solved.
    assert snapshot.locked_assignments == locked
    assert snapshot.unscheduled_session_ids == ["s-free"]
    # Same lecturer + same unit yields a lecturer-overlap and a unit-overlap pair.
    assert ("s-free", "s-locked") in [
        tuple(sorted(p)) for p in snapshot.lecturer_conflict_pairs
    ]
    assert ("s-free", "s-locked") in [
        tuple(sorted(p)) for p in snapshot.unit_session_conflict_pairs
    ]
    # Rooms and availability carried through unchanged.
    assert snapshot.rooms == rooms
    assert {a.lecturer_id for a in snapshot.availability} == {"lec-1"}


def test_snapshot_builder_is_deterministic():
    rooms = [room_snapshot("r2"), room_snapshot("r1")]
    sessions = [
        session_snapshot("s-b", unit_id="unit-b"),
        session_snapshot("s-a", unit_id="unit-a"),
    ]
    first = build_snapshot_from_data(rooms, sessions, [], [])
    second = build_snapshot_from_data(rooms, sessions, [], [])
    assert [r.room_id for r in first.rooms] == [r.room_id for r in second.rooms]
    assert first.unscheduled_session_ids == second.unscheduled_session_ids


# ===========================================================================
# 4. CP-SAT scheduling behavior
# ===========================================================================


def _assert_within_grid(g: GeneratedAssignment) -> None:
    assert g.day in ORDERED_DAYS
    assert g.start_slot in ORDERED_SLOTS
    start = ORDERED_SLOTS.index(g.start_slot)
    assert start + g.duration <= len(ORDERED_SLOTS)


def test_solver_schedules_unscheduled_session():
    """Required case: unscheduled session successfully scheduled."""
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1")],
        [session_snapshot("s-a", duration=2)],
        [],
        [],
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 1
    assert result.unscheduled_session_ids == []
    [g] = result.generated_assignments
    assert g.session_id == "s-a"
    assert g.duration == 2
    _assert_within_grid(g)


def test_solver_respects_locked_saved_assignment():
    """Required case: locked scheduled session respected by solver."""
    sessions = [
        session_snapshot("s-locked", unit_id="unit-a", lecturer_id="lec-1", duration=2),
        session_snapshot("s-free", unit_id="unit-b", lecturer_id="lec-2"),
    ]
    locked = [LockedAssignment("s-locked", "Monday", "s1", "r1", 2)]
    snapshot = build_snapshot_from_data([room_snapshot("r1")], sessions, [], locked)
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    # Locked placement is returned unchanged and never re-solved.
    assert result.locked_assignments == locked
    assert all(g.session_id != "s-locked" for g in result.generated_assignments)
    assert "s-locked" not in result.unscheduled_session_ids
    # The free session is still scheduled around the locked occupancy.
    assert result.scheduled_count == 1


def test_solver_room_capacity_failure_leaves_session_unscheduled():
    """Required case: room capacity failure (solver outcome)."""
    students = tuple(f"stu-{i}" for i in range(50))
    snapshot = build_snapshot_from_data(
        [room_snapshot("r-small", capacity=10)],
        [session_snapshot("s-a", student_ids=students)],
        [],
        [],
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 0
    assert result.unscheduled_session_ids == ["s-a"]


def test_solver_never_generates_lunch_crossing_placement():
    """Required case: duration crossing lunch (solver outcome) — a 2-slot
    session is placed entirely inside one block, never across the boundary."""
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1")],
        [session_snapshot("s-a", duration=2)],
        [],
        [],
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    [g] = result.generated_assignments
    start = ORDERED_SLOTS.index(g.start_slot)
    boundary = snapshot.timetable_constants.am_pm_boundary_index
    assert not (start < boundary and start + g.duration > boundary)


def test_solver_duration_exceeding_block_stays_unscheduled():
    """Required case: duration exceeding available block. A 4-slot session whose
    lecturer is unavailable at the only PM-block start (s4) every day cannot fit
    any block (AM is only 3 slots) and stays unscheduled."""
    unavailable = frozenset((day, "s4") for day in ORDERED_DAYS)
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1")],
        [session_snapshot("s-a", duration=4)],
        [AvailabilitySnapshot("lec-1", unavailable)],
        [],
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 0
    assert result.unscheduled_session_ids == ["s-a"]


def test_solver_lecturer_conflict_forces_partial_result():
    """Required case: lecturer conflict (solver outcome). Same lecturer, one
    allowed cell, two free rooms — only one session can be scheduled."""
    sessions = [
        session_snapshot("s-a", unit_id="unit-a", lecturer_id="lec-1"),
        session_snapshot("s-b", unit_id="unit-b", lecturer_id="lec-1"),
    ]
    availability = [AvailabilitySnapshot("lec-1", only_available(("Monday", "s1")))]
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1"), room_snapshot("r2")], sessions, availability, []
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1


def test_solver_student_conflict_forces_partial_result():
    """Required case: student conflict (solver outcome). Different lecturers,
    shared students, one allowed cell, two rooms — only one fits."""
    shared = ("stu-1", "stu-2")
    sessions = [
        session_snapshot("s-a", unit_id="unit-a", lecturer_id="lec-1", student_ids=shared),
        session_snapshot("s-b", unit_id="unit-b", lecturer_id="lec-2", student_ids=shared),
    ]
    availability = [
        AvailabilitySnapshot("lec-1", only_available(("Monday", "s1"))),
        AvailabilitySnapshot("lec-2", only_available(("Monday", "s1"))),
    ]
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1"), room_snapshot("r2")], sessions, availability, []
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1


def test_solver_unit_session_overlap_forces_partial_result():
    """Required case: unit/session overlap conflict (solver outcome)."""
    sessions = [
        session_snapshot("s-a", unit_id="unit-a", lecturer_id="lec-1"),
        session_snapshot("s-b", unit_id="unit-a", lecturer_id="lec-2"),
    ]
    availability = [
        AvailabilitySnapshot("lec-1", only_available(("Monday", "s1"))),
        AvailabilitySnapshot("lec-2", only_available(("Monday", "s1"))),
    ]
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1"), room_snapshot("r2")], sessions, availability, []
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    # Same unit on the same single cell -> unit/session conflict pair -> only one.
    assert result.scheduled_count == 1
    assert result.unscheduled_count == 1


def test_solver_respects_lecturer_unavailable_slot():
    """Required case: lecturer unavailable slot (solver outcome). The lecturer is
    available only at one cell, so the session must land exactly there."""
    availability = [AvailabilitySnapshot("lec-1", only_available(("Friday", "s7")))]
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1")],
        [session_snapshot("s-a", lecturer_id="lec-1")],
        availability,
        [],
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    assert result.scheduled_count == 1
    [g] = result.generated_assignments
    assert (g.day, g.start_slot) == ("Friday", "s7")


def test_solver_partial_result_when_not_all_sessions_fit():
    """Required case: partial solver result when not all sessions fit."""
    students = tuple(f"stu-{i}" for i in range(200))
    sessions = [
        session_snapshot("s-fits", unit_id="unit-a", lecturer_id="lec-1"),
        session_snapshot(
            "s-too-big", unit_id="unit-b", lecturer_id="lec-2", student_ids=students
        ),
    ]
    snapshot = build_snapshot_from_data(
        [room_snapshot("r1", capacity=30)], sessions, [], []
    )
    result = solve_timetable(snapshot, time_limit_seconds=SOLVE_LIMIT)
    assert result.status == SolverStatus.OPTIMAL
    assert result.scheduled_count == 1
    assert result.unscheduled_session_ids == ["s-too-big"]


def test_solver_is_deterministic_across_runs():
    sessions = [
        session_snapshot("s-a", unit_id="unit-a", lecturer_id="lec-1", duration=2),
        session_snapshot("s-b", unit_id="unit-b", lecturer_id="lec-1"),
        session_snapshot("s-c", unit_id="unit-c", lecturer_id="lec-2", duration=3),
    ]
    snapshot_a = build_snapshot_from_data([room_snapshot("r1")], sessions, [], [])
    snapshot_b = build_snapshot_from_data([room_snapshot("r1")], sessions, [], [])
    first = solve_timetable(snapshot_a, time_limit_seconds=SOLVE_LIMIT)
    second = solve_timetable(snapshot_b, time_limit_seconds=SOLVE_LIMIT)
    assert first == second


# ===========================================================================
# 5. Solver result application — persistence of successful assignments
# ===========================================================================


def _seed_unit_with_session(
    db, *, session_id, unit_id, code, lecturer_id, room_id, duration=1, student_ids=()
):
    """Persist a real ORM lecturer/unit/session/room graph for apply tests."""
    lecturer = Lecturer(
        id=lecturer_id,
        title=LecturerTitle.DR,
        first_name="Ada",
        last_name="Lovelace",
    )
    db.add(lecturer)
    unit = Unit(id=unit_id, code=code, name=f"Unit {code}", year_level=1)
    unit.lecturers.append(lecturer)
    for sid in student_ids:
        unit.students.append(
            Student(
                id=sid,
                title=StudentTitle.MX,
                first_name="Stu",
                last_name=sid,
                year_level=1,
            )
        )
    db.add(unit)
    db.add(
        Session(
            id=session_id,
            unit_id=unit_id,
            session_type=SessionType.LECTURE,
            duration=duration,
            lecturer_id=lecturer_id,
        )
    )
    db.add(Room(id=room_id, name=room_id, capacity=30, room_type=RoomType.LECTURE))
    db.commit()


def test_result_application_persists_successful_assignments(db):
    """Required scope: result application persists successful solver assignments."""
    _seed_unit_with_session(
        db,
        session_id="s-a",
        unit_id="unit-a",
        code="HIS101",
        lecturer_id="lec-1",
        room_id="r1",
    )
    result = SolverRunResult(
        status=SolverStatus.OPTIMAL,
        generated_assignments=[GeneratedAssignment("s-a", "Monday", "s1", "r1", 1)],
        locked_assignments=[],
        unscheduled_session_ids=[],
        scheduled_count=1,
        unscheduled_count=0,
        timed_out=False,
        message="Scheduled 1 of 1",
    )

    application = apply_solver_result(db, result)

    assert application.status == ApplicationStatus.APPLIED
    assert application.newly_scheduled_session_ids == ["s-a"]
    # The placement is now a real saved row.
    rows = db.query(TimetableAssignment).all()
    assert len(rows) == 1
    assert rows[0].session_id == "s-a"
    assert rows[0].day == AvailabilityDay("Monday")
    assert rows[0].start_slot == AvailabilitySlot("s1")
    assert rows[0].room_id == "r1"


def test_result_application_partial_persists_only_scheduled(db):
    _seed_unit_with_session(
        db,
        session_id="s-a",
        unit_id="unit-a",
        code="HIS101",
        lecturer_id="lec-1",
        room_id="r1",
    )
    result = SolverRunResult(
        status=SolverStatus.FEASIBLE,
        generated_assignments=[GeneratedAssignment("s-a", "Monday", "s1", "r1", 1)],
        locked_assignments=[],
        unscheduled_session_ids=["s-unplaced"],
        scheduled_count=1,
        unscheduled_count=1,
        timed_out=False,
        message="Scheduled 1 of 2",
    )

    application = apply_solver_result(db, result)

    assert application.status == ApplicationStatus.PARTIAL
    assert application.is_partial is True
    assert application.remaining_unscheduled_session_ids == ["s-unplaced"]
    assert db.query(TimetableAssignment).count() == 1


# ===========================================================================
# 6. Failure safety — a failed run never corrupts saved assignments
# ===========================================================================


def _seed_saved_assignment(db, *, session_id, room_id, day="Monday", start_slot="s1"):
    """Persist one committed (locked) saved assignment plus its dependencies."""
    _seed_unit_with_session(
        db,
        session_id=session_id,
        unit_id=f"unit-{session_id}",
        code=f"COD{session_id[-1]}",
        lecturer_id=f"lec-{session_id}",
        room_id=room_id,
    )
    db.add(
        TimetableAssignment(
            session_id=session_id,
            day=AvailabilityDay(day),
            start_slot=AvailabilitySlot(start_slot),
            room_id=room_id,
        )
    )
    db.commit()


def _snapshot_saved_rows(db):
    return sorted(
        (a.session_id, a.day.value, a.start_slot.value, a.room_id)
        for a in db.query(TimetableAssignment).all()
    )


def test_failed_solver_run_preserves_saved_assignments(db):
    """Required case: failed solver run preserves existing saved assignments.

    An INFEASIBLE result must be rejected and leave the committed saved
    timetable exactly as it was.
    """
    _seed_saved_assignment(db, session_id="s-saved", room_id="r1")
    before = _snapshot_saved_rows(db)

    failed = SolverRunResult(
        status=SolverStatus.INFEASIBLE,
        generated_assignments=[],
        locked_assignments=[],
        unscheduled_session_ids=["s-other"],
        scheduled_count=0,
        unscheduled_count=1,
        timed_out=False,
        message="No solution",
    )

    import pytest

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, failed)
    assert exc.value.code == "solver_failed"

    # Saved state is byte-for-byte unchanged.
    assert _snapshot_saved_rows(db) == before


def test_unknown_status_result_preserves_saved_assignments(db):
    _seed_saved_assignment(db, session_id="s-saved", room_id="r1")
    before = _snapshot_saved_rows(db)

    unknown = SolverRunResult(
        status=SolverStatus.UNKNOWN,
        generated_assignments=[GeneratedAssignment("s-new", "Tuesday", "s2", "r1", 1)],
        locked_assignments=[],
        unscheduled_session_ids=[],
        scheduled_count=1,
        unscheduled_count=0,
        timed_out=True,
        message="Timed out before any solution",
    )

    import pytest

    with pytest.raises(SolverResultApplicationError):
        apply_solver_result(db, unknown)

    # The generated placement was never persisted; nothing new appeared.
    assert _snapshot_saved_rows(db) == before


def test_defensive_rejection_rolls_back_without_corrupting_saved_state(db):
    """A structurally-broken successful result (room double-booking against an
    existing saved row) is rejected and persists nothing new."""
    _seed_saved_assignment(db, session_id="s-saved", room_id="r1")
    # Add a schedulable session that the broken result tries to double-book.
    _seed_unit_with_session(
        db,
        session_id="s-new",
        unit_id="unit-new",
        code="NEW101",
        lecturer_id="lec-new",
        room_id="r2",
    )
    before = _snapshot_saved_rows(db)

    # Generated placement collides with the saved row's cell (Monday/s1/r1).
    broken = SolverRunResult(
        status=SolverStatus.OPTIMAL,
        generated_assignments=[GeneratedAssignment("s-new", "Monday", "s1", "r1", 1)],
        locked_assignments=[],
        unscheduled_session_ids=[],
        scheduled_count=1,
        unscheduled_count=0,
        timed_out=False,
        message="Scheduled 1 of 1",
    )

    import pytest

    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, broken)
    assert exc.value.code == "blocking_integrity_violation"
    assert _snapshot_saved_rows(db) == before
