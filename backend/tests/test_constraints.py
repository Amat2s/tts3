"""Fixture-based tests for the backend solver constraint mirror."""
import sys
import os

# Allow imports from backend/ root when running pytest from the backend directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from constraints.types import (
    AssignedSession,
    CONSTRAINT_SEVERITY,
    ConstraintSeverity,
    ConstraintType,
    LecturerInput,
    RoomInput,
    SessionInput,
)
from constraints.graph import (
    ConflictGraph,
    build_conflict_graph,
    check_lecturer_availability,
    check_lecturer_overlap,
    check_lunch_crossing,
    check_off_timetable,
    check_room_capacity,
    check_room_double_booking,
    check_student_overlap,
    check_unit_session_overlap,
    compile_assignment_violations,
    derive_lecturer_overlap_conflicts,
    derive_student_overlap_conflicts,
    derive_unit_session_overlap_conflicts,
)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

UNIT_A = "unit-a"
UNIT_B = "unit-b"
LEC_1 = "lec-1"
LEC_2 = "lec-2"
ROOM_LARGE = "room-large"
ROOM_SMALL = "room-small"
STUDENTS = [f"stu-{i}" for i in range(10)]


@pytest.fixture
def session_a1() -> SessionInput:
    """Unit A, lecturer 1, 2-slot lecture, students 0–4."""
    return SessionInput(
        session_id="sess-a1",
        unit_id=UNIT_A,
        duration=2,
        lecturer_id=LEC_1,
        student_ids=frozenset(STUDENTS[:5]),
    )


@pytest.fixture
def session_a2() -> SessionInput:
    """Unit A, lecturer 1, 1-slot tutorial, students 0–4 (same cohort)."""
    return SessionInput(
        session_id="sess-a2",
        unit_id=UNIT_A,
        duration=1,
        lecturer_id=LEC_1,
        student_ids=frozenset(STUDENTS[:5]),
    )


@pytest.fixture
def session_b1() -> SessionInput:
    """Unit B, lecturer 2, 1-slot lecture, students 5–9."""
    return SessionInput(
        session_id="sess-b1",
        unit_id=UNIT_B,
        duration=1,
        lecturer_id=LEC_2,
        student_ids=frozenset(STUDENTS[5:]),
    )


@pytest.fixture
def session_b2() -> SessionInput:
    """Unit B, lecturer 1, 1-slot tutorial — shares lecturer with unit A sessions."""
    return SessionInput(
        session_id="sess-b2",
        unit_id=UNIT_B,
        duration=1,
        lecturer_id=LEC_1,
        student_ids=frozenset(STUDENTS[5:]),
    )


@pytest.fixture
def session_overlap_student() -> SessionInput:
    """Unit B, lecturer 2, overlaps students 3–7 with both cohorts."""
    return SessionInput(
        session_id="sess-overlap",
        unit_id=UNIT_B,
        duration=1,
        lecturer_id=LEC_2,
        student_ids=frozenset(STUDENTS[3:8]),
    )


@pytest.fixture
def room_large() -> RoomInput:
    return RoomInput(room_id=ROOM_LARGE, capacity=30)


@pytest.fixture
def room_small() -> RoomInput:
    return RoomInput(room_id=ROOM_SMALL, capacity=2)


@pytest.fixture
def lecturer_1_unavail() -> LecturerInput:
    """Lecturer 1 is unavailable Monday s1 and s2."""
    return LecturerInput(
        lecturer_id=LEC_1,
        unavailable=frozenset([("Monday", "s1"), ("Monday", "s2")]),
    )


@pytest.fixture
def lecturer_2_no_unavail() -> LecturerInput:
    return LecturerInput(lecturer_id=LEC_2, unavailable=frozenset())


# ---------------------------------------------------------------------------
# Enum and type smoke tests
# ---------------------------------------------------------------------------


