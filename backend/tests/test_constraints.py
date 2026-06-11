"""Tests for backend/constraints — conflict graph helpers and evaluator.

Run from the backend/ directory:
    python -m pytest tests/test_constraints.py
  or:
    python tests/test_constraints.py
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from constraints.conflict_graph import (
    ConflictEdge,
    SessionNode,
    build_lecturer_conflict_graph,
    build_student_conflict_graph,
)
from constraints.evaluator import AssignmentRecord, evaluate_timetable
from constraints.types import ConstraintType, ConstraintViolation, ViolationSeverity

# Real-format fixture IDs
LEC_A = "11111111-aaaa-0000-0000-000000000001"
LEC_B = "11111111-bbbb-0000-0000-000000000002"
STU_1 = "22222222-1111-0000-0000-000000000001"
STU_2 = "22222222-2222-0000-0000-000000000002"
STU_3 = "22222222-3333-0000-0000-000000000003"
SES_1 = "33333333-1111-0000-0000-000000000001"
SES_2 = "33333333-2222-0000-0000-000000000002"
SES_3 = "33333333-3333-0000-0000-000000000003"
ROM_1 = "44444444-1111-0000-0000-000000000001"
ROM_2 = "44444444-2222-0000-0000-000000000002"
ASN_1 = "55555555-1111-0000-0000-000000000001"
ASN_2 = "55555555-2222-0000-0000-000000000002"
ASN_3 = "55555555-3333-0000-0000-000000000003"


class TestConstraintTypes(unittest.TestCase):
    def test_all_constraint_types_defined(self):
        expected = {
            "lecturer_conflict",
            "student_conflict",
            "room_conflict",
            "room_capacity",
            "lecturer_availability",
            "duration_boundary",
            "lunch_crossing",
        }
        actual = {ct.value for ct in ConstraintType}
        self.assertEqual(actual, expected)

    def test_violation_severity_values(self):
        self.assertEqual(ViolationSeverity.ERROR.value, "error")
        self.assertEqual(ViolationSeverity.WARNING.value, "warning")

    def test_constraint_violation_required_fields(self):
        v = ConstraintViolation(
            constraint_type=ConstraintType.LECTURER_CONFLICT,
            severity=ViolationSeverity.ERROR,
            affected_session_ids=[SES_1, SES_2],
            message="Lecturer double-booked",
        )
        self.assertIsNone(v.affected_room_id)
        self.assertIsNone(v.affected_lecturer_id)
        self.assertEqual(v.affected_student_ids, [])

    def test_constraint_violation_optional_fields(self):
        v = ConstraintViolation(
            constraint_type=ConstraintType.ROOM_CAPACITY,
            severity=ViolationSeverity.WARNING,
            affected_session_ids=[SES_1],
            message="Room over capacity",
            affected_room_id="room-id-001",
            affected_lecturer_id=LEC_A,
            affected_student_ids=[STU_1, STU_2],
        )
        self.assertEqual(v.affected_room_id, "room-id-001")
        self.assertEqual(v.affected_lecturer_id, LEC_A)
        self.assertEqual(v.affected_student_ids, [STU_1, STU_2])


class TestLecturerConflictGraph(unittest.TestCase):
    def test_empty_input_returns_empty(self):
        self.assertEqual(build_lecturer_conflict_graph([]), [])

    def test_single_session_returns_empty(self):
        sessions = [SessionNode(session_id=SES_1, lecturer_id=LEC_A)]
        self.assertEqual(build_lecturer_conflict_graph(sessions), [])

    def test_two_sessions_same_lecturer_produces_one_edge(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A),
            SessionNode(session_id=SES_2, lecturer_id=LEC_A),
        ]
        edges = build_lecturer_conflict_graph(sessions)
        self.assertEqual(len(edges), 1)
        edge = edges[0]
        self.assertEqual(edge.shared_lecturer_id, LEC_A)
        self.assertEqual(frozenset([edge.session_id_a, edge.session_id_b]), frozenset([SES_1, SES_2]))

    def test_three_sessions_same_lecturer_produces_three_edges(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A),
            SessionNode(session_id=SES_2, lecturer_id=LEC_A),
            SessionNode(session_id=SES_3, lecturer_id=LEC_A),
        ]
        edges = build_lecturer_conflict_graph(sessions)
        self.assertEqual(len(edges), 3)
        for edge in edges:
            self.assertEqual(edge.shared_lecturer_id, LEC_A)
            self.assertEqual(edge.shared_student_ids, frozenset())

    def test_different_lecturers_produce_no_edges(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A),
            SessionNode(session_id=SES_2, lecturer_id=LEC_B),
        ]
        self.assertEqual(build_lecturer_conflict_graph(sessions), [])

    def test_output_is_deterministic(self):
        sessions = [
            SessionNode(session_id=SES_2, lecturer_id=LEC_A),
            SessionNode(session_id=SES_1, lecturer_id=LEC_A),
        ]
        self.assertEqual(
            build_lecturer_conflict_graph(sessions),
            build_lecturer_conflict_graph(sessions),
        )

    def test_sessions_with_students_do_not_affect_lecturer_edges(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A, student_ids=frozenset([STU_1])),
            SessionNode(session_id=SES_2, lecturer_id=LEC_A, student_ids=frozenset([STU_2])),
        ]
        edges = build_lecturer_conflict_graph(sessions)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].shared_lecturer_id, LEC_A)


class TestStudentConflictGraph(unittest.TestCase):
    def test_empty_input_returns_empty(self):
        self.assertEqual(build_student_conflict_graph([]), [])

    def test_sessions_without_students_produce_no_edges(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A),
            SessionNode(session_id=SES_2, lecturer_id=LEC_B),
        ]
        self.assertEqual(build_student_conflict_graph(sessions), [])

    def test_two_sessions_sharing_one_student_produce_one_edge(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A, student_ids=frozenset([STU_1])),
            SessionNode(session_id=SES_2, lecturer_id=LEC_B, student_ids=frozenset([STU_1])),
        ]
        edges = build_student_conflict_graph(sessions)
        self.assertEqual(len(edges), 1)
        self.assertIn(STU_1, edges[0].shared_student_ids)
        self.assertIsNone(edges[0].shared_lecturer_id)

    def test_shared_students_accumulated_on_single_edge(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A, student_ids=frozenset([STU_1, STU_2])),
            SessionNode(session_id=SES_2, lecturer_id=LEC_B, student_ids=frozenset([STU_1, STU_2])),
        ]
        edges = build_student_conflict_graph(sessions)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].shared_student_ids, frozenset([STU_1, STU_2]))

    def test_non_shared_students_produce_no_edge(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A, student_ids=frozenset([STU_1])),
            SessionNode(session_id=SES_2, lecturer_id=LEC_B, student_ids=frozenset([STU_2])),
        ]
        self.assertEqual(build_student_conflict_graph(sessions), [])

    def test_three_sessions_sharing_same_student_produce_three_edges(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A, student_ids=frozenset([STU_1])),
            SessionNode(session_id=SES_2, lecturer_id=LEC_A, student_ids=frozenset([STU_1])),
            SessionNode(session_id=SES_3, lecturer_id=LEC_B, student_ids=frozenset([STU_1])),
        ]
        edges = build_student_conflict_graph(sessions)
        self.assertEqual(len(edges), 3)

    def test_mixed_sessions_only_shared_students_create_edges(self):
        sessions = [
            SessionNode(session_id=SES_1, lecturer_id=LEC_A, student_ids=frozenset([STU_1, STU_2])),
            SessionNode(session_id=SES_2, lecturer_id=LEC_B, student_ids=frozenset([STU_2, STU_3])),
            SessionNode(session_id=SES_3, lecturer_id=LEC_B),
        ]
        edges = build_student_conflict_graph(sessions)
        self.assertEqual(len(edges), 1)
        self.assertEqual(edges[0].shared_student_ids, frozenset([STU_2]))

    def test_output_is_deterministic(self):
        sessions = [
            SessionNode(session_id=SES_2, lecturer_id=LEC_A, student_ids=frozenset([STU_1])),
            SessionNode(session_id=SES_1, lecturer_id=LEC_B, student_ids=frozenset([STU_1])),
        ]
        self.assertEqual(
            build_student_conflict_graph(sessions),
            build_student_conflict_graph(sessions),
        )


class TestEvaluateTimetable(unittest.TestCase):
    def _rec(self, **kwargs) -> AssignmentRecord:
        defaults = dict(
            assignment_id=ASN_1,
            session_id=SES_1,
            room_id=ROM_1,
            room_capacity=30,
            day="Monday",
            start_slot="s1",
            duration=1,
            lecturer_id=LEC_A,
            student_ids=frozenset(),
        )
        defaults.update(kwargs)
        return AssignmentRecord(**defaults)

    def test_empty_returns_no_violations(self):
        self.assertEqual(evaluate_timetable([], {}), [])

    def test_single_valid_assignment_no_violations(self):
        self.assertEqual(evaluate_timetable([self._rec()], {}), [])

    # --- Lecturer conflict ---

    def test_lecturer_overlap_detected(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        types = [v.constraint_type for v in evaluate_timetable([a, b], {})]
        self.assertIn(ConstraintType.LECTURER_CONFLICT, types)

    def test_lecturer_no_conflict_different_slots(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Monday", start_slot="s2", duration=1, lecturer_id=LEC_A)
        types = [v.constraint_type for v in evaluate_timetable([a, b], {})]
        self.assertNotIn(ConstraintType.LECTURER_CONFLICT, types)

    def test_lecturer_no_conflict_different_days(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Tuesday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        self.assertEqual(evaluate_timetable([a, b], {}), [])

    def test_lecturer_conflict_affected_session_ids(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        violations = [v for v in evaluate_timetable([a, b], {}) if v.constraint_type == ConstraintType.LECTURER_CONFLICT]
        self.assertEqual(len(violations), 1)
        self.assertEqual(set(violations[0].affected_session_ids), {SES_1, SES_2})
        self.assertEqual(violations[0].affected_lecturer_id, LEC_A)

    # --- Student conflict ---

    def test_student_overlap_detected(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A, student_ids=frozenset([STU_1]))
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_B, student_ids=frozenset([STU_1]))
        types = [v.constraint_type for v in evaluate_timetable([a, b], {})]
        self.assertIn(ConstraintType.STUDENT_CONFLICT, types)

    def test_sessions_without_students_no_student_conflict(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A, student_ids=frozenset())
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_B, student_ids=frozenset())
        types = [v.constraint_type for v in evaluate_timetable([a, b], {})]
        self.assertNotIn(ConstraintType.STUDENT_CONFLICT, types)

    def test_non_overlapping_students_no_conflict(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A, student_ids=frozenset([STU_1]))
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_B, student_ids=frozenset([STU_2]))
        types = [v.constraint_type for v in evaluate_timetable([a, b], {})]
        self.assertNotIn(ConstraintType.STUDENT_CONFLICT, types)

    # --- Room conflict ---

    def test_room_double_booking_detected(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_B)
        types = [v.constraint_type for v in evaluate_timetable([a, b], {})]
        self.assertIn(ConstraintType.ROOM_CONFLICT, types)

    def test_room_no_conflict_different_slots(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_1, day="Monday", start_slot="s4", duration=1, lecturer_id=LEC_B)
        types = [v.constraint_type for v in evaluate_timetable([a, b], {})]
        self.assertNotIn(ConstraintType.ROOM_CONFLICT, types)

    # --- Room capacity ---

    def test_room_capacity_exceeded_detected(self):
        r = self._rec(room_capacity=2, student_ids=frozenset([STU_1, STU_2, STU_3]))
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertIn(ConstraintType.ROOM_CAPACITY, types)

    def test_room_capacity_exact_fit_no_violation(self):
        r = self._rec(room_capacity=2, student_ids=frozenset([STU_1, STU_2]))
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertNotIn(ConstraintType.ROOM_CAPACITY, types)

    def test_room_capacity_no_students_no_violation(self):
        r = self._rec(room_capacity=0, student_ids=frozenset())
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertNotIn(ConstraintType.ROOM_CAPACITY, types)

    # --- Lecturer availability ---

    def test_lecturer_unavailable_slot_detected(self):
        r = self._rec(day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        unavailability = {LEC_A: frozenset([("Monday", "s1")])}
        types = [v.constraint_type for v in evaluate_timetable([r], unavailability)]
        self.assertIn(ConstraintType.LECTURER_AVAILABILITY, types)

    def test_lecturer_unavailable_overlapping_slot_detected(self):
        # Session spans s1-s2; lecturer unavailable at s2
        r = self._rec(day="Tuesday", start_slot="s1", duration=2, lecturer_id=LEC_A)
        unavailability = {LEC_A: frozenset([("Tuesday", "s2")])}
        types = [v.constraint_type for v in evaluate_timetable([r], unavailability)]
        self.assertIn(ConstraintType.LECTURER_AVAILABILITY, types)

    def test_lecturer_available_no_conflict(self):
        r = self._rec(day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        unavailability = {LEC_A: frozenset([("Monday", "s2")])}
        types = [v.constraint_type for v in evaluate_timetable([r], unavailability)]
        self.assertNotIn(ConstraintType.LECTURER_AVAILABILITY, types)

    def test_different_lecturer_unavailability_no_conflict(self):
        r = self._rec(day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        unavailability = {LEC_B: frozenset([("Monday", "s1")])}
        types = [v.constraint_type for v in evaluate_timetable([r], unavailability)]
        self.assertNotIn(ConstraintType.LECTURER_AVAILABILITY, types)

    # --- Duration boundary ---

    def test_duration_boundary_past_last_slot_detected(self):
        # s7 + duration 2 overruns the day
        r = self._rec(start_slot="s7", duration=2)
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertIn(ConstraintType.DURATION_BOUNDARY, types)

    def test_duration_boundary_pm_overrun_detected(self):
        # s5 + duration 4 overruns (only s5,s6,s7 remain)
        r = self._rec(start_slot="s5", duration=4)
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertIn(ConstraintType.DURATION_BOUNDARY, types)

    def test_valid_pm_block_fills_exactly_no_boundary(self):
        # s4 + duration 4 fills PM block exactly
        r = self._rec(start_slot="s4", duration=4)
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertNotIn(ConstraintType.DURATION_BOUNDARY, types)

    # --- Lunch crossing ---

    def test_lunch_crossing_am_into_pm_detected(self):
        # s3 (AM) + duration 2 → s3, s4 crosses into PM
        r = self._rec(start_slot="s3", duration=2)
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertIn(ConstraintType.LUNCH_CROSSING, types)

    def test_lunch_crossing_s1_duration_4_detected(self):
        # s1 + duration 4 → s1,s2,s3,s4 spans AM and PM
        r = self._rec(start_slot="s1", duration=4)
        types = [v.constraint_type for v in evaluate_timetable([r], {})]
        self.assertIn(ConstraintType.LUNCH_CROSSING, types)

    def test_valid_am_block_no_crossing(self):
        # s1 + duration 3 stays in AM
        r = self._rec(start_slot="s1", duration=3)
        self.assertEqual(evaluate_timetable([r], {}), [])

    def test_valid_pm_start_no_crossing(self):
        # s4 + duration 1 is entirely PM
        r = self._rec(start_slot="s4", duration=1)
        self.assertEqual(evaluate_timetable([r], {}), [])

    # --- Unscheduled sessions are not in input ---

    def test_evaluation_does_not_mutate_input(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        original = list([a])
        evaluate_timetable(original, {})
        self.assertEqual(original, [a])

    def test_violations_are_structured_objects(self):
        a = self._rec(assignment_id=ASN_1, session_id=SES_1, room_id=ROM_1, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        b = self._rec(assignment_id=ASN_2, session_id=SES_2, room_id=ROM_2, day="Monday", start_slot="s1", duration=1, lecturer_id=LEC_A)
        violations = evaluate_timetable([a, b], {})
        self.assertTrue(all(isinstance(v, ConstraintViolation) for v in violations))
        self.assertTrue(all(isinstance(v.constraint_type, ConstraintType) for v in violations))
        self.assertTrue(all(isinstance(v.severity, ViolationSeverity) for v in violations))
        self.assertTrue(all(isinstance(v.affected_session_ids, list) for v in violations))
        self.assertTrue(all(isinstance(v.message, str) for v in violations))


if __name__ == "__main__":
    unittest.main()
