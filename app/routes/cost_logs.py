"""Cost Log routes — recording, listing, and budget status (FR-2.3)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import Agent
from app.models.cost_log import CostLog, RoutingStrategy
from app.models.department import Department
from app.schemas.cost_log import BudgetStatus, CostLogCreate, CostLogRead

router = APIRouter()

# Budget alert threshold — FR-2.3: alert at 90 % of monthly budget.
_BUDGET_ALERT_THRESHOLD = Decimal("0.90")


# ── Helpers ───────────────────────────────────────────────────────────


async def _get_agent_or_404(agent_id: uuid.UUID, db: AsyncSession) -> Agent:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found.",
        )
    return agent


async def _get_dept_or_404(dept_id: uuid.UUID, db: AsyncSession) -> Department:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if dept is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department {dept_id} not found.",
        )
    return dept


def _compute_budget_status(dept: Department) -> BudgetStatus:
    """Build a BudgetStatus response for the given department."""
    budget = dept.monthly_budget_usd or Decimal("0.00")
    spend = dept.current_spend_usd or Decimal("0.00")
    remaining = max(budget - spend, Decimal("0.00"))
    utilization = (
        (spend / budget * Decimal("100")).quantize(Decimal("0.01"))
        if budget > 0
        else Decimal("0.00")
    )
    return BudgetStatus(
        department_id=dept.id,
        department_name=dept.name,
        monthly_budget_usd=budget,
        current_spend_usd=spend,
        remaining_usd=remaining,
        utilization_pct=utilization,
        budget_alert=spend >= budget * _BUDGET_ALERT_THRESHOLD,
    )


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/agents/{agent_id}/cost-logs",
    response_model=CostLogRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a cost log entry and increment department spend",
    responses={
        201: {
            "description": "Cost log created. Check the `X-Budget-Alert` "
            "response header — `true` when spend ≥ 90 % of budget.",
        },
    },
)
async def create_cost_log(
    agent_id: uuid.UUID,
    payload: CostLogCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Atomically:
    1. Look up the agent and its parent department.
    2. Insert a new CostLog row.
    3. Increment ``departments.current_spend_usd`` by ``raw_cost_usd``.
    4. Return the log entry + a budget-alert header when the 90 % threshold
       is breached (FR-2.3).
    """
    agent = await _get_agent_or_404(agent_id, db)

    # Fetch the parent department for budget tracking.
    dept = await _get_dept_or_404(agent.department_id, db)

    # Check if the department budget is already exceeded.
    if dept.current_spend_usd >= dept.monthly_budget_usd:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Department '{dept.name}' has exhausted its monthly budget "
                f"(${dept.monthly_budget_usd}). Agent execution blocked per FR-2.3."
            ),
        )

    # Create the cost log entry.
    log = CostLog(
        agent_id=agent_id,
        department_id=dept.id,
        **payload.model_dump(),
    )
    db.add(log)

    # Atomically increment department spend.
    dept.current_spend_usd = (dept.current_spend_usd or Decimal("0")) + payload.raw_cost_usd

    await db.commit()
    await db.refresh(log)
    await db.refresh(dept)

    # Build response with budget alert header.
    budget_info = _compute_budget_status(dept)
    from fastapi.responses import JSONResponse

    response = JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=CostLogRead.model_validate(log).model_dump(mode="json"),
    )
    response.headers["X-Budget-Alert"] = str(budget_info.budget_alert).lower()
    response.headers["X-Budget-Utilization-Pct"] = str(budget_info.utilization_pct)
    return response


@router.get(
    "/departments/{dept_id}/cost-logs",
    response_model=list[CostLogRead],
    summary="List cost logs for a department with optional filters",
)
async def list_cost_logs(
    dept_id: uuid.UUID,
    routing_strategy: Optional[RoutingStrategy] = Query(default=None),
    since: Optional[datetime] = Query(
        default=None,
        description="Return logs created after this ISO-8601 timestamp.",
    ),
    until: Optional[datetime] = Query(
        default=None,
        description="Return logs created before this ISO-8601 timestamp.",
    ),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[CostLog]:
    await _get_dept_or_404(dept_id, db)

    stmt = (
        select(CostLog)
        .where(CostLog.department_id == dept_id)
        .order_by(CostLog.timestamp.desc())
    )

    if routing_strategy is not None:
        stmt = stmt.where(CostLog.routing_strategy == routing_strategy)
    if since is not None:
        stmt = stmt.where(CostLog.timestamp >= since)
    if until is not None:
        stmt = stmt.where(CostLog.timestamp <= until)

    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/departments/{dept_id}/budget-status",
    response_model=BudgetStatus,
    summary="Get budget utilization and alert status for a department",
)
async def get_budget_status(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BudgetStatus:
    dept = await _get_dept_or_404(dept_id, db)
    return _compute_budget_status(dept)
