"""Unit 68: Allocation-based conflict and solver behavior tests.

Verifies that the solver uses session-level lecturers and per-session
allocation data (not unit.students) for all conflict, capacity, and
availability decisions.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from constraints.graph import build_conflict_graph
from constraints.types import (
    ConstraintType,
    SessionInput as ConstraintSessionInput,
)
from models.lecturer import Lecturer, LecturerTitle
from models.session_allocation import SessionStudentAllocation
from models.student import Student
from schemas.session import SessionCreate
from schemas.unit import UnitCreate
from services.session import create_session
from services.unit import create_unit
from solver.model import solve_timetable
from solver.snapshot import (
    SnapshotIntegrityError,
    build_snapshot_from_data,
    build_solver_input_snapshot,
)
from solver.types import (
    ORDERED_DAYS,
    ORDERED_SLOTS,
    AvailabilitySnapshot,
    LockedAssignment,
    RoomSnapshot,
    SessionSnapshot,
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


def make_constraint_session(
    session_id: str,
    unit_id: str,
    lecturer_id: str,
    student_ids: tuple[str, ...] = (),
    duration: int = 1,
) -> ConstraintSessionInput:
    return ConstraintSessionInput(
        session_id=session_id,
        unit_id=unit_id,
        duration=duration,
        lecturer_id=lecturer_id,
        student_ids=frozenset(student_ids),
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


# ---------------------------------------------------------------------------
# 1. Same unit, different session lecturers → no lecturer-conflict edge
# ---------------------------------------------------------------------------


def test_same_unit_different_lecturers_no_lecturer_conflict():
    """Two sessions in the same unit with different session-level lecturers
    must not generate a LECTURER_OVERLAP edge."""
    inputs = [
        make_constraint_session("s-a", "unit-a", "lec-1"),
        make_constraint_session("s-b", "unit-a", "lec-2"),
    ]
    graph = build_conflict_graph(inputs)
    lecturer_edges = [
        e for e in graph.edges
        if e.constraint_type == ConstraintType.LECTURER_OVERLAP
    ]
    assert lecturer_edges == []


# ---------------------------------------------------------------------------
# 2. Two sessions with the same session lecturer → lecturer-conflict edge
# ---------------------------------------------------------------------------


def test_same_session_lecturer_generates_conflict():
    """Two sessions (different units) sharing a session-level lecturer must
    produce exactly one LECTURER_OVERLAP conflict edge."""
    inputs = [
        make_constraint_session("s-a", "unit-a", "lec-1"),
        make_constraint_session("s-b", "unit-b", "lec-1"),
    ]
    graph = build_conflict_graph(inputs)
    lecturer_edges = [
        e for e in graph.edges
        if e.constraint_type == ConstraintType.LECTURER_OVERLAP
    ]
    assert len(lecturer_edges) == 1
    assert {lecturer_edges[0].session_a, lecturer_edges[0].session_b} == {"s-a", "s-b"}


# ---------------------------------------------------------------------------
# 3. Tutorials with disjoint allocated students → no student-conflict edge
# ---------------------------------------------------------------------------


def test_disjoint_tutorial_students_no_student_conflict():
    """Tutorial sessions with entirely disjoint allocated student sets must not
    generate a STUDENT_OVERLAP edge, even when in the same unit."""
    inputs = [
        make_constraint_session("tut-1", "unit-a", "lec-1", student_ids=("stu-1", "stu-2")),
        make_constraint_session("tut-2", "unit-a", "lec-2", student_ids=("stu-3", "stu-4")),
    ]
    graph = build_conflict_graph(inputs)
    student_edges = [
        e for e in graph.edges
        if e.constraint_type == ConstraintType.STUDENT_OVERLAP
    ]
    assert student_edges == []


# ---------------------------------------------------------------------------
# 4. Lecture and tutorial sharing allocated students → student-conflict edge
# ---------------------------------------------------------------------------


def test_lecture_and_tutorial_shared_students_conflict():
    """A lecture (all enrolled students allocated) and a tutorial (subset
    allocated) that share students must produce a STUDENT_OVERLAP edge."""
    all_students = ("stu-1", "stu-2", "stu-3", "stu-4")
    tutorial_group = ("stu-1", "stu-2")
    inputs = [
        make_constraint_session("lec-1", "unit-a", "lec-prof", student_ids=all_students),
        make_constraint_session("tut-1", "unit-a", "tut-ta", student_ids=tutorial_group),
    ]
    graph = build_conflict_graph(inputs)
    student_edges = [
        e for e in graph.edges
        if e.constraint_type == ConstraintType.STUDENT_OVERLAP
    ]
    assert len(student_edges) == 1
    assert {student_edges[0].session_a, student_edges[0].session_b} == {"lec-1", "tut-1"}


# ---------------------------------------------------------------------------
# 5. Room capacity uses tutorial allocation size, not full unit enrollment
# ---------------------------------------------------------------------------


def test_room_capacity_uses_allocation_size_not_full_enrollment():
    """A tutorial with 10 allocated students fits in a 10-capacity room even
    when the unit has more enrolled students. The solver uses student_count
    derived from the allocation, not the total unit roster."""
    tutorial_students = tuple(f"stu-{i}" for i in range(10))
    snapshot = build_snapshot_from_data(
        [make_room("r-small", capacity=10)],
        [make_session(
            "tut-1", "unit-a", "lec-1",
            student_ids=tutorial_students,
            session_type="tutorial",
        )],
        [],
        [],
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 1
    assert result.generated_assignments[0].room_id == "r-small"


# ---------------------------------------------------------------------------
# 6. Disjoint-student tutorials with different lecturers can overlap in time
# ---------------------------------------------------------------------------


def test_disjoint_tutorials_different_lecturers_can_overlap():
    """Two tutorial sessions from the same unit, with disjoint allocated
    students and different session-level lecturers, can be scheduled
    simultaneously in separate rooms (no conflict between them)."""
    group_a = tuple(f"stu-a{i}" for i in range(5))
    group_b = tuple(f"stu-b{i}" for i in range(5))
    sessions = [
        make_session("tut-1", "unit-a", "lec-1", student_ids=group_a, session_type="tutorial"),
        make_session("tut-2", "unit-a", "lec-2", student_ids=group_b, session_type="tutorial"),
    ]
    availability = [
        AvailabilitySnapshot("lec-1", unavailable_except(("Monday", "s1"))),
        AvailabilitySnapshot("lec-2", unavailable_except(("Monday", "s1"))),
    ]
    snapshot = build_snapshot_from_data(
        [make_room("r1"), make_room("r2")], sessions, availability, []
    )
    result = solve_timetable(snapshot)
    assert result.scheduled_count == 2
    assert result.unscheduled_count == 0
    # Both land at Monday s1 (their only available slot) in separate rooms.
    placements = {(g.day, g.start_slot) for g in result.generated_assignments}
    assert placements == {("Monday", "s1")}


# ---------------------------------------------------------------------------
# 7. Solver respects session-level lecturer availability
# ---------------------------------------------------------------------------


def test_solver_respects_session_lecturer_availability():
    """The solver uses the session-level lecturer's availability to restrict
    candidate cells, placing the session only in the one allowed slot."""
    availability = [
        AvailabilitySnapshot("lec-1", unavailable_except(("Wednesday", "s3"))),
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
    assert (generated.day, generated.start_slot) == ("Wednesday", "s3")


# ---------------------------------------------------------------------------
# 8. Locked assignments validated against allocation-derived capacity
# ---------------------------------------------------------------------------


def test_locked_assignment_rejected_by_allocation_capacity():
    """build_snapshot_from_data must raise SnapshotIntegrityError when a locked
    assignment places a session in a room too small for its allocation-derived
    student count."""
    students = tuple(f"stu-{i}" for i in range(20))
    with pytest.raises(SnapshotIntegrityError):
        build_snapshot_from_data(
            [make_room("r-tiny", capacity=5)],
            [make_session("s-a", "unit-a", "lec-1", student_ids=students)],
            [],
            [LockedAssignment("s-a", "Monday", "s1", "r-tiny", 1)],
        )


def test_database_snapshot_uses_session_lecturers_and_allocation_rows(db):
    db.add_all(
        [
            Lecturer(
                id="lec-1",
                title=LecturerTitle.DR,
                first_name="Ada",
                last_name="Lovelace",
            ),
            Lecturer(
                id="lec-2",
                title=LecturerTitle.DR,
                first_name="Grace",
                last_name="Hopper",
            ),
            *[
                Student(
                    id=f"stu-{i}",
                    first_name="Student",
                    last_name=str(i),
                    year_level=1,
                )
                for i in range(4)
            ],
        ]
    )
    db.commit()

    unit = create_unit(
        db,
        UnitCreate(
            code="HIS101",
            name="History",
            lecturer_ids=["lec-1", "lec-2"],
            student_ids=[f"stu-{i}" for i in range(4)],
        ),
    )
    tutorial_a = create_session(
        db,
        unit.id,
        SessionCreate(
            session_type="tutorial",
            duration=1,
            lecturer_id="lec-1",
        ),
    )
    tutorial_b = create_session(
        db,
        unit.id,
        SessionCreate(
            session_type="tutorial",
            duration=1,
            lecturer_id="lec-2",
        ),
    )

    allocated = {
        session_id: {
            row.student_id
            for row in db.query(SessionStudentAllocation).filter(
                SessionStudentAllocation.session_id == session_id
            )
        }
        for session_id in (tutorial_a.id, tutorial_b.id)
    }
    snapshot = build_solver_input_snapshot(db)
    sessions = {session.session_id: session for session in snapshot.sessions}

    assert sessions[tutorial_a.id].lecturer_id == "lec-1"
    assert sessions[tutorial_b.id].lecturer_id == "lec-2"
    assert sessions[tutorial_a.id].student_ids == frozenset(allocated[tutorial_a.id])
    assert sessions[tutorial_b.id].student_ids == frozenset(allocated[tutorial_b.id])
    assert sessions[tutorial_a.id].student_ids.isdisjoint(
        sessions[tutorial_b.id].student_ids
    )
    assert sessions[tutorial_a.id].student_ids | sessions[tutorial_b.id].student_ids == {
        "stu-0",
        "stu-1",
        "stu-2",
        "stu-3",
    }
