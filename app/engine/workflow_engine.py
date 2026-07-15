"""LangGraph-based workflow engine — builds and runs the agent graph.

The graph implements the inter-agent handoff pattern from PRD §3.1 FR-1.3:

    START → sales_agent → should_continue → finance_agent → END
                               ↓ (on error)
                              END

Module 4 adds a Human-in-the-Loop (HITL) gate inside ``finance_agent_node``:
if the invoice total exceeds $1,000, LangGraph's ``interrupt()`` suspends the
graph at that node and raises ``GraphInterrupt``.  The engine catches it,
returns a ``PENDING_APPROVAL`` sentinel dict to the route, and the route
persists the paused state + returns HTTP 202.

When the operator calls ``POST /approve``, ``resume_workflow`` issues a
``Command(resume={...})`` to unblock the checkpoint and the graph runs to
completion (or REJECTED).

Checkpointing
~~~~~~~~~~~~~
``MemorySaver`` stores all checkpoints in process memory — zero external
dependencies, free-tier safe.  For production swap for
``langgraph.checkpoint.postgres.aio.AsyncPostgresSaver``.

``run_workflow`` is the public async entry-point used by the API route.
Agent node functions are synchronous, so they run via
``asyncio.to_thread`` to keep the event loop non-blocking.
"""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from typing import Any, Dict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import Command

from app.engine.agents import finance_agent_node, sales_agent_node
from app.engine.state import WorkflowState

logger = logging.getLogger(__name__)

# ── Checkpointer ──────────────────────────────────────────────────────
# Module-level singleton: shared across all requests so in-flight
# checkpoints survive between the initial invoke and the resume call.
_checkpointer = MemorySaver()


# ── Graph Construction ────────────────────────────────────────────────


def _should_continue(state: Dict[str, Any]) -> str:
    """Conditional edge: route to END on failure, else to finance_agent."""
    if state.get("status") == "FAILED":
        return "end"
    return "finance_agent"


def build_workflow_graph() -> Any:
    """Construct and compile the LangGraph StateGraph with a checkpointer.

    The checkpointer is **required** for ``interrupt()`` to work — LangGraph
    stores the mid-execution state in it so that ``Command(resume=...)`` can
    restore and continue the run.

    Returns a compiled graph object whose ``.invoke()`` method accepts an
    initial ``WorkflowState`` and a ``config`` dict containing the
    ``thread_id``.
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

    # checkpointer= is the critical addition for Module 4.
    return graph.compile(checkpointer=_checkpointer)


# Pre-compile the graph once at module load (stateless graph definition,
# but stateful checkpoints stored in _checkpointer).
_compiled_graph = build_workflow_graph()


# ── Public API ────────────────────────────────────────────────────────


async def run_workflow(input_prompt: str, thread_id: str) -> Dict[str, Any]:
    """Execute the full agent graph asynchronously.

    Args:
        input_prompt: The user's natural-language request.
        thread_id:    A stable string key (typically ``str(run.id)``) used
                      by LangGraph to namespace the checkpoint.  Must be
                      passed on every call for a given run.

    Returns:
        The final ``WorkflowState`` dict, **or** a sentinel dict with
        ``status="PENDING_APPROVAL"`` and the interrupt context when the
        Finance HITL gate fires.

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
        "thread_id": thread_id,
        "hitl_payload": None,
    }

    config = {"configurable": {"thread_id": thread_id}}
    start = time.monotonic()

    try:
        # In LangGraph 0.6.x, invoke() does NOT raise GraphInterrupt when
        # interrupt() fires.  It silently suspends, saves the checkpoint,
        # and returns partial state.  We detect the pause via get_state().
        await asyncio.to_thread(_compiled_graph.invoke, initial_state, config)
    except Exception:
        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        err_msg = traceback.format_exc()
        logger.exception("Graph execution failed for thread_id=%s", thread_id)
        initial_state["status"] = "FAILED"
        initial_state["error"] = f"Graph execution failed: {err_msg}"
        initial_state["step_log"].append(
            {
                "agent_name": "SYSTEM",
                "department": "orchestrator",
                "input_summary": input_prompt[:200],
                "output_summary": "Graph-level failure",
                "duration_ms": round((time.monotonic() - start) * 1000, 2),
                "error": err_msg,
            }
        )
        return initial_state

    # ── Inspect checkpoint for HITL interrupt ─────────────────────────
    # get_state() returns the latest saved snapshot.  If any task has
    # .interrupts the graph is paused at an interrupt() call.
    snapshot = await asyncio.to_thread(_compiled_graph.get_state, config)

    hitl_context: Dict[str, Any] = {}
    paused = False
    for task in snapshot.tasks:
        if task.interrupts:
            paused = True
            for interrupt_obj in task.interrupts:
                val = getattr(interrupt_obj, "value", {})
                if isinstance(val, dict):
                    hitl_context = val
                    break
            break

    if paused:
        logger.info(
            "Graph paused for thread_id=%s — HITL gate triggered. context=%s",
            thread_id,
            hitl_context,
        )
        # Include state accumulated so far (sales step_log, cost_entries).
        accumulated: Dict[str, Any] = dict(snapshot.values)
        return {
            **accumulated,
            "status": "PENDING_APPROVAL",
            "thread_id": thread_id,
            "hitl_payload": hitl_context,
        }

    # Normal completion — return final state from checkpoint.
    return dict(snapshot.values)


async def resume_workflow(thread_id: str, resume_value: Dict[str, Any]) -> Dict[str, Any]:
    """Resume a paused graph using LangGraph's Command(resume=...) pattern.

    Args:
        thread_id:    The same thread_id used in the original ``run_workflow``
                      call — identifies the checkpoint to restore.
        resume_value: Dict forwarded to the suspended ``interrupt()`` call
                      as its return value.  Should contain at minimum
                      ``{"approved": bool, "operator_note": str}``.

    Returns:
        The final ``WorkflowState`` dict after the graph runs to completion
        (status COMPLETED or REJECTED), or a dict with status FAILED on error.
    """
    config = {"configurable": {"thread_id": thread_id}}
    start = time.monotonic()

    try:
        final_state: Dict[str, Any] = await asyncio.to_thread(
            _compiled_graph.invoke,
            Command(resume=resume_value),
            config,
        )
    except Exception:
        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        err_msg = traceback.format_exc()
        logger.exception("Graph resume failed for thread_id=%s", thread_id)
        return {
            "status": "FAILED",
            "error": f"Graph resume failed: {err_msg}",
            "thread_id": thread_id,
            "step_log": [
                {
                    "agent_name": "SYSTEM",
                    "department": "orchestrator",
                    "input_summary": f"Resume attempt for thread {thread_id}",
                    "output_summary": "Resume failure",
                    "duration_ms": elapsed_ms,
                    "error": err_msg,
                }
            ],
            "cost_entries": [],
            "lead_data": {},
            "invoice_data": {},
        }

    return final_state
