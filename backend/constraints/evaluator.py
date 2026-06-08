from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

from constraints.types import ConstraintType, ConstraintViolation, ViolationSeverity

SLOT_ORDER: dict[str, int] = {
    "s1": 0, "s2": 1, "s3": 2,
    "s4": 3, "s5": 4, "s6": 5, "s7": 6,
}
_SLOT_LIST = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]
_AM = frozenset({"s1", "s2", "s3"})
_PM = frozenset({"s4", "s5", "s6", "s7"})


@dataclass(frozen=True)
class AssignmentRecord:
    """Flat data record for a single scheduled assignment.

    Built from joined ORM data before evaluation — no DB calls after construction.
    student_ids is empty for sessions with no enrolled students; those sessions
    produce no student-conflict or capacity violations.
    """

    assignment_id: str
    session_id: str
    room_id: str
    room_capacity: int
    day: str         # "Monday" … "Friday"
    start_slot: str  # "s1" … "s7"
    duration: int    # integer slot spans
    lecturer_id: str
    student_ids: frozenset[str] = field(default_factory=frozenset)


def _slots_used(start: str, duration: int) -> list[str]:
    idx = SLOT_ORDER[start]
    return _SLOT_LIST[idx: idx + duration]


def _overlaps(a: AssignmentRecord, b: AssignmentRecord) -> bool:
    if a.day != b.day:
        return False
    return bool(
        set(_slots_used(a.start_slot, a.duration))
        & set(_slots_used(b.start_slot, b.duration))
    )


def evaluate_timetable(
    assignments: list[AssignmentRecord],
    lecturer_unavailability: dict[str, frozenset[tuple[str, str]]],
) -> list[ConstraintViolation]:
    """Evaluate all v1 hard constraints against a set of scheduled assignments.

    lecturer_unavailability maps lecturer_id -> frozenset of (day, slot) tuples
    marking slots where the lecturer has declared unavailability.

    Unscheduled sessions must not be passed in; they are never constraint violations.
    Sessions with no students produce no student-conflict or capacity violations.
    Does not mutate either argument.
    """
    violations: list[ConstraintViolation] = []

    sorted_assignments = sorted(assignments, key=lambda r: r.assignment_id)

    by_day: dict[str, list[AssignmentRecord]] = {}
    for a in sorted_assignments:
        by_day.setdefault(a.day, []).append(a)

    # Pairwise overlap checks: lecturer, room, and student conflicts
    for day in sorted(by_day):
        for a, b in combinations(by_day[day], 2):
            if not _overlaps(a, b):
                continue

            if a.lecturer_id == b.lecturer_id:
                violations.append(ConstraintViolation(
                    constraint_type=ConstraintType.LECTURER_CONFLICT,
                    severity=ViolationSeverity.ERROR,
                    affected_session_ids=sorted([a.session_id, b.session_id]),
                    affected_lecturer_id=a.lecturer_id,
                    message=f"Lecturer double-booked on {day} at overlapping slots",
                ))

            if a.room_id == b.room_id:
                violations.append(ConstraintViolation(
                    constraint_type=ConstraintType.ROOM_CONFLICT,
                    severity=ViolationSeverity.ERROR,
                    affected_session_ids=sorted([a.session_id, b.session_id]),
                    affected_room_id=a.room_id,
                    message=f"Room double-booked on {day} at overlapping slots",
                ))

            shared_students = a.student_ids & b.student_ids
            if shared_students:
                violations.append(ConstraintViolation(
                    constraint_type=ConstraintType.STUDENT_CONFLICT,
                    severity=ViolationSeverity.ERROR,
                    affected_session_ids=sorted([a.session_id, b.session_id]),
                    affected_student_ids=sorted(shared_students),
                    message=f"Students have overlapping sessions on {day}",
                ))

    # Per-assignment checks: capacity, availability, boundary, lunch
    for a in sorted_assignments:
        slots = _slots_used(a.start_slot, a.duration)
        slot_set = set(slots)

        student_count = len(a.student_ids)
        if student_count > a.room_capacity:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.ROOM_CAPACITY,
                severity=ViolationSeverity.ERROR,
                affected_session_ids=[a.session_id],
                affected_room_id=a.room_id,
                message=(
                    f"Room capacity {a.room_capacity} exceeded "
                    f"by {student_count} students"
                ),
            ))

        unavailable = lecturer_unavailability.get(a.lecturer_id, frozenset())
        bad_slots = [s for s in slots if (a.day, s) in unavailable]
        if bad_slots:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.LECTURER_AVAILABILITY,
                severity=ViolationSeverity.ERROR,
                affected_session_ids=[a.session_id],
                affected_lecturer_id=a.lecturer_id,
                message=(
                    f"Lecturer unavailable on {a.day} at "
                    f"slot{'s' if len(bad_slots) > 1 else ''} "
                    f"{', '.join(bad_slots)}"
                ),
            ))

        end_idx = SLOT_ORDER[a.start_slot] + a.duration
        if end_idx > len(_SLOT_LIST):
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.DURATION_BOUNDARY,
                severity=ViolationSeverity.ERROR,
                affected_session_ids=[a.session_id],
                message=(
                    f"Session extends past the last timetable slot "
                    f"(starts {a.start_slot}, duration {a.duration})"
                ),
            ))
        elif slot_set & _AM and slot_set & _PM:
            violations.append(ConstraintViolation(
                constraint_type=ConstraintType.LUNCH_CROSSING,
                severity=ViolationSeverity.ERROR,
                affected_session_ids=[a.session_id],
                message=(
                    f"Session crosses the lunch break "
                    f"(starts {a.start_slot}, duration {a.duration})"
                ),
            ))

    return violations


def load_and_evaluate(db) -> list[ConstraintViolation]:
    """Load all scheduled assignments from the database and evaluate constraints.

    db: SQLAlchemy Session
    """
    from models.assignment import TimetableAssignment
    from models.lecturer import LecturerAvailability

    db_assignments: list[TimetableAssignment] = db.query(TimetableAssignment).all()

    records: list[AssignmentRecord] = []
    for ta in db_assignments:
        session = ta.session
        unit = session.unit
        records.append(AssignmentRecord(
            assignment_id=ta.id,
            session_id=session.id,
            room_id=ta.room_id,
            room_capacity=ta.room.capacity,
            day=ta.day.value,
            start_slot=ta.start_slot.value,
            duration=session.duration,
            lecturer_id=unit.lecturer_id,
            student_ids=frozenset(s.id for s in unit.students),
        ))

    availability_rows: list[LecturerAvailability] = db.query(LecturerAvailability).all()
    lecturer_unavailability: dict[str, frozenset[tuple[str, str]]] = {}
    tmp: dict[str, set[tuple[str, str]]] = {}
    for row in availability_rows:
        tmp.setdefault(row.lecturer_id, set()).add((row.day.value, row.slot.value))
    lecturer_unavailability = {lid: frozenset(slots) for lid, slots in tmp.items()}

    return evaluate_timetable(records, lecturer_unavailability)
