from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.errors import AppError
from models.room import Room
from schemas.room import RoomCreate, RoomUpdate


def list_rooms(db: Session) -> list[Room]:
    return db.query(Room).order_by(Room.name).all()


def get_room(db: Session, room_id: str) -> Room:
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise AppError("room_not_found", "Room not found.", status_code=404)
    return room


def create_room(db: Session, data: RoomCreate) -> Room:
    room = Room(name=data.name, capacity=data.capacity, room_type=data.room_type)
    db.add(room)
    try:
        db.commit()
        db.refresh(room)
    except IntegrityError:
        db.rollback()
        raise AppError(
            "room_name_conflict",
            f"A room named '{data.name}' already exists.",
            status_code=409,
        )
    return room


def update_room(db: Session, room_id: str, data: RoomUpdate) -> Room:
    room = get_room(db, room_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    try:
        db.commit()
        db.refresh(room)
    except IntegrityError:
        db.rollback()
        raise AppError(
            "room_name_conflict",
            "A room with that name already exists.",
            status_code=409,
        )
    return room


def delete_room(db: Session, room_id: str) -> None:
    room = get_room(db, room_id)
    db.delete(room)
    db.commit()
