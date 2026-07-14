"""Pydantic schemas for Organization CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Request Schemas ───────────────────────────────────────────────────


class OrganizationCreate(BaseModel):
    """Payload to create a new organization."""

    name: str = Field(..., min_length=1, max_length=255, examples=["Acme Corp"])
    country: str = Field(
        default="SG",
        min_length=2,
        max_length=50,
        examples=["SG"],
        description="ISO country code or short name for regional tracking.",
    )


class OrganizationUpdate(BaseModel):
    """Partial-update payload — all fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    country: Optional[str] = Field(default=None, min_length=2, max_length=50)


# ── Response Schema ───────────────────────────────────────────────────


class OrganizationRead(BaseModel):
    """Serialised organization returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    country: str
    created_at: datetime
