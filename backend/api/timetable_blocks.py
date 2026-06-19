from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.timetable_block import (
    TimetableBlockCreate,
    TimetableBlockMutationResponse,
    TimetableBlockResponse,
    TimetableBlockUpdate,
)
import services.timetable_block as block_service

router = APIRouter(prefix="/timetable-blocks", tags=["timetable-blocks"])


@router.get("", response_model=list[TimetableBlockResponse])
def list_timetable_blocks(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[TimetableBlockResponse]:
    return block_service.list_timetable_blocks(db)


@router.post("", response_model=TimetableBlockMutationResponse, status_code=201)
def create_timetable_block(
    data: TimetableBlockCreate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> TimetableBlockMutationResponse:
    return block_service.create_timetable_block(db, data)


@router.put("/{block_group_id}", response_model=TimetableBlockMutationResponse)
def update_timetable_block(
    block_group_id: str,
    data: TimetableBlockUpdate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> TimetableBlockMutationResponse:
    return block_service.update_timetable_block(db, block_group_id, data)


@router.delete("/{block_group_id}", status_code=204)
def delete_timetable_block(
    block_group_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    block_service.delete_timetable_block(db, block_group_id)
