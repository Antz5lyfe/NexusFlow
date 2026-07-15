"""Agent CRUD routes — scoped to a department."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import Agent
from app.models.department import Department
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────


async def _verify_dept_exists(dept_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department {dept_id} not found.",
        )


async def _get_agent_or_404(
    agent_id: uuid.UUID, db: AsyncSession
) -> Agent:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found.",
        )
    return agent


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/departments/{dept_id}/agents",
    response_model=AgentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Provision a new agent within a department",
)
async def create_agent(
    dept_id: uuid.UUID,
    payload: AgentCreate,
    db: AsyncSession = Depends(get_db),
) -> Agent:
    await _verify_dept_exists(dept_id, db)
    agent = Agent(department_id=dept_id, **payload.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get(
    "/agents",
    response_model=list[AgentRead],
    summary="List all agents across all departments",
)
async def list_all_agents(
    db: AsyncSession = Depends(get_db),
) -> list[Agent]:
    result = await db.execute(select(Agent).order_by(Agent.created_at.desc()))
    return list(result.scalars().all())


@router.get(
    "/departments/{dept_id}/agents",
    response_model=list[AgentRead],
    summary="List all agents for a department",
)
async def list_agents(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[Agent]:
    await _verify_dept_exists(dept_id, db)
    result = await db.execute(
        select(Agent)
        .where(Agent.department_id == dept_id)
        .order_by(Agent.created_at.desc())
    )
    return list(result.scalars().all())


@router.get(
    "/agents/{agent_id}",
    response_model=AgentRead,
    summary="Retrieve a single agent by ID",
)
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Agent:
    return await _get_agent_or_404(agent_id, db)


@router.patch(
    "/agents/{agent_id}",
    response_model=AgentRead,
    summary="Partially update an agent",
)
async def update_agent(
    agent_id: uuid.UUID,
    payload: AgentUpdate,
    db: AsyncSession = Depends(get_db),
) -> Agent:
    agent = await _get_agent_or_404(agent_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided for update.",
        )
    for field, value in update_data.items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete(
    "/agents/{agent_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an agent",
)
async def delete_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    agent = await _get_agent_or_404(agent_id, db)
    await db.delete(agent)
    await db.commit()
