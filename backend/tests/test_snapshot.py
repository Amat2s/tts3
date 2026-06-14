"""Fixture-based tests for the solver input snapshot builder (Unit 41)."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from solver.types import (
    ORDERED_DAYS,
    ORDERED_SLOTS,
    AM_SLOTS,
    PM_SLOTS,
    AvailabilitySnapshot,
    LockedAssignment,
    RoomSnapshot,
    SessionSnapshot,
    SolverInputSnapshot,
    TIMETABLE_CONSTANTS,
)
from solver.snapshot import SnapshotIntegrityError, build_snapshot_from_data

# ---------------------------------------------------------------------------
# Shared fixture constants
# ---------------------------------------------------------------------------

ROOM_LARGE = "room-large"
ROOM_SMALL = "room-small"
UNIT_X = "unit-x"
UNIT_Y = "unit-y"
SESSION_X1 = "sess-x1"
SESSION_X2 = "sess-x2"
SESSION_Y1 = "sess-y1"
LEC_1 = "lec-1"
LEC_2 = "lec-2"
STUDENTS = [f"stu-{i}" for i in range(8)]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def room_large() -> RoomSnapshot:
    return RoomSnapshot(room_id=ROOM_LARGE, name="Lecture Hall A", capacity=100, room_type="lecture")


@pytest.fixture
def room_small() -> RoomSnapshot:
    return RoomSnapshot(room_id=ROOM_SMALL, name="Tutorial Room B", capacity=10, room_type="tutorial")


@pytest.fixture
def session_x1() -> SessionSnapshot:
    """HIS101 lecture — 2 slots, 4 students, taught by LEC_1."""
    return SessionSnapshot(
        session_id=SESSION_X1,
        unit_id=UNIT_X,
        unit_code="HIS101",
        unit_name="Ancient History",
        session_type="lecture",
        duration=2,
        lecturer_id=LEC_1,
        student_ids=frozenset(STUDENTS[:4]),
        student_count=4,
    )


@pytest.fixture
def session_x2() -> SessionSnapshot:
    """HIS101 tutorial — 1 slot, 4 students, taught by LEC_1."""
    return SessionSnapshot(
        session_id=SESSION_X2,
        unit_id=UNIT_X,
        unit_code="HIS101",
        unit_name="Ancient History",
        session_type="tutorial",
        duration=1,
        lecturer_id=LEC_1,
        student_ids=frozenset(STUDENTS[:4]),
        student_count=4,
    )


@pytest.fixture
def session_y1() -> SessionSnapshot:
    """MAT201 lecture — 1 slot, 4 students (overlapping with x), taught by LEC_2."""
    return SessionSnapshot(
        session_id=SESSION_Y1,
        unit_id=UNIT_Y,
        unit_code="MAT201",
        unit_name="Mathematics II",
        session_type="lecture",
        duration=1,
        lecturer_id=LEC_2,
        student_ids=frozenset(STUDENTS[2:6]),
        student_count=4,
    )


@pytest.fixture
def avail_lec1() -> AvailabilitySnapshot:
    return AvailabilitySnapshot(
        lecturer_id=LEC_1,
        unavailable=frozenset([("Monday", "s1"), ("Friday", "s7")]),
    )


@pytest.fixture
def avail_lec2() -> AvailabilitySnapshot:
    return AvailabilitySnapshot(
        lecturer_id=LEC_2,
        unavailable=frozenset(),
    )


# ---------------------------------------------------------------------------
# 1. DTOs / dataclasses exist and are importable
# ---------------------------------------------------------------------------


def test_dto_types_importable() -> None:
    assert RoomSnapshot is not None
    assert SessionSnapshot is not None
    assert AvailabilitySnapshot is not None
    assert LockedAssignment is not None
    assert SolverInputSnapshot is not None


def test_room_snapshot_fields(room_large: RoomSnapshot) -> None:
    assert room_large.room_id == ROOM_LARGE
    assert room_large.name == "Lecture Hall A"
    assert room_large.capacity == 100
    assert room_large.room_type == "lecture"


def test_session_snapshot_fields(session_x1: SessionSnapshot) -> None:
    assert session_x1.session_id == SESSION_X1
    assert session_x1.unit_code == "HIS101"
    assert session_x1.unit_name == "Ancient History"
    assert session_x1.session_type == "lecture"
    assert session_x1.duration == 2
    assert session_x1.lecturer_id == LEC_1
    assert session_x1.student_count == 4


def test_locked_assignment_fields() -> None:
    a = LockedAssignment(
        session_id=SESSION_X1,
        day="Monday",
        start_slot="s1",
        room_id=ROOM_LARGE,
        duration=2,
    )
    assert a.session_id == SESSION_X1
    assert a.day == "Monday"
    assert a.start_slot == "s1"
    assert a.room_id == ROOM_LARGE
    assert a.duration == 2


# ---------------------------------------------------------------------------
# 2. Timetable constants use Monday-Friday and s1-s7 only
# ---------------------------------------------------------------------------


def test_timetable_constants_days() -> None:
    assert list(TIMETABLE_CONSTANTS.days) == ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def test_timetable_constants_slots() -> None:
    assert list(TIMETABLE_CONSTANTS.slots) == ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]


def test_timetable_constants_am_slots() -> None:
    assert list(TIMETABLE_CONSTANTS.am_slots) == ["s1", "s2", "s3"]


def test_timetable_constants_pm_slots() -> None:
    assert list(TIMETABLE_CONSTANTS.pm_slots) == ["s4", "s5", "s6", "s7"]


def test_timetable_constants_am_pm_boundary() -> None:
    assert TIMETABLE_CONSTANTS.am_pm_boundary_index == 3


def test_timetable_constants_lunch_gap() -> None:
    assert TIMETABLE_CONSTANTS.lunch_gap is True


def test_snapshot_carries_timetable_constants(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x1], [avail_lec1], [])
    assert snap.timetable_constants is TIMETABLE_CONSTANTS
    assert "Monday" in snap.timetable_constants.days
    assert "s1" in snap.timetable_constants.slots


# ---------------------------------------------------------------------------
# 3. Snapshot builder populates all collections from input data
# ---------------------------------------------------------------------------


def test_snapshot_rooms(
    room_large: RoomSnapshot,
    room_small: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large, room_small], [session_x1], [avail_lec1], [])
    room_ids = {r.room_id for r in snap.rooms}
    assert ROOM_LARGE in room_ids
    assert ROOM_SMALL in room_ids


def test_snapshot_sessions(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [])
    ids = {s.session_id for s in snap.sessions}
    assert SESSION_X1 in ids
    assert SESSION_X2 in ids


def test_snapshot_availability(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
    avail_lec2: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x1], [avail_lec1, avail_lec2], [])
    lec_ids = {a.lecturer_id for a in snap.availability}
    assert LEC_1 in lec_ids
    assert LEC_2 in lec_ids

    lec1_avail = next(a for a in snap.availability if a.lecturer_id == LEC_1)
    assert ("Monday", "s1") in lec1_avail.unavailable


# ---------------------------------------------------------------------------
# 4. Saved assignments become locked solver inputs
# ---------------------------------------------------------------------------


def test_saved_assignment_becomes_locked(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    assignment = LockedAssignment(
        session_id=SESSION_X1, day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=2
    )
    snap = build_snapshot_from_data([room_large], [session_x1], [avail_lec1], [assignment])

    assert len(snap.locked_assignments) == 1
    locked = snap.locked_assignments[0]
    assert locked.session_id == SESSION_X1
    assert locked.day == "Monday"
    assert locked.start_slot == "s1"
    assert locked.room_id == ROOM_LARGE
    assert locked.duration == 2


def test_no_assignments_means_no_locked(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x1], [avail_lec1], [])
    assert snap.locked_assignments == []


# ---------------------------------------------------------------------------
# 5. Sessions without saved assignments become solver variables (unscheduled)
# ---------------------------------------------------------------------------


def test_unscheduled_session_ids_all_when_no_assignments(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [])
    assert set(snap.unscheduled_session_ids) == {SESSION_X1, SESSION_X2}


def test_unscheduled_excludes_locked_session(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    assignment = LockedAssignment(
        session_id=SESSION_X1, day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=2
    )
    snap = build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [assignment])
    assert SESSION_X1 not in snap.unscheduled_session_ids
    assert SESSION_X2 in snap.unscheduled_session_ids


def test_all_sessions_locked_means_empty_unscheduled(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    assignments = [
        LockedAssignment(session_id=SESSION_X1, day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=2),
        LockedAssignment(session_id=SESSION_X2, day="Tuesday", start_slot="s4", room_id=ROOM_LARGE, duration=1),
    ]
    snap = build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], assignments)
    assert snap.unscheduled_session_ids == []


# ---------------------------------------------------------------------------
# 6. Conflict graph from Unit 40 is included
# ---------------------------------------------------------------------------


def test_lecturer_conflict_pairs_same_lecturer(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # session_x1 and session_x2 share LEC_1 → should produce a lecturer conflict pair.
    snap = build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [])
    pair = tuple(sorted([SESSION_X1, SESSION_X2]))
    assert pair in snap.lecturer_conflict_pairs


def test_student_conflict_pairs_shared_students(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_y1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
    avail_lec2: AvailabilitySnapshot,
) -> None:
    # session_x1 (STUDENTS 0-3) and session_y1 (STUDENTS 2-5) share STUDENTS 2 and 3.
    snap = build_snapshot_from_data(
        [room_large], [session_x1, session_y1], [avail_lec1, avail_lec2], []
    )
    pair = tuple(sorted([SESSION_X1, SESSION_Y1]))
    assert pair in snap.student_conflict_pairs


def test_unit_session_conflict_pairs_same_unit(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # Post-v1 (Unit 68): unit/session overlap is not generated as an active
    # conflict edge. unit_session_conflict_pairs is always empty for post-v1 data.
    snap = build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [])
    assert snap.unit_session_conflict_pairs == []


def test_no_conflict_between_different_units_and_lecturers(
    room_large: RoomSnapshot,
    session_y1: SessionSnapshot,
    avail_lec2: AvailabilitySnapshot,
) -> None:
    # Single session — no pairs possible.
    snap = build_snapshot_from_data([room_large], [session_y1], [avail_lec2], [])
    assert snap.lecturer_conflict_pairs == []
    assert snap.student_conflict_pairs == []
    assert snap.unit_session_conflict_pairs == []


# ---------------------------------------------------------------------------
# 7. Snapshot ordering is deterministic
# ---------------------------------------------------------------------------


def test_rooms_sorted_by_name(
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    room_z = RoomSnapshot(room_id="room-z", name="Zeta Room", capacity=50)
    room_a = RoomSnapshot(room_id="room-a", name="Alpha Room", capacity=50)
    snap = build_snapshot_from_data([room_z, room_a], [session_x1], [avail_lec1], [])
    assert snap.rooms[0].name == "Alpha Room"
    assert snap.rooms[1].name == "Zeta Room"


def test_sessions_sorted_by_unit_code_then_type_order(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    session_y1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
    avail_lec2: AvailabilitySnapshot,
) -> None:
    # Insert in reverse order; output should be HIS101/lecture, HIS101/tutorial, MAT201/lecture.
    snap = build_snapshot_from_data(
        [room_large],
        [session_y1, session_x2, session_x1],
        [avail_lec1, avail_lec2],
        [],
    )
    types = [s.session_type for s in snap.sessions]
    codes = [s.unit_code for s in snap.sessions]
    assert codes[0] == "HIS101"
    assert types[0] == "lecture"
    assert codes[1] == "HIS101"
    assert types[1] == "tutorial"
    assert codes[2] == "MAT201"


def test_availability_sorted_by_lecturer_id(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
    avail_lec2: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x1], [avail_lec2, avail_lec1], [])
    ids = [a.lecturer_id for a in snap.availability]
    assert ids == sorted(ids)


def test_assignments_sorted_by_day_room_slot(
    room_large: RoomSnapshot,
    room_small: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    a_wed = LockedAssignment(session_id=SESSION_X1, day="Wednesday", start_slot="s1", room_id=ROOM_LARGE, duration=2)
    a_mon = LockedAssignment(session_id=SESSION_X2, day="Monday", start_slot="s4", room_id=ROOM_SMALL, duration=1)
    snap = build_snapshot_from_data(
        [room_large, room_small],
        [session_x1, session_x2],
        [avail_lec1],
        [a_wed, a_mon],
    )
    assert snap.locked_assignments[0].day == "Monday"
    assert snap.locked_assignments[1].day == "Wednesday"


def test_unscheduled_session_ids_sorted(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x2, session_x1], [avail_lec1], [])
    assert snap.unscheduled_session_ids == sorted(snap.unscheduled_session_ids)


def test_conflict_pairs_sorted(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    snap = build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [])
    assert snap.lecturer_conflict_pairs == sorted(snap.lecturer_conflict_pairs)
    assert snap.unit_session_conflict_pairs == sorted(snap.unit_session_conflict_pairs)


# ---------------------------------------------------------------------------
# 8. Defensive integrity checks
# ---------------------------------------------------------------------------


def test_rejects_assignment_missing_session(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    ghost = LockedAssignment(
        session_id="ghost-session", day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=1
    )
    with pytest.raises(SnapshotIntegrityError, match="missing session"):
        build_snapshot_from_data([room_large], [session_x1], [avail_lec1], [ghost])


def test_rejects_assignment_missing_room(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    bad_room = LockedAssignment(
        session_id=SESSION_X1, day="Monday", start_slot="s1", room_id="ghost-room", duration=2
    )
    with pytest.raises(SnapshotIntegrityError, match="missing room"):
        build_snapshot_from_data([room_large], [session_x1], [avail_lec1], [bad_room])


def test_rejects_invalid_start_slot(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    bad_slot = LockedAssignment(
        session_id=SESSION_X1, day="Monday", start_slot="s9", room_id=ROOM_LARGE, duration=1
    )
    with pytest.raises(SnapshotIntegrityError, match="invalid start slot"):
        build_snapshot_from_data([room_large], [session_x1], [avail_lec1], [bad_slot])


def test_rejects_assignment_crossing_lunch(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # s3 + duration 2 → spans AM slot s3 and PM slot s4 (crosses lunch boundary at index 3).
    lunch_cross = LockedAssignment(
        session_id=SESSION_X1, day="Monday", start_slot="s3", room_id=ROOM_LARGE, duration=2
    )
    with pytest.raises(SnapshotIntegrityError, match="crosses the lunch boundary"):
        build_snapshot_from_data([room_large], [session_x1], [avail_lec1], [lunch_cross])


def test_rejects_assignment_off_timetable(
    room_large: RoomSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # s7 (index 6) + duration 2 → extends to index 8, beyond the 7-slot grid.
    session_long = SessionSnapshot(
        session_id=SESSION_X2,
        unit_id=UNIT_X,
        unit_code="HIS101",
        unit_name="Ancient History",
        session_type="tutorial",
        duration=2,
        lecturer_id=LEC_1,
        student_ids=frozenset(STUDENTS[:4]),
        student_count=4,
    )
    off_end = LockedAssignment(
        session_id=SESSION_X2, day="Monday", start_slot="s7", room_id=ROOM_LARGE, duration=2
    )
    with pytest.raises(SnapshotIntegrityError, match="beyond the last timetable slot"):
        build_snapshot_from_data([room_large], [session_long], [avail_lec1], [off_end])


def test_rejects_room_capacity_below_student_count(
    room_small: RoomSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # room_small has capacity 10; session has 20 students.
    big_session = SessionSnapshot(
        session_id=SESSION_X1,
        unit_id=UNIT_X,
        unit_code="HIS101",
        unit_name="Ancient History",
        session_type="lecture",
        duration=1,
        lecturer_id=LEC_1,
        student_ids=frozenset(f"stu-{i}" for i in range(20)),
        student_count=20,
    )
    over_capacity = LockedAssignment(
        session_id=SESSION_X1, day="Monday", start_slot="s1", room_id=ROOM_SMALL, duration=1
    )
    with pytest.raises(SnapshotIntegrityError, match="room capacity"):
        build_snapshot_from_data([room_small], [big_session], [avail_lec1], [over_capacity])


def test_rejects_room_double_booking(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # Both sessions assigned to the same room at the same time.
    a1 = LockedAssignment(session_id=SESSION_X1, day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=1)
    a2 = LockedAssignment(session_id=SESSION_X2, day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=1)
    with pytest.raises(SnapshotIntegrityError, match="double-booking"):
        build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [a1, a2])


def test_rejects_room_double_booking_multi_slot_overlap(
    room_large: RoomSnapshot,
    session_x1: SessionSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # session_x1 starts at s1 with duration 2 (occupies s1, s2).
    # session_x2 starts at s2 with duration 1 (occupies s2) → overlaps at s2.
    a1 = LockedAssignment(session_id=SESSION_X1, day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=2)
    a2 = LockedAssignment(session_id=SESSION_X2, day="Monday", start_slot="s2", room_id=ROOM_LARGE, duration=1)
    with pytest.raises(SnapshotIntegrityError, match="double-booking"):
        build_snapshot_from_data([room_large], [session_x1, session_x2], [avail_lec1], [a1, a2])


# ---------------------------------------------------------------------------
# 9. Valid edge cases accepted
# ---------------------------------------------------------------------------


def test_empty_snapshot_builds_without_error() -> None:
    snap = build_snapshot_from_data([], [], [], [])
    assert snap.rooms == []
    assert snap.sessions == []
    assert snap.availability == []
    assert snap.locked_assignments == []
    assert snap.unscheduled_session_ids == []
    assert snap.lecturer_conflict_pairs == []


def test_pm_only_assignment_accepted(
    room_large: RoomSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    pm_assign = LockedAssignment(
        session_id=SESSION_X2, day="Tuesday", start_slot="s4", room_id=ROOM_LARGE, duration=1
    )
    snap = build_snapshot_from_data([room_large], [session_x2], [avail_lec1], [pm_assign])
    assert len(snap.locked_assignments) == 1


def test_am_assignment_does_not_cross_lunch_accepted(
    room_large: RoomSnapshot,
    session_x2: SessionSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    # s2 + duration 1 stays fully within AM block.
    am_assign = LockedAssignment(
        session_id=SESSION_X2, day="Wednesday", start_slot="s2", room_id=ROOM_LARGE, duration=1
    )
    snap = build_snapshot_from_data([room_large], [session_x2], [avail_lec1], [am_assign])
    assert len(snap.locked_assignments) == 1


def test_session_without_students_accepted(
    room_large: RoomSnapshot,
    avail_lec1: AvailabilitySnapshot,
) -> None:
    no_students = SessionSnapshot(
        session_id=SESSION_X1,
        unit_id=UNIT_X,
        unit_code="HIS101",
        unit_name="Ancient History",
        session_type="lecture",
        duration=1,
        lecturer_id=LEC_1,
        student_ids=frozenset(),
        student_count=0,
    )
    assign = LockedAssignment(
        session_id=SESSION_X1, day="Monday", start_slot="s1", room_id=ROOM_LARGE, duration=1
    )
    snap = build_snapshot_from_data([room_large], [no_students], [avail_lec1], [assign])
    assert len(snap.locked_assignments) == 1
