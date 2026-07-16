"""Agent profile model — PRD §5.1."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, ArrayType

if TYPE_CHECKING:
    from app.models.department import Department


class Agent(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An AI agent provisioned within a department."""

    __tablename__ = "agents"

    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    role_description: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    default_model: Mapped[str] = mapped_column(
        String(100),
        default="gpt-4o-mini",
        server_default="gpt-4o-mini",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
    )
    #: Tool keys (e.g. "web_search") the LangGraph router binds to the LLM at
    #: run time. ``server_default`` backfills pre-existing rows with an empty
    #: array so the NOT NULL constraint holds without a data migration.
    tools: Mapped[list[str]] = mapped_column(
        ArrayType(String),
        default=list,
        server_default="{}",
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────
    department: Mapped[Department] = relationship(
        "Department",
        back_populates="agents",
    )

    def __repr__(self) -> str:
        return f"<Agent name={self.name!r} model={self.default_model!r}>"
