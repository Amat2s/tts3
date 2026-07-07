from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.unit import UnitCreate, UnitResponse, UnitUpdate
import services.unit as unit_service

router = APIRouter(prefix="/units", tags=["units"])


@router.get("", response_model=list[UnitResponse])
def list_units(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[UnitResponse]:
    return unit_service.list_units(db)


@router.post("", response_model=UnitResponse, status_code=201)
def create_unit(
    data: UnitCreate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UnitResponse:
    return unit_service.create_unit(db, data)


@router.put("/{unit_id}", response_model=UnitResponse)
def update_unit(
    unit_id: str,
    data: UnitUpdate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> UnitResponse:
    return unit_service.update_unit(db, unit_id, data)


@router.delete("/{unit_id}", status_code=204)
def delete_unit(
    unit_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    unit_service.delete_unit(db, unit_id)
