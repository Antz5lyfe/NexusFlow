"""Workflow execution routes.

Endpoints
~~~~~~~~~
POST /execute-workflow
    Runs the LangGraph agent graph, persists the run in ``workflow_runs``,
    and returns the full execution log.  Returns HTTP 202 with a
    ``thread_id`` if the Finance HITL gate fires (deal > $1,000).

POST /workflows/{thread_id}/approve
    Module 4 — Human-in-the-Loop callback.  The human operator sends
    ``{"approved": true/false}`` to resume or reject a paused run via
    LangGraph's ``Command(resume=...)`` pattern.
"""

from __future__ import annotations

import logging
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.engine.workflow_engine import resume_workflow, run_workflow
from app.models.workflow_run import WorkflowRun, WorkflowStatus
from app.schemas.workflow import (
    CostSummary,
    StepLogEntry,
    WorkflowApproveRequest,
    WorkflowApproveResponse,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
    WorkflowRunRead,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── List Workflows ────────────────────────────────────────────────────


@router.get(
    "/workflows",
    response_model=list[WorkflowRunRead],
    summary="List all historical workflow runs",
)
async def list_workflows(
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowRun]:
    result = await db.execute(
        select(WorkflowRun).order_by(WorkflowRun.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


# ── Execute Workflow ──────────────────────────────────────────────────


@router.post(
    "/execute-workflow",
    response_model=WorkflowExecuteResponse,
    summary="Execute a multi-agent workflow and return the full state log",
    responses={
        200: {"description": "Workflow completed successfully."},
        202: {"description": "Workflow paused — awaiting human approval (HITL gate)."},
        500: {"description": "Unrecoverable engine error — the run ID is included for debugging."},
    },
)
async def execute_workflow(
    payload: WorkflowExecuteRequest,
    db: AsyncSession = Depends(get_db),
) -> WorkflowExecuteResponse:
    """Run the Sales → Finance agent graph.

    1. Persist a ``WorkflowRun`` row with status RUNNING.
    2. Generate a ``thread_id`` (= str(run.id)) for the LangGraph checkpoint.
    3. Invoke ``run_workflow`` (LangGraph) with the user's prompt.
    4a. If the Finance HITL gate fires (deal > $1 000):
        - Update DB status → PENDING_APPROVAL, store hitl_context.
        - Return HTTP 202 with thread_id so the operator can call /approve.
    4b. Otherwise update the row with the final state and return HTTP 200.
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

    # ── 2. Derive thread_id from the DB primary key ───────────────────
    thread_id = str(run_id)
    run.thread_id = thread_id
    await _safe_commit(db)

    # ── 3. Execute the graph ──────────────────────────────────────────
    try:
        final_state = await run_workflow(payload.input_prompt, thread_id)
    except Exception:
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

    workflow_status_str = final_state.get("status", "FAILED")

    # ── 4a. HITL Gate: graph paused awaiting human approval ───────────
    if workflow_status_str == "PENDING_APPROVAL":
        hitl_ctx = final_state.get("hitl_payload") or {}
        run.status = WorkflowStatus.PENDING_APPROVAL
        run.hitl_context = hitl_ctx
        # Do NOT set completed_at — the run is not finished yet.
        await _safe_commit(db)

        logger.info(
            "Workflow %s suspended at HITL gate. thread_id=%s context=%s",
            run_id,
            thread_id,
            hitl_ctx,
        )

        # Return 202 Accepted so callers know to poll /approve.
        from fastapi.responses import JSONResponse

        return JSONResponse(  # type: ignore[return-value]
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "run_id": str(run_id),
                "status": "PENDING_APPROVAL",
                "thread_id": thread_id,
                "hitl_context": hitl_ctx,
                "step_log": [],
                "final_output": {},
                "cost_summary": None,
                "started_at": run.started_at.isoformat() if run.started_at else None,
                "completed_at": None,
                "error": None,
            },
        )

    # ── 4b. Normal completion / failure ───────────────────────────────
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
    await _persist_cost_entries(final_state.get("cost_entries", []), db)
    await _safe_commit(db)

    # ── 5. Build response ─────────────────────────────────────────────
    step_log_entries = [
        StepLogEntry(**entry)
        for entry in final_state.get("step_log", [])
    ]

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
        thread_id=thread_id,
    )


# ── Approve / Reject Endpoint (Module 4 — HITL) ───────────────────────


@router.post(
    "/workflows/{thread_id}/approve",
    response_model=WorkflowApproveResponse,
    status_code=status.HTTP_200_OK,
    summary="Resume or reject a workflow paused at the HITL gate",
    responses={
        200: {"description": "Workflow resumed and completed (or rejected)."},
        404: {"description": "No paused workflow found for the given thread_id."},
        409: {"description": "Workflow is not in PENDING_APPROVAL state."},
        500: {"description": "Graph resume failed — check server logs."},
    },
)
async def approve_workflow(
    thread_id: str,
    payload: WorkflowApproveRequest,
    db: AsyncSession = Depends(get_db),
) -> WorkflowApproveResponse:
    """Resume or reject a workflow suspended at the Finance HITL gate.

    The operator sends ``{"approved": true}`` to let the graph complete, or
    ``{"approved": false}`` to mark the run as REJECTED.

    Uses LangGraph's ``Command(resume=...)`` pattern to feed the decision
    back into the paused ``interrupt()`` call inside ``finance_agent_node``.
    """

    # ── 1. Look up the paused run ─────────────────────────────────────
    result = await db.execute(
        select(WorkflowRun).where(WorkflowRun.thread_id == thread_id)
    )
    run: WorkflowRun | None = result.scalar_one_or_none()

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No workflow run found with thread_id '{thread_id}'.",
        )

    if run.status != WorkflowStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Workflow {thread_id} is in status '{run.status.value}', "
                f"not PENDING_APPROVAL. Cannot approve/reject."
            ),
        )

    run_id: uuid.UUID = run.id

    # ── 2. Build the resume payload ───────────────────────────────────
    resume_value = {
        "approved": payload.approved,
        "operator_note": payload.operator_note or "",
    }

    # ── 3. Resume (or reject) the graph ──────────────────────────────
    try:
        final_state = await resume_workflow(thread_id, resume_value)
    except Exception:
        err = traceback.format_exc()
        logger.exception("Graph resume failed for thread_id=%s", thread_id)
        run.status = WorkflowStatus.FAILED
        run.completed_at = datetime.now(timezone.utc)
        await _safe_commit(db)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Graph resume failed for thread_id {thread_id}. Check server logs.",
        )

    # ── 4. Persist the outcome ────────────────────────────────────────
    workflow_status_str = final_state.get("status", "FAILED")
    try:
        mapped_status = WorkflowStatus(workflow_status_str)
    except ValueError:
        mapped_status = WorkflowStatus.FAILED

    run.status = mapped_status
    run.completed_at = datetime.now(timezone.utc)

    # Merge the resumed step log into any existing log already on the row.
    existing_log: list = run.step_log or []
    new_log: list = final_state.get("step_log", [])
    run.step_log = existing_log + [e for e in new_log if e not in existing_log]

    run.final_output = {
        "lead_data": final_state.get("lead_data", {}),
        "invoice_data": final_state.get("invoice_data", {}),
        "cost_entries": final_state.get("cost_entries", []),
    }
    await _persist_cost_entries(final_state.get("cost_entries", []), db)
    await _safe_commit(db)

    # ── 5. Build response ─────────────────────────────────────────────
    step_log_entries = [StepLogEntry(**e) for e in run.step_log]
    cost_entries = final_state.get("cost_entries", [])
    cost_summary = _aggregate_costs(cost_entries) if cost_entries else None

    logger.info(
        "Workflow %s (thread=%s) resumed by operator — final status: %s",
        run_id,
        thread_id,
        mapped_status.value,
    )

    return WorkflowApproveResponse(
        thread_id=thread_id,
        run_id=run_id,
        status=mapped_status.value,
        step_log=step_log_entries,
        final_output={
            "lead_data": final_state.get("lead_data", {}),
            "invoice_data": final_state.get("invoice_data", {}),
        },
        cost_summary=cost_summary,
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


async def _persist_cost_entries(cost_entries: list, db: AsyncSession) -> None:
    """Persist cost breakdown entries from LangGraph execution into CostLog table."""
    if not cost_entries:
        return
    try:
        from decimal import Decimal
        from app.models.agent import Agent
        from app.models.cost_log import CostLog, RoutingStrategy
        from app.models.department import Department

        agents_result = await db.execute(select(Agent))
        agents_by_name = {a.name: a for a in agents_result.scalars().all()}
        fallback_agent = next(iter(agents_by_name.values()), None)
        if not fallback_agent:
            return

        dept_id = fallback_agent.department_id
        dept_result = await db.execute(select(Department).where(Department.id == dept_id))
        dept = dept_result.scalar_one_or_none()

        for entry in cost_entries:
            agent_name = entry.get("agent_name", "")
            agent = agents_by_name.get(agent_name, fallback_agent)

            strategy_str = entry.get("routing_strategy", "DEFAULT")
            try:
                strategy = RoutingStrategy(strategy_str)
            except ValueError:
                strategy = RoutingStrategy.DEFAULT

            raw_cost = Decimal(str(entry.get("raw_cost_usd", 0.0)))
            savings = Decimal(str(entry.get("estimated_savings_usd", 0.0)))

            log = CostLog(
                agent_id=agent.id,
                department_id=dept_id,
                prompt_tokens=int(entry.get("prompt_tokens", 0)),
                completion_tokens=int(entry.get("completion_tokens", 0)),
                model_used=str(entry.get("model_used", "gpt-4o-mini")),
                raw_cost_usd=raw_cost,
                routing_strategy=strategy,
                estimated_savings_usd=savings,
            )
            db.add(log)
            if dept:
                dept.current_spend_usd = (dept.current_spend_usd or Decimal("0")) + raw_cost
    except Exception:
        logger.exception("Failed to persist cost entries")


async def _safe_commit(db: AsyncSession) -> None:
    """Commit, swallowing errors so the API can still respond."""
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("DB commit failed during workflow finalisation")
