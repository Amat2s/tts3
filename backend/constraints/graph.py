from dataclasses import dataclass, field

from constraints.types import (
    AssignedSession,
    ConstraintSeverity,
    ConstraintType,
    LecturerInput,
    RoomInput,
    SessionInput,
    SolverConstraint,
)

# Ordered slot IDs matching the frontend timetable (s1–s7, no lunch slot).
ORDERED_SLOTS: list[str] = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]

# AM block: s1, s2, s3 (indices 0–2). PM block: s4–s7 (indices 3–6).
_AM_SLOT_COUNT = 3


def _slot_index(slot: str) -> int:
    return ORDERED_SLOTS.index(slot)


def _occupied_slots(start_slot: str, duration: int) -> list[str]:
    idx = _slot_index(start_slot)
    return ORDERED_SLOTS[idx : idx + duration]


def _ranges_overlap(start_a: str, dur_a: int, start_b: str, dur_b: int) -> bool:
    return bool(set(_occupied_slots(start_a, dur_a)) & set(_occupied_slots(start_b, dur_b)))


# ---------------------------------------------------------------------------
# Structural conflict graph — session pairs that the solver must not co-schedule
# ---------------------------------------------------------------------------


@dataclass
class ConflictEdge:
    """Undirected edge between two sessions in the conflict graph."""
    session_a: str
    session_b: str
    constraint_type: ConstraintType
    severity: ConstraintSeverity


@dataclass
class ConflictGraph:
    """Undirected graph of session-pair conflicts for solver input compilation."""
    edges: list[ConflictEdge] = field(default_factory=list)

    def neighbors(self, session_id: str) -> list[str]:
        """Return IDs of all sessions that conflict with `session_id`."""
        result: list[str] = []
        for edge in self.edges:
            if edge.session_a == session_id:
                result.append(edge.session_b)
            elif edge.session_b == session_id:
                result.append(edge.session_a)
        return result

    def conflicts_between(self, session_a: str, session_b: str) -> list[ConflictEdge]:
        """Return all edges connecting the two sessions."""
        pair = {session_a, session_b}
        return [e for e in self.edges if {e.session_a, e.session_b} == pair]


def derive_lecturer_overlap_conflicts(sessions: list[SessionInput]) -> list[ConflictEdge]:
    """Return one edge per pair of sessions taught by the same lecturer."""
    by_lecturer: dict[str, list[SessionInput]] = {}
    for s in sessions:
        by_lecturer.setdefault(s.lecturer_id, []).append(s)

    edges: list[ConflictEdge] = []
    for group in by_lecturer.values():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                edges.append(
                    ConflictEdge(
                        session_a=group[i].session_id,
                        session_b=group[j].session_id,
                        constraint_type=ConstraintType.LECTURER_OVERLAP,
                        severity=ConstraintSeverity.WARNING,
                    )
                )
    return edges


def derive_student_overlap_conflicts(sessions: list[SessionInput]) -> list[ConflictEdge]:
    """Return one edge per pair of sessions that share at least one enrolled student."""
    edges: list[ConflictEdge] = []
    for i in range(len(sessions)):
        for j in range(i + 1, len(sessions)):
            a, b = sessions[i], sessions[j]
            if a.student_ids & b.student_ids:
                edges.append(
                    ConflictEdge(
                        session_a=a.session_id,
                        session_b=b.session_id,
                        constraint_type=ConstraintType.STUDENT_OVERLAP,
                        severity=ConstraintSeverity.WARNING,
                    )
                )
    return edges


def derive_unit_session_overlap_conflicts(sessions: list[SessionInput]) -> list[ConflictEdge]:
    """Return one edge per pair of sessions belonging to the same unit."""
    by_unit: dict[str, list[SessionInput]] = {}
    for s in sessions:
        by_unit.setdefault(s.unit_id, []).append(s)

    edges: list[ConflictEdge] = []
    for group in by_unit.values():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                edges.append(
                    ConflictEdge(
                        session_a=group[i].session_id,
                        session_b=group[j].session_id,
                        constraint_type=ConstraintType.UNIT_SESSION_OVERLAP,
                        severity=ConstraintSeverity.WARNING,
                    )
                )
    return edges


