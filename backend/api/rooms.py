from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.room import RoomCreate, RoomResponse, RoomUpdate
import services.room as room_service

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=list[RoomResponse])
def list_rooms(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[RoomResponse]:
    return room_service.list_rooms(db)


@router.post("", response_model=RoomResponse, status_code=201)
def create_room(
    data: RoomCreate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> RoomResponse:
    return room_service.create_room(db, data)


@router.put("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: str,
    data: RoomUpdate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> RoomResponse:
    return room_service.update_room(db, room_id, data)


@router.delete("/{room_id}", status_code=204)
def delete_room(
    room_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    room_service.delete_room(db, room_id)
