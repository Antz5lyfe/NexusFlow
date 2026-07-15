"""Pydantic schemas for Department CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Request Schemas ───────────────────────────────────────────────────


class DepartmentCreate(BaseModel):
    """Payload to create a department within an organization."""

    name: str = Field(
        ..., min_length=1, max_length=100, examples=["HR", "Sales", "Finance"]
    )
    monthly_budget_usd: Decimal = Field(
        default=Decimal("100.00"),
        ge=0,
        description="Monthly spend cap in USD.",
        examples=[100.00],
    )

    @field_validator("monthly_budget_usd", mode="after")
    @classmethod
    def _round_budget(cls, v: Decimal) -> Decimal:
        return v.quantize(Decimal("0.01"))


class DepartmentUpdate(BaseModel):
    """Partial-update payload for a department."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    monthly_budget_usd: Optional[Decimal] = Field(default=None, ge=0)
    current_spend_usd: Optional[Decimal] = Field(default=None, ge=0)

    @field_validator("monthly_budget_usd", "current_spend_usd", mode="after")
    @classmethod
    def _round_decimals(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return v.quantize(Decimal("0.01")) if v is not None else None


# ── Response Schema ───────────────────────────────────────────────────


class DepartmentRead(BaseModel):
    """Serialised department returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    monthly_budget_usd: float
    current_spend_usd: float
    created_at: datetime
