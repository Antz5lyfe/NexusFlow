"""Pydantic schemas for Cost Log endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.cost_log import RoutingStrategy


# ── Request Schemas ───────────────────────────────────────────────────


class CostLogCreate(BaseModel):
    """Payload to record a new cost log entry."""

    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    model_used: str = Field(
        ...,
        min_length=1,
        max_length=100,
        examples=["gpt-4o-mini", "llama-3-8b"],
    )
    raw_cost_usd: Decimal = Field(
        ...,
        ge=0,
        examples=[0.0012],
        description="Actual dollar cost of this LLM call.",
    )
    routing_strategy: Optional[RoutingStrategy] = Field(
        default=None,
        examples=["DYNAMIC_ROUTING"],
    )
    estimated_savings_usd: Decimal = Field(
        default=Decimal("0.000000"),
        ge=0,
        examples=[0.005],
    )


# ── Response Schemas ──────────────────────────────────────────────────


class CostLogRead(BaseModel):
    """Serialised cost log entry returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    department_id: uuid.UUID
    prompt_tokens: int
    completion_tokens: int
    model_used: str
    raw_cost_usd: Decimal
    routing_strategy: Optional[RoutingStrategy]
    estimated_savings_usd: Decimal
    timestamp: datetime


class BudgetStatus(BaseModel):
    """Budget overview for a department — includes alert flag per FR-2.3."""

    department_id: uuid.UUID
    department_name: str
    monthly_budget_usd: Decimal
    current_spend_usd: Decimal
    remaining_usd: Decimal
    utilization_pct: Decimal = Field(
        description="Percentage of budget consumed (0-100+)."
    )
    budget_alert: bool = Field(
        description="True when spend ≥ 90 % of monthly budget."
    )
