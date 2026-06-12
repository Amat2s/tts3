from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from schemas.solver import SolverRunStatusResponse
import services.solver_run as solver_run_service

router = APIRouter(prefix="/solver", tags=["solver"])


@router.post("/start", response_model=SolverRunStatusResponse)
def start_solver(
    admin: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SolverRunStatusResponse:
    return solver_run_service.start_solver_run(db, admin_user_id=admin.user_id)


@router.get("/status/{solver_run_id}", response_model=SolverRunStatusResponse)
def get_solver_status(
    solver_run_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SolverRunStatusResponse:
    return solver_run_service.get_solver_run_status(db, solver_run_id)

