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

