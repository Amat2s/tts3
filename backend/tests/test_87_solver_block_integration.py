"""Tests for Unit 87: solver and backend defensive timetable-block integration.

Timetable blocks are a hard constraint. These tests cover the four backend
surfaces the spec touches:

1. Constraint mirror — ``timetable_slot_blocked`` exists with ``blocking`` severity.
2. Solver snapshot — blocked cells are carried (``BlockedCellSnapshot``), built
   deterministically, and a saved assignment overlapping a block fails snapshot
   integrity (``SnapshotIntegrityError``), including through the DB loader and
   the async job's structured failure path.
3. CP-SAT model — no candidate is created for a blocked cell; the solver
   schedules around blocks and returns partial when a block makes a session
   impossible.
4. Result application — a generated placement overlapping a block is defensively
   rejected and saved state is preserved.
5. Assignment save service — saving an assignment overlapping a block is
   rejected with ``assignment_overlaps_timetable_block``.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from constraints.types import (
    CONSTRAINT_SEVERITY,
    ConstraintSeverity,
    ConstraintType,
)
from models.assignment import TimetableAssignment
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.timetable_block import (
    BlockColour,
    TimetableBlockCell,
    TimetableBlockGroup,
)
from models.unit import Unit
from schemas.assignment import AssignmentItem, AssignmentSaveRequest
from schemas.timetable_block import BlockCellInput, TimetableBlockCreate
from services.assignment import save_assignments
from services.timetable_block import create_timetable_block
from solver.apply import SolverResultApplicationError, apply_solver_result
from solver.job import SolverJobPayload, SolverJobStatus, run_solver_job
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
    BlockedCellSnapshot,
    GeneratedAssignment,
    LockedAssignment,
    RoomSnapshot,
    SessionSnapshot,
    SolverRunResult,
    SolverStatus,
)


# ---------------------------------------------------------------------------
# Pure snapshot/solver fixture helpers (ORM-detached)
# ---------------------------------------------------------------------------


def room(room_id: str, capacity: int = 30) -> RoomSnapshot:
    return RoomSnapshot(room_id=room_id, name=room_id, capacity=capacity, room_type="lecture")


def session(session_id: str, lecturer_id: str = "lec1", duration: int = 1) -> SessionSnapshot:
    return SessionSnapshot(
        session_id=session_id,
        unit_id="unit1",
        unit_code="HIS101",
        unit_name="History",
        session_type="lecture",
        duration=duration,
        lecturer_id=lecturer_id,
        student_ids=frozenset(),
        student_count=0,
    )


def unavailable_except(*allowed: tuple[str, str]) -> frozenset[tuple[str, str]]:
    allowed_set = set(allowed)
    return frozenset(
        (day, slot)
        for day in ORDERED_DAYS
        for slot in ORDERED_SLOTS
        if (day, slot) not in allowed_set
    )


def blocked(day: str, slot: str, room_id: str, *, name: str | None = None) -> BlockedCellSnapshot:
    return BlockedCellSnapshot(
        day=day,
        slot=slot,
        room_id=room_id,
        block_group_id="bg1",
        block_name=name,
    )


# ---------------------------------------------------------------------------
# DB fixture builders (mirror test_84_timetable_blocks)
# ---------------------------------------------------------------------------


def make_room(db, room_id="room1", capacity=100) -> Room:
    r = Room(id=room_id, name=room_id, capacity=capacity, room_type=RoomType.LECTURE)
    db.add(r)
    db.commit()
    return r


def make_unit(db, unit_id="unit1", code="HIS101") -> Unit:
    u = Unit(id=unit_id, code=code, name="History", year_level=1)
    db.add(u)
    db.commit()
    return u


def make_lecturer(db, lecturer_id="lec1") -> Lecturer:
    lec = Lecturer(
        id=lecturer_id, title=LecturerTitle.DR, first_name="Ada", last_name="Lovelace"
    )
    db.add(lec)
    db.commit()
    return lec


def make_session(db, unit, lecturer, session_id="sess1", duration=1) -> Session:
    s = Session(
        id=session_id,
        unit_id=unit.id,
        session_type=SessionType.LECTURE,
        duration=duration,
        lecturer_id=lecturer.id,
    )
    db.add(s)
    db.commit()
    return s


def make_assignment(
    db,
    session,
    room_obj,
    *,
    assignment_id="asg1",
    day=AvailabilityDay.MONDAY,
    start_slot=AvailabilitySlot.S1,
) -> TimetableAssignment:
    a = TimetableAssignment(
        id=assignment_id,
        session_id=session.id,
        day=day,
        start_slot=start_slot,
        room_id=room_obj.id,
    )
    db.add(a)
    db.commit()
    return a


def insert_block_directly(
    db, *, room_id, day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1, name=None, colour=None
) -> TimetableBlockGroup:
    """Insert a block group + cell straight through the ORM.

    Bypasses the block service so a saved assignment overlapping the cell is NOT
    auto-unscheduled — letting us reproduce the impossible at-rest state the
    snapshot/job integrity guard defends against.
    """
    group = TimetableBlockGroup(name=name, colour=colour)
    db.add(group)
    db.flush()
    db.add(
        TimetableBlockCell(
            block_group_id=group.id, day=day, slot=slot, room_id=room_id
        )
    )
    db.commit()
    return group


# ---------------------------------------------------------------------------
# 1. Constraint mirror
# ---------------------------------------------------------------------------


def test_constraint_mirror_includes_timetable_slot_blocked():
    assert ConstraintType.TIMETABLE_SLOT_BLOCKED.value == "timetable_slot_blocked"
    assert (
        CONSTRAINT_SEVERITY[ConstraintType.TIMETABLE_SLOT_BLOCKED]
        == ConstraintSeverity.BLOCKING
    )


# ---------------------------------------------------------------------------
# 2. Snapshot carries blocked cells (pure)
# ---------------------------------------------------------------------------


def test_snapshot_includes_blocked_cells():
    snap = build_snapshot_from_data(
        [room("r1")],
        [session("s1")],
        [],
        [],
        [blocked("Monday", "s1", "r1", name="Chapel")],
    )
    assert len(snap.blocked_cells) == 1
    bc = snap.blocked_cells[0]
    assert (bc.day, bc.slot, bc.room_id) == ("Monday", "s1", "r1")
    assert bc.block_name == "Chapel"


def test_snapshot_blocked_cells_default_empty():
    snap = build_snapshot_from_data([room("r1")], [session("s1")], [], [])
    assert snap.blocked_cells == []


def test_snapshot_blocked_cells_sorted_deterministically():
    cells = [
        blocked("Tuesday", "s2", "r2"),
        blocked("Monday", "s5", "r1"),
        blocked("Monday", "s1", "r1"),
    ]
    snap = build_snapshot_from_data([room("r1"), room("r2")], [session("s1")], [], [], cells)
    ordered = [(b.day, b.room_id, b.slot) for b in snap.blocked_cells]
    assert ordered == [
        ("Monday", "r1", "s1"),
        ("Monday", "r1", "s5"),
        ("Tuesday", "r2", "s2"),
    ]


# ---------------------------------------------------------------------------
# 3. Saved assignment overlapping a block cannot be solver input (pure)
# ---------------------------------------------------------------------------


def test_saved_assignment_overlapping_block_rejected():
    locked = LockedAssignment(
        session_id="s1", day="Monday", start_slot="s1", room_id="r1", duration=1
    )
    with pytest.raises(SnapshotIntegrityError, match="overlaps a timetable block"):
        build_snapshot_from_data(
            [room("r1")],
            [session("s1")],
            [],
            [locked],
            [blocked("Monday", "s1", "r1")],
        )


def test_saved_multislot_assignment_overlapping_block_rejected():
    # Session occupies s1, s2, s3; only s3 is blocked → still overlaps.
    locked = LockedAssignment(
        session_id="s1", day="Monday", start_slot="s1", room_id="r1", duration=3
    )
    with pytest.raises(SnapshotIntegrityError, match="overlaps a timetable block"):
        build_snapshot_from_data(
            [room("r1")],
            [session("s1", duration=3)],
            [],
            [locked],
            [blocked("Monday", "s3", "r1")],
        )


def test_saved_assignment_in_other_cell_accepted():
    locked = LockedAssignment(
        session_id="s1", day="Monday", start_slot="s1", room_id="r1", duration=1
    )
    # Block a different slot, and the same slot in a different room → no overlap.
    snap = build_snapshot_from_data(
        [room("r1"), room("r2")],
        [session("s1")],
        [],
        [locked],
        [blocked("Monday", "s5", "r1"), blocked("Monday", "s1", "r2")],
    )
    assert len(snap.locked_assignments) == 1
    assert len(snap.blocked_cells) == 2


# ---------------------------------------------------------------------------
# 4. Solver creates no blocked candidate / schedules around / partial (pure)
# ---------------------------------------------------------------------------


def test_solver_schedules_around_blocked_cell():
    # Only Monday s1 and Monday s2 are available; block Monday s1 in the one
    # room → the only feasible candidate left is Monday s2.
    snap = build_snapshot_from_data(
        [room("r1")],
        [session("s1")],
        [AvailabilitySnapshot("lec1", unavailable_except(("Monday", "s1"), ("Monday", "s2")))],
        [],
        [blocked("Monday", "s1", "r1")],
    )
    result = solve_timetable(snap)
    assert result.scheduled_count == 1
    placed = result.generated_assignments[0]
    assert (placed.day, placed.start_slot, placed.room_id) == ("Monday", "s2", "r1")


def test_solver_creates_no_candidate_for_blocked_cell():
    # Full availability but block Monday s1 in r1; no generated placement may
    # ever occupy the blocked cell.
    snap = build_snapshot_from_data(
        [room("r1")],
        [session(f"s{i}") for i in range(3)],
        [AvailabilitySnapshot("lec1", frozenset())],
        [],
        [blocked("Monday", "s1", "r1")],
    )
    result = solve_timetable(snap)
    for g in result.generated_assignments:
        assert (g.day, g.start_slot, g.room_id) != ("Monday", "s1", "r1")


def test_solver_returns_partial_when_block_makes_session_impossible():
    # The lecturer's only available cell is Monday s1; blocking it leaves the
    # session unschedulable → partial result.
    snap = build_snapshot_from_data(
        [room("r1")],
        [session("s1")],
        [AvailabilitySnapshot("lec1", unavailable_except(("Monday", "s1")))],
        [],
        [blocked("Monday", "s1", "r1")],
    )
    result = solve_timetable(snap)
    assert result.scheduled_count == 0
    assert result.unscheduled_count == 1
    assert result.unscheduled_session_ids == ["s1"]


# ---------------------------------------------------------------------------
# 5. DB snapshot loader (integration)
# ---------------------------------------------------------------------------


def test_db_loader_includes_blocked_cells(db):
    make_room(db, "room1")
    create_timetable_block(
        db,
        TimetableBlockCreate(
            name="Chapel",
            colour=BlockColour.GOLD,
            cells=[BlockCellInput(day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1, room_id="room1")],
        ),
    )
    snap = build_solver_input_snapshot(db)
    assert len(snap.blocked_cells) == 1
    bc = snap.blocked_cells[0]
    assert (bc.day, bc.slot, bc.room_id) == ("Monday", "s1", "room1")
    assert bc.block_name == "Chapel"


def test_db_loader_rejects_saved_assignment_over_block(db):
    room_obj = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    sess = make_session(db, unit, lec, duration=1)
    make_assignment(db, sess, room_obj, start_slot=AvailabilitySlot.S1)
    # Insert the block directly so the assignment is NOT auto-unscheduled.
    insert_block_directly(db, room_id="room1", slot=AvailabilitySlot.S1)

    with pytest.raises(SnapshotIntegrityError, match="overlaps a timetable block"):
        build_solver_input_snapshot(db)


# ---------------------------------------------------------------------------
# 6. Result application rejects blocked generated assignments (integration)
# ---------------------------------------------------------------------------


def _feasible_result(generated: list[GeneratedAssignment]) -> SolverRunResult:
    return SolverRunResult(
        status=SolverStatus.OPTIMAL,
        generated_assignments=generated,
        locked_assignments=[],
        unscheduled_session_ids=[],
        scheduled_count=len(generated),
        unscheduled_count=0,
        timed_out=False,
        message="test",
    )


def test_apply_rejects_generated_assignment_overlapping_block(db):
    room_obj = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    sess = make_session(db, unit, lec, duration=1)
    create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[BlockCellInput(day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1, room_id="room1")]
        ),
    )

    result = _feasible_result(
        [GeneratedAssignment(session_id=sess.id, day="Monday", start_slot="s1", room_id="room1", duration=1)]
    )
    with pytest.raises(SolverResultApplicationError) as exc:
        apply_solver_result(db, result)
    assert exc.value.code == "assignment_overlaps_timetable_block"
    # Defensive rejection rolls back before any write — no assignment persisted.
    assert db.query(TimetableAssignment).count() == 0


def test_apply_preserves_saved_state_on_block_violation(db):
    room_obj = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    locked_sess = make_session(db, unit, lec, session_id="locked", duration=1)
    gen_sess = make_session(db, unit, lec, session_id="gen", duration=1)
    # A locked saved assignment in a non-blocked cell that must survive.
    make_assignment(db, locked_sess, room_obj, assignment_id="locked-asg", start_slot=AvailabilitySlot.S5)
    create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[BlockCellInput(day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1, room_id="room1")]
        ),
    )

    result = _feasible_result(
        [GeneratedAssignment(session_id=gen_sess.id, day="Monday", start_slot="s1", room_id="room1", duration=1)]
    )
    with pytest.raises(SolverResultApplicationError):
        apply_solver_result(db, result)

    remaining = db.query(TimetableAssignment).all()
    assert [a.id for a in remaining] == ["locked-asg"]


# ---------------------------------------------------------------------------
# 7. Assignment save defensive rejection (integration)
# ---------------------------------------------------------------------------


def _save_item(session_id, room_id="room1", day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1):
    return AssignmentItem(session_id=session_id, day=day, start_slot=slot, room_id=room_id)


def test_save_rejects_assignment_overlapping_block(db):
    make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    sess = make_session(db, unit, lec, duration=1)
    create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[BlockCellInput(day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1, room_id="room1")]
        ),
    )

    with pytest.raises(AppError) as exc:
        save_assignments(db, AssignmentSaveRequest(assignments=[_save_item(sess.id)]))
    assert exc.value.code == "assignment_overlaps_timetable_block"
    assert db.query(TimetableAssignment).count() == 0


def test_save_rejects_multislot_assignment_overlapping_block(db):
    make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    # Session runs s2, s3; only s3 is blocked → overlaps via duration expansion.
    sess = make_session(db, unit, lec, duration=2)
    create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[BlockCellInput(day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S3, room_id="room1")]
        ),
    )

    with pytest.raises(AppError) as exc:
        save_assignments(
            db,
            AssignmentSaveRequest(assignments=[_save_item(sess.id, slot=AvailabilitySlot.S2)]),
        )
    assert exc.value.code == "assignment_overlaps_timetable_block"


def test_save_allows_assignment_not_overlapping_block(db):
    make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    sess = make_session(db, unit, lec, duration=1)
    # Block a different slot in the same room.
    create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[BlockCellInput(day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S5, room_id="room1")]
        ),
    )

    saved = save_assignments(db, AssignmentSaveRequest(assignments=[_save_item(sess.id)]))
    assert len(saved) == 1
    assert db.query(TimetableAssignment).count() == 1


def test_save_allows_assignment_in_unblocked_room(db):
    make_room(db, "roomA")
    make_room(db, "roomB")
    unit = make_unit(db)
    lec = make_lecturer(db)
    sess = make_session(db, unit, lec, duration=1)
    # Block roomB at Monday s1; the assignment is in roomA → allowed.
    create_timetable_block(
        db,
        TimetableBlockCreate(
            cells=[BlockCellInput(day=AvailabilityDay.MONDAY, slot=AvailabilitySlot.S1, room_id="roomB")]
        ),
    )

    saved = save_assignments(
        db, AssignmentSaveRequest(assignments=[_save_item(sess.id, room_id="roomA")])
    )
    assert len(saved) == 1


# ---------------------------------------------------------------------------
# 8. Solver job fails safely on a block-overlapping saved assignment
# ---------------------------------------------------------------------------


def test_solver_job_fails_safely_when_saved_assignment_overlaps_block(db):
    room_obj = make_room(db, "room1")
    unit = make_unit(db)
    lec = make_lecturer(db)
    sess = make_session(db, unit, lec, duration=1)
    make_assignment(db, sess, room_obj, start_slot=AvailabilitySlot.S1)
    insert_block_directly(db, room_id="room1", slot=AvailabilitySlot.S1)

    result = run_solver_job(
        db, SolverJobPayload(solver_run_id="run1", correlation_id="corr1")
    )
    assert result.status == SolverJobStatus.FAILED
    assert result.failure_code == "snapshot_integrity"
    # Saved state untouched — the overlapping assignment is preserved.
    assert db.query(TimetableAssignment).count() == 1
