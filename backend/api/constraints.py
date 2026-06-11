from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from constraints.evaluator import load_and_evaluate
from constraints.types import ConstraintType, ConstraintViolation, ViolationSeverity
from db.deps import get_db

router = APIRouter(prefix="/constraints", tags=["constraints"])


class ViolationResponse(BaseModel):
    constraint_type: ConstraintType
    severity: ViolationSeverity
    affected_session_ids: list[str]
    affected_room_id: str | None
    affected_lecturer_id: str | None
    affected_student_ids: list[str]
    message: str


class ValidationSummary(BaseModel):
    total: int
    errors: int
    warnings: int


class ValidationResponse(BaseModel):
    violations: list[ViolationResponse]
    summary: ValidationSummary


def _to_response(v: ConstraintViolation) -> ViolationResponse:
    return ViolationResponse(
        constraint_type=v.constraint_type,
        severity=v.severity,
        affected_session_ids=v.affected_session_ids,
        affected_room_id=v.affected_room_id,
        affected_lecturer_id=v.affected_lecturer_id,
        affected_student_ids=v.affected_student_ids,
        message=v.message,
    )


@router.get("/validate", response_model=ValidationResponse)
def validate_timetable(
    _admin: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> ValidationResponse:
    violations = load_and_evaluate(db)
    violation_responses = [_to_response(v) for v in violations]
    errors = sum(1 for v in violations if v.severity == ViolationSeverity.ERROR)
    warnings = len(violations) - errors
    return ValidationResponse(
        violations=violation_responses,
        summary=ValidationSummary(total=len(violations), errors=errors, warnings=warnings),
    )
