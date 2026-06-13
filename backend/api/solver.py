from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.deps import CurrentAdmin, get_current_admin, require_internal_token
from db.deps import get_db
from schemas.solver import SolverExecuteRequest, SolverRunStatusResponse
import services.solver_run as solver_run_service

router = APIRouter(prefix="/solver", tags=["solver"])


@router.post("/start", response_model=SolverRunStatusResponse)
def start_solver(
    admin: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SolverRunStatusResponse:
    return solver_run_service.start_solver_run(db, admin_user_id=admin.user_id)


@router.post("/internal/execute")
def execute_solver_internal(
    body: SolverExecuteRequest,
    _: Annotated[None, Depends(require_internal_token)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Internal solver execution for the deployed Trigger.dev worker (Unit 56).

    Authorized by the shared ``SOLVER_INTERNAL_TOKEN`` (server-to-server), NOT a
    Supabase admin JWT. Runs the full solver pipeline and returns the structured
    result document so the worker can report the outcome.
    """
    return solver_run_service.execute_solver_run(
        db,
        solver_run_id=body.solver_run_id,
        correlation_id=body.correlation_id,
        admin_workspace_id=body.admin_workspace_id,
        snapshot_id=body.snapshot_id,
    )


@router.get("/status/{solver_run_id}", response_model=SolverRunStatusResponse)
def get_solver_status(
    solver_run_id: str,
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SolverRunStatusResponse:
    return solver_run_service.get_solver_run_status(db, solver_run_id)

