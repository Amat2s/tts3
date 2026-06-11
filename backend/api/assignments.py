from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.assignment import AssignmentResponse, AssignmentSaveRequest
import services.assignment as assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AssignmentResponse]:
    return assignment_service.list_assignments(db)


@router.post("", response_model=list[AssignmentResponse])
def save_assignments(
    data: AssignmentSaveRequest,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AssignmentResponse]:
    return assignment_service.save_assignments(db, data)


@router.delete("", status_code=204)
def clear_assignments(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    assignment_service.clear_assignments(db)
