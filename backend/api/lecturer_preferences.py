from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.lecturer_preference import (
    LecturerPreferenceDelete,
    LecturerPreferenceResponse,
    LecturerPreferenceUpsert,
)
import services.lecturer_preference as preference_service

router = APIRouter(tags=["lecturer-preferences"])


@router.get(
    "/lecturers/{lecturer_id}/preferences",
    response_model=list[LecturerPreferenceResponse],
)
def list_lecturer_preferences(
    lecturer_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[LecturerPreferenceResponse]:
    return preference_service.list_lecturer_preferences(db, lecturer_id)


@router.put("/lecturer-preferences", response_model=LecturerPreferenceResponse)
def upsert_lecturer_preference(
    data: LecturerPreferenceUpsert,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> LecturerPreferenceResponse:
    return preference_service.upsert_lecturer_preference(db, data)


@router.delete("/lecturer-preferences", status_code=204)
def delete_lecturer_preference(
    data: LecturerPreferenceDelete,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    preference_service.delete_lecturer_preference(db, data)
