from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.session import (
    SchedulableSessionResponse,
    SessionCreate,
    SessionResponse,
    SessionUpdate,
)
import services.session as session_service

unit_sessions_router = APIRouter(prefix="/units", tags=["sessions"])
sessions_router = APIRouter(prefix="/sessions", tags=["sessions"])


@unit_sessions_router.get("/{unit_id}/sessions", response_model=list[SessionResponse])
def list_sessions_for_unit(
    unit_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SessionResponse]:
    return session_service.list_sessions_for_unit(db, unit_id)


@unit_sessions_router.post(
    "/{unit_id}/sessions", response_model=SessionResponse, status_code=201
)
def create_session(
    unit_id: str,
    data: SessionCreate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SessionResponse:
    return session_service.create_session(db, unit_id, data)


@sessions_router.get("/schedulable", response_model=list[SchedulableSessionResponse])
def list_schedulable_sessions(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SchedulableSessionResponse]:
    return session_service.list_schedulable_sessions(db)


@sessions_router.put("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: str,
    data: SessionUpdate,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SessionResponse:
    return session_service.update_session(db, session_id, data)


@sessions_router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    session_service.delete_session(db, session_id)
