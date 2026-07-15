"""Typed workflow state passed through the LangGraph execution graph.

The state accumulates data as each agent node processes it. LangGraph
requires a TypedDict (or Pydantic BaseModel) as the state schema so that
every node receives and returns the same shape.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

try:
    from typing import TypedDict
except ImportError:  # Python 3.7
    from typing_extensions import TypedDict


class StepLogEntry(TypedDict, total=False):
    """A single step in the workflow execution log."""

    agent_name: str
    department: str
    input_summary: str
    output_summary: str
    duration_ms: float
    error: Optional[str]
    timestamp: str


class WorkflowState(TypedDict, total=False):
    """Shared state threaded through every node in the agent graph.

    Attributes:
        input_prompt:       The original user prompt that triggered the workflow.
        current_department: The department currently owning execution.
        lead_data:          Output from the Sales agent (lead details).
        invoice_data:       Output from the Finance agent (invoice details).
        step_log:           Append-only ordered log of each step.
        cost_entries:       Per-agent LLM cost breakdown entries.
        status:             RUNNING | COMPLETED | FAILED | PENDING_APPROVAL | REJECTED.
        error:              Human-readable error message if status == FAILED.
        thread_id:          LangGraph checkpoint thread identifier; set by the route
                            before graph invocation so it can be used in the approve
                            callback.
        hitl_payload:       Interrupt context dict surfaced to the human operator
                            when status == PENDING_APPROVAL (e.g. amount, company).
    """

    input_prompt: str
    current_department: str
    lead_data: Dict[str, Any]
    invoice_data: Dict[str, Any]
    step_log: List[Dict[str, Any]]
    cost_entries: List[Dict[str, Any]]
    status: str
    error: Optional[str]
    thread_id: Optional[str]
    hitl_payload: Optional[Dict[str, Any]]
