"""Pydantic schemas for Agent CRUD."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Request Schemas ───────────────────────────────────────────────────


class AgentCreate(BaseModel):
    """Payload to create an agent within a department."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=150,
        examples=["Sales Lead Qualifier"],
    )
    role_description: str = Field(
        ...,
        min_length=1,
        examples=["Qualifies inbound leads based on ICP criteria."],
    )
    system_prompt: str = Field(
        ...,
        min_length=1,
        examples=["You are a sales qualification agent…"],
    )
    default_model: str = Field(
        default="gpt-4o-mini",
        max_length=100,
        examples=["gpt-4o-mini", "claude-3-5-sonnet", "llama-3-8b"],
    )
    is_active: bool = Field(default=True)
    tools: list[str] = Field(
        default_factory=list,
        description="Tool keys the LangGraph router binds to this agent's LLM.",
        examples=[["web_search", "invoice_gen"]],
    )


class AgentUpdate(BaseModel):
    """Partial-update payload for an agent."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    role_description: Optional[str] = Field(default=None, min_length=1)
    system_prompt: Optional[str] = Field(default=None, min_length=1)
    default_model: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    tools: Optional[list[str]] = None


# ── Response Schema ───────────────────────────────────────────────────


class AgentRead(BaseModel):
    """Serialised agent returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    department_id: uuid.UUID
    name: str
    role_description: str
    system_prompt: str
    default_model: str
    is_active: bool
    tools: list[str]
    created_at: datetime