def build_conflict_graph(sessions: list[SessionInput]) -> ConflictGraph:
    """Build the full structural conflict graph from session metadata."""
    edges: list[ConflictEdge] = []
    edges.extend(derive_lecturer_overlap_conflicts(sessions))
    edges.extend(derive_student_overlap_conflicts(sessions))
    edges.extend(derive_unit_session_overlap_conflicts(sessions))
    return ConflictGraph(edges=edges)


# ---------------------------------------------------------------------------
# Assignment-based violation checks
# ---------------------------------------------------------------------------


def check_room_double_booking(
    assigned: list[AssignedSession],
) -> list[SolverConstraint]:
    """Return a violation for every room/day/slot occupied by more than one session."""
    occupied: dict[tuple[str, str, str], str] = {}
    seen_pairs: set[frozenset[str]] = set()
    violations: list[SolverConstraint] = []

    for a in assigned:
        for slot in _occupied_slots(a.start_slot, a.session.duration):
            key = (a.day, a.room_id, slot)
            if key in occupied:
                pair: frozenset[str] = frozenset([a.session.session_id, occupied[key]])
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    violations.append(
                        SolverConstraint(
                            constraint_type=ConstraintType.ROOM_DOUBLE_BOOKING,
                            severity=ConstraintSeverity.BLOCKING,
                            affected_session_ids=tuple(sorted(pair)),
                            room_id=a.room_id,
                            day=a.day,
                            slot=slot,
                        )
                    )
            else:
                occupied[key] = a.session.session_id

    return violations


def check_room_capacity(
    assigned: list[AssignedSession],
    rooms: list[RoomInput],
) -> list[SolverConstraint]:
    """Return a violation for every session placed in an undersized room."""
    room_map = {r.room_id: r for r in rooms}
    violations: list[SolverConstraint] = []

    for a in assigned:
        room = room_map.get(a.room_id)
        if room and room.capacity < len(a.session.student_ids):
            violations.append(
                SolverConstraint(
                    constraint_type=ConstraintType.ROOM_CAPACITY,
                    severity=ConstraintSeverity.BLOCKING,
                    affected_session_ids=(a.session.session_id,),
                    room_id=a.room_id,
                )
            )

    return violations


def check_lunch_crossing(assigned: list[AssignedSession]) -> list[SolverConstraint]:
    """Return a violation for every session that straddles the AM/PM lunch boundary."""
    violations: list[SolverConstraint] = []

    for a in assigned:
        idx = _slot_index(a.start_slot)
        if idx < _AM_SLOT_COUNT and idx + a.session.duration > _AM_SLOT_COUNT:
            violations.append(
                SolverConstraint(
                    constraint_type=ConstraintType.LUNCH_CROSSING,
                    severity=ConstraintSeverity.BLOCKING,
                    affected_session_ids=(a.session.session_id,),
                    day=a.day,
                    slot=a.start_slot,
                )
            )

    return violations


def check_off_timetable(assigned: list[AssignedSession]) -> list[SolverConstraint]:
    """Return a violation for every session that extends past the final timetable slot."""
    violations: list[SolverConstraint] = []

    for a in assigned:
        if _slot_index(a.start_slot) + a.session.duration > len(ORDERED_SLOTS):
            violations.append(
                SolverConstraint(
                    constraint_type=ConstraintType.OFF_TIMETABLE,
                    severity=ConstraintSeverity.BLOCKING,
                    affected_session_ids=(a.session.session_id,),
                    day=a.day,
                    slot=a.start_slot,
                )
            )

    return violations


def check_lecturer_overlap(
    assigned: list[AssignedSession],
) -> list[SolverConstraint]:
    """Return a warning for every pair of simultaneously-assigned sessions sharing a lecturer."""
    by_day_lecturer_slot: dict[tuple[str, str, str], str] = {}
    seen_pairs: set[frozenset[str]] = set()
    violations: list[SolverConstraint] = []

    for a in assigned:
        for slot in _occupied_slots(a.start_slot, a.session.duration):
            key = (a.day, a.session.lecturer_id, slot)
            if key in by_day_lecturer_slot:
                pair: frozenset[str] = frozenset(
                    [a.session.session_id, by_day_lecturer_slot[key]]
                )
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    violations.append(
                        SolverConstraint(
                            constraint_type=ConstraintType.LECTURER_OVERLAP,
                            severity=ConstraintSeverity.WARNING,
                            affected_session_ids=tuple(sorted(pair)),
                            lecturer_id=a.session.lecturer_id,
                            day=a.day,
                            slot=slot,
                        )
                    )
            else:
                by_day_lecturer_slot[key] = a.session.session_id

    return violations


