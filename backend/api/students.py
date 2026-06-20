from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.student import (
    StudentCreate,
    StudentImportResult,
    StudentResponse,
    StudentUpdate,
)
import services.student as student_service
import services.student_import as student_import_service

router = APIRouter(prefix="/students", tags=["students"])


@router.get("", response_model=list[StudentResponse])
def list_students(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[StudentResponse]:
    return student_service.list_students(db)


@router.post("/import-csv", response_model=StudentImportResult)
async def import_students_csv(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile | None, File()] = None,
) -> StudentImportResult:
    # Read the upload fully and hand the raw bytes to the service, which owns all
    # structural and row-level validation. The CSV is processed in-memory and
    # discarded; nothing is written to blob/object storage.
    filename = file.filename if file is not None else None
    content = await file.read() if file is not None else b""
    return student_import_service.import_students_csv(
        db, filename=filename, content=content
    )


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