def test_constraint_type_values():
    assert ConstraintType.ROOM_DOUBLE_BOOKING == "room_double_booking"
    assert ConstraintType.ROOM_CAPACITY == "room_capacity"
    assert ConstraintType.LUNCH_CROSSING == "lunch_crossing"
    assert ConstraintType.OFF_TIMETABLE == "off_timetable"
    assert ConstraintType.LECTURER_OVERLAP == "lecturer_overlap"
    assert ConstraintType.STUDENT_OVERLAP == "student_overlap"
    assert ConstraintType.UNIT_SESSION_OVERLAP == "unit_session_overlap"
    assert ConstraintType.LECTURER_AVAILABILITY == "lecturer_availability"
    assert len(ConstraintType) == 8


def test_constraint_severity_values():
    assert ConstraintSeverity.BLOCKING == "blocking"
    assert ConstraintSeverity.WARNING == "warning"
    assert len(ConstraintSeverity) == 2


def test_severity_map_blocking_types():
    blocking = {ct for ct, sev in CONSTRAINT_SEVERITY.items() if sev == ConstraintSeverity.BLOCKING}
    assert blocking == {
        ConstraintType.ROOM_DOUBLE_BOOKING,
        ConstraintType.ROOM_CAPACITY,
        ConstraintType.LUNCH_CROSSING,
        ConstraintType.OFF_TIMETABLE,
    }


def test_severity_map_warning_types():
    warning = {ct for ct, sev in CONSTRAINT_SEVERITY.items() if sev == ConstraintSeverity.WARNING}
    assert warning == {
        ConstraintType.LECTURER_OVERLAP,
        ConstraintType.STUDENT_OVERLAP,
        ConstraintType.UNIT_SESSION_OVERLAP,
        ConstraintType.LECTURER_AVAILABILITY,
    }


# ---------------------------------------------------------------------------
# Lecturer overlap conflict derivation
# ---------------------------------------------------------------------------


def test_lecturer_overlap_same_lecturer(session_a1, session_a2):
    edges = derive_lecturer_overlap_conflicts([session_a1, session_a2])
    assert len(edges) == 1
    assert {edges[0].session_a, edges[0].session_b} == {"sess-a1", "sess-a2"}
    assert edges[0].constraint_type == ConstraintType.LECTURER_OVERLAP
    assert edges[0].severity == ConstraintSeverity.WARNING


def test_lecturer_overlap_different_lecturers(session_a1, session_b1):
    edges = derive_lecturer_overlap_conflicts([session_a1, session_b1])
    assert edges == []


def test_lecturer_overlap_three_sessions_same_lecturer(session_a1, session_a2, session_b2):
    """session_b2 also uses LEC_1; expect 3 edges for the 3-session group."""
    edges = derive_lecturer_overlap_conflicts([session_a1, session_a2, session_b2])
    assert len(edges) == 3
    pairs = [{e.session_a, e.session_b} for e in edges]
    assert {"sess-a1", "sess-a2"} in pairs
    assert {"sess-a1", "sess-b2"} in pairs
    assert {"sess-a2", "sess-b2"} in pairs


# ---------------------------------------------------------------------------
# Student overlap conflict derivation
# ---------------------------------------------------------------------------


def test_student_overlap_shared_students(session_a1, session_overlap_student):
    edges = derive_student_overlap_conflicts([session_a1, session_overlap_student])
    assert len(edges) == 1
    assert edges[0].constraint_type == ConstraintType.STUDENT_OVERLAP


def test_student_overlap_no_shared_students(session_a1, session_b1):
    """session_a1 has students 0–4; session_b1 has students 5–9 — no overlap."""
    edges = derive_student_overlap_conflicts([session_a1, session_b1])
    assert edges == []


def test_student_overlap_same_unit_shares_all_students(session_a1, session_a2):
    edges = derive_student_overlap_conflicts([session_a1, session_a2])
    assert len(edges) == 1


