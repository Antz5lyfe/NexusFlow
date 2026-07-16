"""Agent CRUD routes — scoped to a department."""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.engine.llm_clients import calculate_cost, call_llm
from app.models.agent import Agent
from app.models.cost_log import CostLog, RoutingStrategy
from app.models.department import Department
from app.schemas.agent import (
    AgentCreate,
    AgentDocumentInfo,
    AgentRead,
    AgentRunResponse,
    AgentUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Bound how much extracted PDF text we feed to the LLM — keeps latency and
# theoretical cost sane for very large documents.
MAX_DOCUMENT_CHARS = 20_000


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
    response_model=None,
    summary="Delete an agent",
)
async def delete_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    agent = await _get_agent_or_404(agent_id, db)
    await db.delete(agent)
    await db.commit()


# ── Ad-hoc single-agent run (Agent Console) ────────────────────────────


@router.post(
    "/agents/{agent_id}/run",
    response_model=AgentRunResponse,
    summary="Send a one-off prompt (optionally with a PDF) to a single registered agent",
    responses={
        404: {"description": "Agent not found."},
        409: {"description": "Agent is paused — activate it first."},
        400: {"description": "Uploaded file is not a readable PDF."},
    },
)
async def run_agent(
    agent_id: uuid.UUID,
    prompt: str = Form(..., min_length=1),
    file: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
) -> AgentRunResponse:
    """Call this agent's own model + instructions directly — no fixed pipeline.

    Any registered agent (a core node like Sales/Finance, or a custom one
    like Marketing) can be invoked this way. If a PDF is attached, its text
    is extracted and handed to the agent as context alongside the prompt.
    """
    agent = await _get_agent_or_404(agent_id, db)

    if not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent '{agent.name}' is paused. Activate it before running.",
        )

    document_info: AgentDocumentInfo | None = None
    user_prompt = prompt

    if file is not None:
        filename = file.filename or "document.pdf"
        is_pdf = (file.content_type == "application/pdf") or filename.lower().endswith(
            ".pdf"
        )
        if not is_pdf:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported for document upload.",
            )

        raw_bytes = await file.read()
        doc_text = _extract_pdf_text(raw_bytes)
        if doc_text is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not read that file as a PDF.",
            )

        truncated = len(doc_text) > MAX_DOCUMENT_CHARS
        doc_text = doc_text[:MAX_DOCUMENT_CHARS]
        document_info = AgentDocumentInfo(
            filename=filename,
            extracted_chars=len(doc_text),
            truncated=truncated,
        )

        if doc_text.strip():
            user_prompt = (
                f"A document named '{filename}' was uploaded. "
                f"Its extracted text content:\n\n{doc_text}\n\n"
                f"---\n\nUser request: {prompt}"
            )
        else:
            user_prompt = (
                f"A document named '{filename}' was uploaded, but no text could "
                f"be extracted from it (it may be a scanned image with no text "
                f"layer). Let the user know, then respond to their request as "
                f"best you can:\n\n{prompt}"
            )

    llm_response = call_llm(
        prompt=user_prompt,
        system_prompt=agent.system_prompt,
        model=agent.default_model or "openai/gpt-4o-mini",
    )
    cost_entry = calculate_cost(llm_response)

    try:
        strategy = RoutingStrategy(cost_entry.routing_strategy)
    except ValueError:
        strategy = RoutingStrategy.DEFAULT

    log = CostLog(
        agent_id=agent.id,
        department_id=agent.department_id,
        prompt_tokens=cost_entry.prompt_tokens,
        completion_tokens=cost_entry.completion_tokens,
        model_used=cost_entry.model_used,
        raw_cost_usd=Decimal(str(cost_entry.raw_cost_usd)),
        routing_strategy=strategy,
        estimated_savings_usd=Decimal(str(cost_entry.estimated_savings_usd)),
    )
    db.add(log)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Failed to persist cost log for agent run %s", agent_id)

    return AgentRunResponse(
        agent_id=agent.id,
        agent_name=agent.name,
        reply=llm_response.text,
        model_used=llm_response.model_used,
        prompt_tokens=llm_response.prompt_tokens,
        completion_tokens=llm_response.completion_tokens,
        cost_usd=cost_entry.raw_cost_usd,
        saved_usd=cost_entry.estimated_savings_usd,
        document=document_info,
    )


def _extract_pdf_text(raw_bytes: bytes) -> str | None:
    """Extract text from PDF bytes. Returns None if the file isn't a valid PDF."""
    import io

    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(raw_bytes))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages_text).strip()
    except Exception:
        logger.exception("Failed to parse uploaded PDF")
        return None
