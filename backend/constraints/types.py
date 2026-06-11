import enum
from dataclasses import dataclass, field


class ConstraintType(str, enum.Enum):
    LECTURER_CONFLICT = "lecturer_conflict"
    STUDENT_CONFLICT = "student_conflict"
    ROOM_CONFLICT = "room_conflict"
    ROOM_CAPACITY = "room_capacity"
    LECTURER_AVAILABILITY = "lecturer_availability"
    DURATION_BOUNDARY = "duration_boundary"
    LUNCH_CROSSING = "lunch_crossing"


class ViolationSeverity(str, enum.Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclass
class ConstraintViolation:
    constraint_type: ConstraintType
    severity: ViolationSeverity
    affected_session_ids: list[str]
    message: str
    affected_room_id: str | None = None
    affected_lecturer_id: str | None = None
    affected_student_ids: list[str] = field(default_factory=list)
