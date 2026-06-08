from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.assignment import AssignmentCreate, AssignmentMove, AssignmentResponse
import services.assignment as assignment_service

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AssignmentResponse]:
    return assignment_service.list_assignments(db)


@router.post("", response_model=AssignmentResponse, status_code=201)
def schedule_session(
    data: AssignmentCreate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AssignmentResponse:
    return assignment_service.schedule_session(db, data)


@router.put("/{assignment_id}", response_model=AssignmentResponse)
def move_assignment(
    assignment_id: str,
    data: AssignmentMove,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AssignmentResponse:
    return assignment_service.move_assignment(db, assignment_id, data)


@router.delete("/{assignment_id}", status_code=204)
def unschedule_assignment(
    assignment_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    assignment_service.unschedule_assignment(db, assignment_id)