# ---------------------------------------------------------------------------
# Unit/session overlap conflict derivation
# ---------------------------------------------------------------------------


def test_unit_session_overlap_same_unit(session_a1, session_a2):
    edges = derive_unit_session_overlap_conflicts([session_a1, session_a2])
    assert len(edges) == 1
    assert edges[0].constraint_type == ConstraintType.UNIT_SESSION_OVERLAP


def test_unit_session_overlap_different_units(session_a1, session_b1):
    edges = derive_unit_session_overlap_conflicts([session_a1, session_b1])
    assert edges == []


# ---------------------------------------------------------------------------
# ConflictGraph
# ---------------------------------------------------------------------------


def test_conflict_graph_neighbors(session_a1, session_a2, session_b1):
    graph = build_conflict_graph([session_a1, session_a2, session_b1])
    # a1 and a2 share lecturer + students + unit → at least one edge
    neighbors_a1 = graph.neighbors("sess-a1")
    assert "sess-a2" in neighbors_a1
    # b1 has a different lecturer and no shared students
    assert "sess-b1" not in neighbors_a1


def test_conflict_graph_conflicts_between(session_a1, session_a2):
    graph = build_conflict_graph([session_a1, session_a2])
    edges = graph.conflicts_between("sess-a1", "sess-a2")
    types = {e.constraint_type for e in edges}
    # same lecturer, same unit, same students → all three conflict types
    assert ConstraintType.LECTURER_OVERLAP in types
    assert ConstraintType.STUDENT_OVERLAP in types
    assert ConstraintType.UNIT_SESSION_OVERLAP in types


def test_conflict_graph_no_edges_for_disjoint_sessions(session_a1, session_b1):
    graph = build_conflict_graph([session_a1, session_b1])
    assert graph.conflicts_between("sess-a1", "sess-b1") == []


# ---------------------------------------------------------------------------
# Room double-booking check
# ---------------------------------------------------------------------------


def test_room_double_booking_detected(session_a1, session_b1):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_b1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
    ]
    violations = check_room_double_booking(assigned)
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.ROOM_DOUBLE_BOOKING
    assert violations[0].severity == ConstraintSeverity.BLOCKING
    assert violations[0].room_id == ROOM_LARGE


def test_room_double_booking_multi_slot_overlap(session_a1, session_b1):
    """session_a1 has duration 2 (s1+s2); placing session_b1 at s2 same room/day conflicts."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_b1, day="Monday", start_slot="s2", room_id=ROOM_LARGE),
    ]
    violations = check_room_double_booking(assigned)
    assert len(violations) == 1
    assert violations[0].slot == "s2"


def test_room_double_booking_different_rooms(session_a1, session_b1):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_b1, day="Monday", start_slot="s1", room_id=ROOM_SMALL),
    ]
    assert check_room_double_booking(assigned) == []


def test_room_double_booking_different_days(session_a1, session_b1):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_b1, day="Tuesday", start_slot="s1", room_id=ROOM_LARGE),
    ]
    assert check_room_double_booking(assigned) == []


# ---------------------------------------------------------------------------
# Room capacity check
# ---------------------------------------------------------------------------


def test_room_capacity_violation(session_a1, room_small):
    """session_a1 has 5 students; room_small has capacity 2."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_SMALL)
    ]
    violations = check_room_capacity(assigned, [room_small])
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.ROOM_CAPACITY
    assert violations[0].severity == ConstraintSeverity.BLOCKING


def test_room_capacity_sufficient(session_a1, room_large):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE)
    ]
    assert check_room_capacity(assigned, [room_large]) == []


# ---------------------------------------------------------------------------
# Lunch crossing check
# ---------------------------------------------------------------------------


