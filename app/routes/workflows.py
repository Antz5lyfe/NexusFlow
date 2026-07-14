"""Workflow execution route — POST /api/v1/execute-workflow.

Runs the LangGraph agent graph asynchronously, persists the run in the
``workflow_runs`` table, and returns the full execution log.
"""

from __future__ import annotations

import logging
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.engine.workflow_engine import run_workflow
from app.models.workflow_run import WorkflowRun, WorkflowStatus
from app.schemas.workflow import (
    CostSummary,
    StepLogEntry,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Endpoint ──────────────────────────────────────────────────────────


@router.post(
    "/execute-workflow",
    response_model=WorkflowExecuteResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute a multi-agent workflow and return the full state log",
    responses={
        500: {"description": "Unrecoverable engine error — the run ID is included for debugging."},
    },
)
async def execute_workflow(
    payload: WorkflowExecuteRequest,
    db: AsyncSession = Depends(get_db),
) -> WorkflowExecuteResponse:
    """Run the Sales → Finance agent graph.

    1. Persist a ``WorkflowRun`` row with status RUNNING.
    2. Invoke ``run_workflow`` (LangGraph) with the user's prompt.
    3. Update the row with final state, step log, and status.
    4. Return the structured response with cost summary.
    """

    # ── 1. Record the run ─────────────────────────────────────────────
    run = WorkflowRun(
        org_id=payload.org_id,
        status=WorkflowStatus.RUNNING,
        input_prompt=payload.input_prompt,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)

    try:
        await db.commit()
        await db.refresh(run)
    except Exception:
        await db.rollback()
        logger.exception("Failed to persist WorkflowRun")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialise workflow run in database.",
        )

    run_id: uuid.UUID = run.id

    # ── 2. Execute the graph ──────────────────────────────────────────
    try:
        final_state = await run_workflow(payload.input_prompt)
    except Exception:
        # Catastrophic failure — should be extremely rare since
        # run_workflow itself catches errors.
        err = traceback.format_exc()
        logger.exception("Unrecoverable engine error for run %s", run_id)
        run.status = WorkflowStatus.FAILED
        run.completed_at = datetime.now(timezone.utc)
        run.step_log = [
            {
                "agent_name": "SYSTEM",
                "department": "orchestrator",
                "input_summary": payload.input_prompt[:200],
                "output_summary": "Unrecoverable engine error",
                "duration_ms": 0,
                "error": err,
            }
        ]
        await _safe_commit(db)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Engine error on run {run_id}. Check server logs.",
        )

    # ── 3. Persist the result ─────────────────────────────────────────
    workflow_status_str = final_state.get("status", "FAILED")
    try:
        mapped_status = WorkflowStatus(workflow_status_str)
    except ValueError:
        mapped_status = (
            WorkflowStatus.COMPLETED
            if workflow_status_str == "RUNNING"
            else WorkflowStatus.FAILED
        )

    run.status = mapped_status
    run.completed_at = datetime.now(timezone.utc)
    run.step_log = final_state.get("step_log", [])
    run.final_output = {
        "lead_data": final_state.get("lead_data", {}),
        "invoice_data": final_state.get("invoice_data", {}),
        "cost_entries": final_state.get("cost_entries", []),
    }
    await _safe_commit(db)

    # ── 4. Build response ─────────────────────────────────────────────
    step_log_entries = [
        StepLogEntry(**entry)
        for entry in final_state.get("step_log", [])
    ]

    # Aggregate cost entries into a summary.
    cost_entries = final_state.get("cost_entries", [])
    cost_summary = _aggregate_costs(cost_entries) if cost_entries else None

    return WorkflowExecuteResponse(
        run_id=run_id,
        status=mapped_status.value,
        step_log=step_log_entries,
        final_output={
            "lead_data": final_state.get("lead_data", {}),
            "invoice_data": final_state.get("invoice_data", {}),
        },
        cost_summary=cost_summary,
        started_at=run.started_at,
        completed_at=run.completed_at,
        error=final_state.get("error"),
    )


# ── Helpers ───────────────────────────────────────────────────────────


def _aggregate_costs(cost_entries: list) -> CostSummary:
    """Aggregate per-agent cost entries into a single summary."""
    total_prompt = 0
    total_completion = 0
    total_cost = 0.0
    total_savings = 0.0
    models: list = []

    for entry in cost_entries:
        total_prompt += entry.get("prompt_tokens", 0)
        total_completion += entry.get("completion_tokens", 0)
        total_cost += entry.get("raw_cost_usd", 0.0)
        total_savings += entry.get("estimated_savings_usd", 0.0)
        model = entry.get("model_used", "")
        if model and model not in models:
            models.append(model)

    return CostSummary(
        total_prompt_tokens=total_prompt,
        total_completion_tokens=total_completion,
        total_tokens=total_prompt + total_completion,
        total_raw_cost_usd=round(total_cost, 8),
        total_estimated_savings_usd=round(total_savings, 8),
        models_used=models,
    )


async def _safe_commit(db: AsyncSession) -> None:
    """Commit, swallowing errors so the API can still respond."""
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("DB commit failed during workflow finalisation")
