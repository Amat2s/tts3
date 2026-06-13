from datetime import datetime

from pydantic import BaseModel, ConfigDict

from models.solver_run import SolverRunStatus


class SolverRunStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    solver_run_id: str
    status: SolverRunStatus
    job_id: str | None = None
    created_at: datetime
    updated_at: datetime
    scheduled_count: int | None = None
    unscheduled_count: int | None = None
    partial_success: bool = False
    failure_message: str | None = None


class SolverExecuteRequest(BaseModel):
    """Body the Trigger.dev solver worker sends to the internal execute endpoint.

    Mirrors the stable payload reference the worker already builds for the
    local bridge (snake_case). It carries references only — never frontend
    draft assignment state.
    """

    solver_run_id: str
    correlation_id: str
    admin_workspace_id: str | None = None
    snapshot_id: str | None = None

