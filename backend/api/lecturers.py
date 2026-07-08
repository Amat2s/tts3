from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.lecturer import (
    LecturerAvailabilitySet,
    LecturerCreate,
    LecturerImportResult,
    LecturerResponse,
    LecturerUpdate,
)
import services.lecturer as lecturer_service
import services.lecturer_import as lecturer_import_service

router = APIRouter(prefix="/lecturers", tags=["lecturers"])


@router.get("", response_model=list[LecturerResponse])
def list_lecturers(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[LecturerResponse]:
    return lecturer_service.list_lecturers(db)


@router.post("/import-csv", response_model=LecturerImportResult)
async def import_lecturers_csv(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile | None, File()] = None,
) -> LecturerImportResult:
    # Read the upload fully and hand the raw bytes to the service, which owns all
    # structural and row-level validation. The spreadsheet is processed
    # in-memory and discarded; nothing is written to blob/object storage.
    filename = file.filename if file is not None else None
    content = await file.read() if file is not None else b""
    return lecturer_import_service.import_lecturers_csv(
        db, filename=filename, content=content
    )


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
