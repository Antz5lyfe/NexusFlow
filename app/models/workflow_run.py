"""WorkflowRun model — tracks each orchestration execution."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class WorkflowStatus(str, enum.Enum):
    """Lifecycle status of a workflow run."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    PAUSED_HITL = "PAUSED_HITL"


class WorkflowRun(Base, UUIDPrimaryKeyMixin):
    """Persists each multi-agent workflow execution for audit & replay."""

    __tablename__ = "workflow_runs"

    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )

    status: Mapped[WorkflowStatus] = mapped_column(
        Enum(WorkflowStatus, name="workflow_status_enum"),
        default=WorkflowStatus.PENDING,
        server_default="PENDING",
        nullable=False,
    )

    input_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    final_output: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
    )

    step_log: Mapped[Optional[list]] = mapped_column(
        JSONB,
        nullable=True,
        default=list,
    )

    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<WorkflowRun id={self.id} status={self.status.value}>"
