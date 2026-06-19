"""Timetable block persistence service (Unit 84).

Owns the create/list/update/delete logic for room-specific timetable blocks.
Blocks are a hard constraint reserving ``day + slot + room_id`` cells. Creating
or updating a block over saved assignments intentionally unschedules those
assignments in the same transaction and reports the affected session IDs;
deleting a block frees its cells without rescheduling anything.

This is the backend data/API contract only — frontend validation and solver
integration arrive in later units.
"""
import structlog
from sqlalchemy.orm import Session as DBSession, selectinload

from api.errors import AppError
from models.assignment import TimetableAssignment
from models.room import Room
from models.session import Session
from models.timetable_block import (
    BlockColour,
    TimetableBlockCell,
    TimetableBlockGroup,
)
from schemas.timetable_block import (
    BlockCellInput,
    TimetableBlockCreate,
    TimetableBlockMutationResponse,
    TimetableBlockResponse,
    TimetableBlockUpdate,
)
from services.assignment import ORDERED_SLOTS

logger = structlog.get_logger(__name__)

# A normalized cell key: (day value, slot value, room_id).
CellKey = tuple[str, str, str]


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------


def _group_query(db: DBSession):
    return db.query(TimetableBlockGroup).options(
        selectinload(TimetableBlockGroup.cells)
    )


def _get_group(db: DBSession, block_group_id: str) -> TimetableBlockGroup:
    group = (
        _group_query(db)
        .filter(TimetableBlockGroup.id == block_group_id)
        .first()
    )
    if group is None:
        raise AppError(
            "block_group_not_found",
            "Timetable block not found.",
            status_code=404,
        )
    return group


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _normalize_name(name: str | None) -> str | None:
    """Trim the block name; a blank name becomes ``None`` (unnamed block)."""
    if name is None:
        return None
    trimmed = name.strip()
    return trimmed or None


def _validate_name_colour(name: str | None, colour: BlockColour | None) -> None:
    """A named block requires a colour; an unnamed block must carry none."""
    if name is not None and colour is None:
        raise AppError(
            "block_named_without_colour",
            "A named block must have a colour.",
            status_code=422,
        )
    if name is None and colour is not None:
        raise AppError(
            "block_unnamed_with_colour",
            "An unnamed block must not have a colour.",
            status_code=422,
        )


def _dedupe_cells(cells: list[BlockCellInput]) -> list[BlockCellInput]:
    """Drop exact-duplicate cells from a request, preserving order."""
    seen: set[CellKey] = set()
    unique: list[BlockCellInput] = []
    for cell in cells:
        key = (cell.day.value, cell.slot.value, cell.room_id)
        if key in seen:
            continue
        seen.add(key)
        unique.append(cell)
    return unique


def _validate_rooms_exist(db: DBSession, cells: list[BlockCellInput]) -> None:
    room_ids = {cell.room_id for cell in cells}
    existing = {
        r.id for r in db.query(Room.id).filter(Room.id.in_(room_ids)).all()
    }
    for room_id in room_ids:
        if room_id not in existing:
            raise AppError(
                "room_not_found",
                f"Room {room_id} not found.",
                status_code=422,
            )


def _reject_cells_blocked_elsewhere(
    db: DBSession,
    cells: list[BlockCellInput],
    *,
    exclude_group_id: str | None = None,
) -> None:
    """Reject any requested cell already blocked by a different group."""
    query = db.query(TimetableBlockCell)
    if exclude_group_id is not None:
        query = query.filter(
            TimetableBlockCell.block_group_id != exclude_group_id
        )
    existing: set[CellKey] = {
        (c.day.value, c.slot.value, c.room_id) for c in query.all()
    }
    for cell in cells:
        key = (cell.day.value, cell.slot.value, cell.room_id)
        if key in existing:
            raise AppError(
                "cell_already_blocked",
                (
                    f"Cell {key[0]} {key[1]} (room {key[2]}) is already "
                    "blocked by another block."
                ),
                status_code=409,
            )


# ---------------------------------------------------------------------------
# Assignment overlap detection
# ---------------------------------------------------------------------------


def _occupied_cells(
    assignment: TimetableAssignment, duration: int
) -> list[CellKey]:
    """Expand a saved assignment into the cells it occupies.

    A session occupies ``duration`` contiguous slots from its start slot in its
    assigned room on its assigned day.
    """
    start_index = ORDERED_SLOTS.index(assignment.start_slot.value)
    slots = ORDERED_SLOTS[start_index : start_index + duration]
    return [(assignment.day.value, slot, assignment.room_id) for slot in slots]