def test_lunch_crossing_detected(session_a1):
    """session_a1 duration=2 starting at s3 (index 2) → spans into PM block (index 3+)."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s3", room_id=ROOM_LARGE)
    ]
    violations = check_lunch_crossing(assigned)
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.LUNCH_CROSSING
    assert violations[0].severity == ConstraintSeverity.BLOCKING


def test_lunch_crossing_not_triggered_pm_start(session_a1):
    """A duration-2 session starting at s4 (PM) does not cross lunch."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s4", room_id=ROOM_LARGE)
    ]
    assert check_lunch_crossing(assigned) == []


def test_lunch_crossing_not_triggered_fits_in_am(session_b1):
    """A duration-1 session at s3 ends at s3 — stays within AM."""
    assigned = [
        AssignedSession(session=session_b1, day="Monday", start_slot="s3", room_id=ROOM_LARGE)
    ]
    assert check_lunch_crossing(assigned) == []


# ---------------------------------------------------------------------------
# Off-timetable check
# ---------------------------------------------------------------------------


def test_off_timetable_detected(session_a1):
    """duration=2 starting at s7 (index 6) → extends to index 8, off the 7-slot grid."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s7", room_id=ROOM_LARGE)
    ]
    violations = check_off_timetable(assigned)
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.OFF_TIMETABLE
    assert violations[0].severity == ConstraintSeverity.BLOCKING


def test_off_timetable_fits(session_a1):
    """duration=2 starting at s6 (index 5) → occupies s6+s7 (indices 5–6), within grid."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s6", room_id=ROOM_LARGE)
    ]
    assert check_off_timetable(assigned) == []


# ---------------------------------------------------------------------------
# Lecturer overlap check (assignment-based)
# ---------------------------------------------------------------------------


def test_lecturer_overlap_assignment_detected(session_a1, session_a2):
    """Both sessions share LEC_1 and overlap at Monday/s1."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_a2, day="Monday", start_slot="s1", room_id=ROOM_SMALL),
    ]
    violations = check_lecturer_overlap(assigned)
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.LECTURER_OVERLAP
    assert violations[0].severity == ConstraintSeverity.WARNING
    assert violations[0].lecturer_id == LEC_1


def test_lecturer_overlap_different_days_no_violation(session_a1, session_a2):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_a2, day="Tuesday", start_slot="s1", room_id=ROOM_SMALL),
    ]
    assert check_lecturer_overlap(assigned) == []


def test_lecturer_overlap_non_overlapping_slots(session_a1, session_a2):
    """a1 duration=2 at s1 occupies s1+s2; a2 at s3 (no overlap)."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_a2, day="Monday", start_slot="s3", room_id=ROOM_SMALL),
    ]
    assert check_lecturer_overlap(assigned) == []


# ---------------------------------------------------------------------------
# Student overlap check (assignment-based)
# ---------------------------------------------------------------------------


def test_student_overlap_assignment_detected(session_a1, session_overlap_student):
    """a1 has students 0–4; overlap_student has students 3–7 — share 3,4."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(
            session=session_overlap_student, day="Monday", start_slot="s1", room_id=ROOM_SMALL
        ),
    ]
    violations = check_student_overlap(assigned)
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.STUDENT_OVERLAP
    assert violations[0].severity == ConstraintSeverity.WARNING


def test_student_overlap_no_shared_students(session_a1, session_b1):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_b1, day="Monday", start_slot="s1", room_id=ROOM_SMALL),
    ]
    assert check_student_overlap(assigned) == []


def test_student_overlap_different_days(session_a1, session_overlap_student):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(
            session=session_overlap_student, day="Tuesday", start_slot="s1", room_id=ROOM_SMALL
        ),
    ]
    assert check_student_overlap(assigned) == []


# ---------------------------------------------------------------------------
# Unit/session overlap check (assignment-based)
# ---------------------------------------------------------------------------


def test_unit_session_overlap_assignment_detected(session_a1, session_a2):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s4", room_id=ROOM_LARGE),
        AssignedSession(session=session_a2, day="Monday", start_slot="s4", room_id=ROOM_SMALL),
    ]
    violations = check_unit_session_overlap(assigned)
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.UNIT_SESSION_OVERLAP
    assert violations[0].unit_id == UNIT_A


def test_unit_session_overlap_different_units(session_a1, session_b1):
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s4", room_id=ROOM_LARGE),
        AssignedSession(session=session_b1, day="Monday", start_slot="s4", room_id=ROOM_SMALL),
    ]
    assert check_unit_session_overlap(assigned) == []


def test_unit_session_overlap_non_overlapping_slots(session_a1, session_a2):
    """a1 duration=2 at s1 occupies s1+s2; a2 at s4 — no time overlap."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_a2, day="Monday", start_slot="s4", room_id=ROOM_SMALL),
    ]
    assert check_unit_session_overlap(assigned) == []


