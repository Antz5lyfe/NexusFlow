"""LangGraph-based workflow engine — builds and runs the agent graph.

The graph implements the inter-agent handoff pattern from PRD §3.1 FR-1.3:

    START → sales_agent → should_continue → finance_agent → END
                               ↓ (on error)
                              END

``run_workflow`` is the public async entry-point used by the API route.
Agent node functions are synchronous mocks, so they run via
``asyncio.to_thread`` to keep the event loop non-blocking.
"""

from __future__ import annotations

import asyncio
import time
import traceback
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from app.engine.agents import finance_agent_node, sales_agent_node
from app.engine.state import WorkflowState


# ── Graph Construction ────────────────────────────────────────────────


def _should_continue(state: Dict[str, Any]) -> str:
    """Conditional edge: route to END on failure, else to finance_agent."""
    if state.get("status") == "FAILED":
        return "end"
    return "finance_agent"


def build_workflow_graph() -> Any:
    """Construct and compile the LangGraph StateGraph.

    Returns a compiled graph object whose ``.invoke()`` method accepts
    an initial ``WorkflowState`` and returns the final state dict.
    """
    graph = StateGraph(WorkflowState)

    # Register nodes.
    graph.add_node("sales_agent", sales_agent_node)
    graph.add_node("finance_agent", finance_agent_node)

    # Wire edges.
    graph.set_entry_point("sales_agent")

    graph.add_conditional_edges(
        "sales_agent",
        _should_continue,
        {
            "finance_agent": "finance_agent",
            "end": END,
        },
    )

    graph.add_edge("finance_agent", END)

    return graph.compile()


# Pre-compile the graph once at module load (stateless, reusable).
_compiled_graph = build_workflow_graph()


# ── Public API ────────────────────────────────────────────────────────


async def run_workflow(input_prompt: str) -> Dict[str, Any]:
    """Execute the full agent graph asynchronously.

    Args:
        input_prompt: The user's natural-language request.

    Returns:
        The final ``WorkflowState`` dict with all agent outputs,
        step log, and status.

    This function never raises — all errors are captured in the returned
    state so callers can inspect ``status`` and ``error``.
    """
    initial_state: Dict[str, Any] = {
        "input_prompt": input_prompt,
        "current_department": "Sales",
        "lead_data": {},
        "invoice_data": {},
        "step_log": [],
        "cost_entries": [],
        "status": "RUNNING",
        "error": None,
    }

    start = time.monotonic()

    try:
        # LangGraph's invoke is synchronous — run in a thread to avoid
        # blocking the FastAPI event loop.
        final_state: Dict[str, Any] = await asyncio.to_thread(
            _compiled_graph.invoke, initial_state
        )
    except Exception:
        # Catastrophic graph-level failure (should be rare since agent
        # nodes already isolate their errors).
        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        err_msg = traceback.format_exc()
        initial_state["status"] = "FAILED"
        initial_state["error"] = f"Graph execution failed: {err_msg}"
        initial_state["step_log"].append(
            {
                "agent_name": "SYSTEM",
                "department": "orchestrator",
                "input_summary": input_prompt[:200],
                "output_summary": "Graph-level failure",
                "duration_ms": elapsed_ms,
                "error": err_msg,
            }
        )
        return initial_state

    return final_state