def _unschedule_overlapping_assignments(
    db: DBSession, blocked: set[CellKey]
) -> list[str]:
    """Delete saved assignments whose occupied cells intersect ``blocked``.

    Returns the affected session IDs (the ``unscheduled_session_ids``). The
    deletes are issued on the request session and committed by the caller as
    part of the same transaction.
    """
    if not blocked:
        return []

    assignments = (
        db.query(TimetableAssignment)
        .options(selectinload(TimetableAssignment.session))
        .all()
    )
    unscheduled: list[str] = []
    for assignment in assignments:
        duration = assignment.session.duration
        occupied = _occupied_cells(assignment, duration)
        if any(cell in blocked for cell in occupied):
            unscheduled.append(assignment.session_id)
            db.delete(assignment)

    if unscheduled:
        logger.info(
            "block_unscheduled_assignments",
            count=len(unscheduled),
        )
    return unscheduled


def _blocked_key_set(cells: list[BlockCellInput]) -> set[CellKey]:
    return {(cell.day.value, cell.slot.value, cell.room_id) for cell in cells}


# ---------------------------------------------------------------------------
# Public service operations
# ---------------------------------------------------------------------------


def list_timetable_blocks(db: DBSession) -> list[TimetableBlockResponse]:
    groups = _group_query(db).order_by(TimetableBlockGroup.created_at).all()
    return [TimetableBlockResponse.model_validate(g) for g in groups]


def create_timetable_block(
    db: DBSession, data: TimetableBlockCreate
) -> TimetableBlockMutationResponse:
    name = _normalize_name(data.name)
    colour = data.colour
    _validate_name_colour(name, colour)

    if not data.cells:
        raise AppError(
            "block_no_cells",
            "A block must reserve at least one cell.",
            status_code=422,
        )

    cells = _dedupe_cells(data.cells)
    _validate_rooms_exist(db, cells)
    _reject_cells_blocked_elsewhere(db, cells)

    group = TimetableBlockGroup(name=name, colour=colour)
    db.add(group)
    db.flush()  # assign group.id before attaching cells
    for cell in cells:
        db.add(
            TimetableBlockCell(
                block_group_id=group.id,
                day=cell.day,
                slot=cell.slot,
                room_id=cell.room_id,
            )
        )

    unscheduled = _unschedule_overlapping_assignments(db, _blocked_key_set(cells))

    db.commit()
    logger.info(
        "block_created",
        block_group_id=group.id,
        cell_count=len(cells),
        unscheduled_count=len(unscheduled),
    )

    group = _get_group(db, group.id)
    return TimetableBlockMutationResponse(
        block=TimetableBlockResponse.model_validate(group),
        unscheduled_session_ids=unscheduled,
    )


def update_timetable_block(
    db: DBSession, block_group_id: str, data: TimetableBlockUpdate
) -> TimetableBlockMutationResponse:
    group = _get_group(db, block_group_id)

    name = _normalize_name(data.name)
    colour = data.colour
    _validate_name_colour(name, colour)

    if not data.cells:
        raise AppError(
            "block_no_cells",
            "A block must reserve at least one cell.",
            status_code=422,
        )

    cells = _dedupe_cells(data.cells)
    _validate_rooms_exist(db, cells)
    # Updating may keep or replace this group's own cells; only collisions with
    # *other* groups are rejected.
    _reject_cells_blocked_elsewhere(db, cells, exclude_group_id=group.id)

    group.name = name
    group.colour = colour
    # Replace the group's cells wholesale. Delete the old cells and flush before
    # inserting the new ones so the unique (day, slot, room_id) constraint is not
    # tripped by an insert ordered ahead of the orphan delete.
    for existing in list(group.cells):
        db.delete(existing)
    db.flush()
    for cell in cells:
        db.add(
            TimetableBlockCell(
                block_group_id=group.id,
                day=cell.day,
                slot=cell.slot,
                room_id=cell.room_id,
            )
        )
    db.flush()

    unscheduled = _unschedule_overlapping_assignments(db, _blocked_key_set(cells))

    db.commit()
    logger.info(
        "block_updated",
        block_group_id=group.id,
        cell_count=len(cells),
        unscheduled_count=len(unscheduled),
    )

    group = _get_group(db, block_group_id)
    return TimetableBlockMutationResponse(
        block=TimetableBlockResponse.model_validate(group),
        unscheduled_session_ids=unscheduled,
    )


def delete_timetable_block(db: DBSession, block_group_id: str) -> None:
    group = _get_group(db, block_group_id)
    db.delete(group)
    db.commit()
    logger.info("block_deleted", block_group_id=block_group_id)
