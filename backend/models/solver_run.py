import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class SolverRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class SolverRun(Base):
    __tablename__ = "solver_runs"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    status: Mapped[SolverRunStatus] = mapped_column(
        Enum(
            SolverRunStatus,
            name="solverrunstatus",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=SolverRunStatus.PENDING,
    )
    trigger_job_id: Mapped[str | None] = mapped_column(String, nullable=True)
    correlation_id: Mapped[str] = mapped_column(
        String, nullable=False, default=lambda: str(uuid.uuid4())
    )
    requested_by_admin_id: Mapped[str | None] = mapped_column(String, nullable=True)
    scheduled_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unscheduled_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    partial_success: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    failure_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    failure_code: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

