from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.errors import AppError
from models.room import Room
from schemas.room import RoomCreate, RoomUpdate


def list_rooms(db: Session) -> list[Room]:
    # Ordered by the persisted timetable column order (Unit 113), with name as a
    # deterministic tiebreaker for any rooms that happen to share a position.
    return db.query(Room).order_by(Room.position, Room.name).all()


def get_room(db: Session, room_id: str) -> Room:
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise AppError("room_not_found", "Room not found.", status_code=404)
    return room


def create_room(db: Session, data: RoomCreate) -> Room:
    # Append the new room to the end of the order: it becomes the right-most
    # timetable column until an admin moves it via reorder.
    max_position = db.query(func.max(Room.position)).scalar()
    next_position = 0 if max_position is None else max_position + 1
    room = Room(
        name=data.name,
        capacity=data.capacity,
        room_type=data.room_type,
        position=next_position,
    )
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


def reorder_rooms(db: Session, ordered_ids: list[str]) -> list[Room]:
    # The client sends the full desired order. Validate it is *exactly* the set
    # of all existing room ids — no missing, no unknown, no duplicate ids — and
    # persist nothing on mismatch, so the endpoint stays atomic and idempotent.
    rooms = db.query(Room).all()
    existing_ids = {room.id for room in rooms}
    given_ids = list(ordered_ids)
    given_set = set(given_ids)

    if len(given_ids) != len(given_set) or given_set != existing_ids:
        raise AppError(
            "rooms_reorder_mismatch",
            "The reorder request must list exactly the current set of room ids "
            "once each.",
            status_code=422,
        )

    rooms_by_id = {room.id: room for room in rooms}
    for index, room_id in enumerate(given_ids):
        rooms_by_id[room_id].position = index
    db.commit()
    return list_rooms(db)


def delete_room(db: Session, room_id: str) -> None:
    room = get_room(db, room_id)
    db.delete(room)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            "room_delete_blocked",
            "Can't delete this room yet — it's still referenced elsewhere.",
            status_code=409,
        )
