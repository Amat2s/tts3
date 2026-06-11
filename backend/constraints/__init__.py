from constraints.graph import (
    ConflictEdge,
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
from constraints.types import (
    AssignedSession,
    CONSTRAINT_SEVERITY,
    ConstraintSeverity,
    ConstraintType,
    LecturerInput,
    RoomInput,
    SessionInput,
    SolverConstraint,
)

__all__ = [
    # enums
    "ConstraintType",
    "ConstraintSeverity",
    "CONSTRAINT_SEVERITY",
    # input types
    "SessionInput",
    "RoomInput",
    "LecturerInput",
    "AssignedSession",
    # solver output
    "SolverConstraint",
    # conflict graph
    "ConflictEdge",
    "ConflictGraph",
    "build_conflict_graph",
    "derive_lecturer_overlap_conflicts",
    "derive_student_overlap_conflicts",
    "derive_unit_session_overlap_conflicts",
    # assignment-based checks
    "check_room_double_booking",
    "check_room_capacity",
    "check_lunch_crossing",
    "check_off_timetable",
    "check_lecturer_overlap",
    "check_student_overlap",
    "check_unit_session_overlap",
    "check_lecturer_availability",
    "compile_assignment_violations",
]
