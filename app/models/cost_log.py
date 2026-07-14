"""Token & routing cost log model — PRD §5.1."""

from __future__ import annotations

import enum
from typing import Optional
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class RoutingStrategy(str, enum.Enum):
    """How the request was routed — used for cost analytics."""

    DYNAMIC_ROUTING = "DYNAMIC_ROUTING"
    SEMANTIC_CACHE = "SEMANTIC_CACHE"
    DEFAULT = "DEFAULT"


class CostLog(Base, UUIDPrimaryKeyMixin):
    """Immutable ledger entry recording token usage and cost per LLM call."""

    __tablename__ = "cost_logs"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id"),
        nullable=False,
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id"),
        nullable=False,
    )

    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    completion_tokens: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False)
    routing_strategy: Mapped[Optional[RoutingStrategy]] = mapped_column(
        Enum(RoutingStrategy, name="routing_strategy_enum"),
        nullable=True,
    )
    estimated_savings_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 6),
        default=Decimal("0.000000"),
        server_default="0.000000",
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<CostLog model={self.model_used!r} "
            f"cost={self.raw_cost_usd} strategy={self.routing_strategy}>"
        )
