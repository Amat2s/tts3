from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.lecturer import (
    LecturerAvailabilitySet,
    LecturerCreate,
    LecturerResponse,
    LecturerUpdate,
)
import services.lecturer as lecturer_service

router = APIRouter(prefix="/lecturers", tags=["lecturers"])


@router.get("", response_model=list[LecturerResponse])
def list_lecturers(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[LecturerResponse]:
    return lecturer_service.list_lecturers(db)


@router.post("", response_model=LecturerResponse, status_code=201)
def create_lecturer(
    data: LecturerCreate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> LecturerResponse:
    return lecturer_service.create_lecturer(db, data)


@router.put("/{lecturer_id}", response_model=LecturerResponse)
def update_lecturer(
    lecturer_id: str,
    data: LecturerUpdate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> LecturerResponse:
    return lecturer_service.update_lecturer(db, lecturer_id, data)


@router.delete("/{lecturer_id}", status_code=204)
def delete_lecturer(
    lecturer_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    lecturer_service.delete_lecturer(db, lecturer_id)


@router.put("/{lecturer_id}/availability", response_model=LecturerResponse)
def set_availability(
    lecturer_id: str,
    data: LecturerAvailabilitySet,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> LecturerResponse:
    return lecturer_service.set_availability(db, lecturer_id, data)
