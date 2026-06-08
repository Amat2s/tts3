from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.student import StudentCreate, StudentResponse, StudentUpdate
import services.student as student_service

router = APIRouter(prefix="/students", tags=["students"])


@router.get("", response_model=list[StudentResponse])
def list_students(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[StudentResponse]:
    return student_service.list_students(db)


@router.post("", response_model=StudentResponse, status_code=201)
def create_student(
    data: StudentCreate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StudentResponse:
    return student_service.create_student(db, data)


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: str,
    data: StudentUpdate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StudentResponse:
    return student_service.update_student(db, student_id, data)


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    student_service.delete_student(db, student_id)