def check_student_overlap(
    assigned: list[AssignedSession],
) -> list[SolverConstraint]:
    """Return a warning for every pair of same-day overlapping sessions sharing a student."""
    seen_pairs: set[frozenset[str]] = set()
    violations: list[SolverConstraint] = []

    for i in range(len(assigned)):
        for j in range(i + 1, len(assigned)):
            a, b = assigned[i], assigned[j]
            if a.day != b.day:
                continue
            shared = a.session.student_ids & b.session.student_ids
            if not shared:
                continue
            if not _ranges_overlap(
                a.start_slot, a.session.duration, b.start_slot, b.session.duration
            ):
                continue
            pair: frozenset[str] = frozenset([a.session.session_id, b.session.session_id])
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                violations.append(
                    SolverConstraint(
                        constraint_type=ConstraintType.STUDENT_OVERLAP,
                        severity=ConstraintSeverity.WARNING,
                        affected_session_ids=tuple(sorted(pair)),
                        day=a.day,
                    )
                )

    return violations


def check_unit_session_overlap(
    assigned: list[AssignedSession],
) -> list[SolverConstraint]:
    """Return a warning for every pair of same-unit sessions overlapping on the same day."""
    seen_pairs: set[frozenset[str]] = set()
    violations: list[SolverConstraint] = []

    for i in range(len(assigned)):
        for j in range(i + 1, len(assigned)):
            a, b = assigned[i], assigned[j]
            if a.session.unit_id != b.session.unit_id:
                continue
            if a.day != b.day:
                continue
            if not _ranges_overlap(
                a.start_slot, a.session.duration, b.start_slot, b.session.duration
            ):
                continue
            pair: frozenset[str] = frozenset([a.session.session_id, b.session.session_id])
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                violations.append(
                    SolverConstraint(
                        constraint_type=ConstraintType.UNIT_SESSION_OVERLAP,
                        severity=ConstraintSeverity.WARNING,
                        affected_session_ids=tuple(sorted(pair)),
                        unit_id=a.session.unit_id,
                        day=a.day,
                    )
                )

    return violations


def check_lecturer_availability(
    assigned: list[AssignedSession],
    lecturers: list[LecturerInput],
) -> list[SolverConstraint]:
    """Return a warning for every session placed in a lecturer's marked-unavailable slot."""
    lecturer_map = {lec.lecturer_id: lec for lec in lecturers}
    violations: list[SolverConstraint] = []

    for a in assigned:
        lec = lecturer_map.get(a.session.lecturer_id)
        if not lec:
            continue
        for slot in _occupied_slots(a.start_slot, a.session.duration):
            if (a.day, slot) in lec.unavailable:
                violations.append(
                    SolverConstraint(
                        constraint_type=ConstraintType.LECTURER_AVAILABILITY,
                        severity=ConstraintSeverity.WARNING,
                        affected_session_ids=(a.session.session_id,),
                        lecturer_id=a.session.lecturer_id,
                        day=a.day,
                        slot=slot,
                    )
                )
                break  # report once per session

    return violations


def compile_assignment_violations(
    assigned: list[AssignedSession],
    rooms: list[RoomInput],
    lecturers: list[LecturerInput],
) -> list[SolverConstraint]:
    """Compile all constraint violations for a given assignment set."""
    violations: list[SolverConstraint] = []
    violations.extend(check_room_double_booking(assigned))
    violations.extend(check_room_capacity(assigned, rooms))
    violations.extend(check_lunch_crossing(assigned))
    violations.extend(check_off_timetable(assigned))
    violations.extend(check_lecturer_overlap(assigned))
    violations.extend(check_student_overlap(assigned))
    violations.extend(check_unit_session_overlap(assigned))
    violations.extend(check_lecturer_availability(assigned, lecturers))
    return violations