# ---------------------------------------------------------------------------
# Lecturer availability check
# ---------------------------------------------------------------------------


def test_lecturer_availability_violation(session_a1, lecturer_1_unavail):
    """LEC_1 is unavailable Monday s1/s2; a1 duration=2 at s1 covers both."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_LARGE)
    ]
    violations = check_lecturer_availability(assigned, [lecturer_1_unavail])
    assert len(violations) == 1
    assert violations[0].constraint_type == ConstraintType.LECTURER_AVAILABILITY
    assert violations[0].severity == ConstraintSeverity.WARNING
    assert violations[0].lecturer_id == LEC_1


def test_lecturer_availability_no_violation(session_a1, lecturer_1_unavail):
    """LEC_1 unavailable Monday s1/s2; session placed Tuesday s1 — no conflict."""
    assigned = [
        AssignedSession(session=session_a1, day="Tuesday", start_slot="s1", room_id=ROOM_LARGE)
    ]
    assert check_lecturer_availability(assigned, [lecturer_1_unavail]) == []


def test_lecturer_availability_unknown_lecturer_ignored(
    session_b1, lecturer_1_unavail, lecturer_2_no_unavail
):
    """session_b1 uses LEC_2 which has no unavailability — no violation."""
    assigned = [
        AssignedSession(session=session_b1, day="Monday", start_slot="s1", room_id=ROOM_LARGE)
    ]
    assert check_lecturer_availability(assigned, [lecturer_1_unavail, lecturer_2_no_unavail]) == []


# ---------------------------------------------------------------------------
# compile_assignment_violations integration
# ---------------------------------------------------------------------------


def test_compile_violations_clean_timetable(
    session_a1, session_b1, room_large, lecturer_1_unavail, lecturer_2_no_unavail
):
    """Two sessions on separate days, separate rooms — no violations.
    session_a1 uses LEC_1 (unavailable Monday s1/s2), so place it Wednesday."""
    assigned = [
        AssignedSession(session=session_a1, day="Wednesday", start_slot="s1", room_id=ROOM_LARGE),
        AssignedSession(session=session_b1, day="Tuesday", start_slot="s4", room_id=ROOM_LARGE),
    ]
    violations = compile_assignment_violations(
        assigned, [room_large], [lecturer_1_unavail, lecturer_2_no_unavail]
    )
    assert violations == []


def test_compile_violations_multiple_issues(
    session_a1, session_b1, room_small, lecturer_1_unavail, lecturer_2_no_unavail
):
    """Capacity failure + room double-booking in one call."""
    assigned = [
        AssignedSession(session=session_a1, day="Monday", start_slot="s1", room_id=ROOM_SMALL),
        AssignedSession(session=session_b1, day="Monday", start_slot="s1", room_id=ROOM_SMALL),
    ]
    violations = compile_assignment_violations(
        assigned, [room_small], [lecturer_1_unavail, lecturer_2_no_unavail]
    )
    types = {v.constraint_type for v in violations}
    assert ConstraintType.ROOM_DOUBLE_BOOKING in types
    assert ConstraintType.ROOM_CAPACITY in types
