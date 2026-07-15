"""Pydantic schemas for the workflow execution endpoint."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Request ───────────────────────────────────────────────────────────


class WorkflowExecuteRequest(BaseModel):
    """Payload to trigger a multi-agent workflow run."""

    input_prompt: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        examples=["New lead from Acme Corp, deal value $5,000 USD, contact alice@acme.com"],
    )
    org_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional organization ID for tenant scoping.",
    )


# ── HITL Schemas ────────────────────────────────────────────────────


class WorkflowApproveRequest(BaseModel):
    """Payload sent by the human operator to resume or reject a paused run."""

    approved: bool = Field(
        ...,
        description="True to resume the workflow; False to reject and mark REJECTED.",
    )
    operator_note: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Optional free-text note from the operator recorded in the step log.",
    )


class WorkflowApproveResponse(BaseModel):
    """Result returned after a human operator approves or rejects a paused run."""

    model_config = ConfigDict(from_attributes=True)

    thread_id: str
    run_id: uuid.UUID
    status: str
    step_log: List["StepLogEntry"]
    final_output: Dict[str, Any]
    cost_summary: Optional["CostSummary"] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


# ── Cost Schemas ──────────────────────────────────────────────────────


class CostEntrySchema(BaseModel):
    """Token cost breakdown for a single LLM call."""

    model_config = ConfigDict(from_attributes=True)

    model_used: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    raw_cost_usd: float = 0.0
    estimated_savings_usd: float = 0.0
    routing_strategy: str = "DEFAULT"


class CostSummary(BaseModel):
    """Aggregated cost metrics across all agents in a workflow run."""

    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    total_raw_cost_usd: float = 0.0
    total_estimated_savings_usd: float = 0.0
    models_used: List[str] = Field(default_factory=list)


# ── Response ──────────────────────────────────────────────────────────


class StepLogEntry(BaseModel):
    """A single step in the workflow execution log."""

    model_config = ConfigDict(from_attributes=True)

    agent_name: str
    department: str
    input_summary: str
    output_summary: str
    duration_ms: float
    error: Optional[str] = None
    timestamp: Optional[str] = None
    cost_entry: Optional[CostEntrySchema] = None


class WorkflowExecuteResponse(BaseModel):
    """Full result of a workflow execution."""

    model_config = ConfigDict(from_attributes=True)

    run_id: uuid.UUID
    status: str
    step_log: List[StepLogEntry]
    final_output: Dict[str, Any]
    cost_summary: Optional[CostSummary] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    # Module 4: HITL fields — populated only when status == PENDING_APPROVAL
    thread_id: Optional[str] = Field(
        default=None,
        description="LangGraph thread ID to use when calling the /approve endpoint.",
    )
    hitl_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Interrupt payload for the operator: amount, company, reason.",
    )
