"""NexusFlow Orchestrator — FastAPI application entry-point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import async_session, engine
from app.models import Base
from app.routes import agents, cost_logs, databank, departments, organizations, workflows

settings = get_settings()


async def _seed_default_data() -> None:
    """Seed default organization, department, and agents if the database is empty."""
    from decimal import Decimal
    from sqlalchemy import select
    from app.models import Agent, Department, Organization

    async with async_session() as db:
        result = await db.execute(select(Agent))
        if result.first() is not None:
            return

        org = Organization(name="NexusFlow Enterprise")
        db.add(org)
        await db.flush()

        dept = Department(
            org_id=org.id,
            name="Executive Operations",
            monthly_budget_usd=Decimal("10000.00"),
            current_spend_usd=Decimal("0.00"),
        )
        db.add(dept)
        await db.flush()

        sales_agent = Agent(
            department_id=dept.id,
            name="Sales Lead Qualifier Agent",
            role_description="Qualifies ASEAN enterprise leads and assigns scoring tiers.",
            system_prompt="You are a sales lead qualification specialist.",
            default_model="gpt-4o-mini",
            is_active=True,
        )
        finance_agent = Agent(
            department_id=dept.id,
            name="Finance Invoice Generator Agent",
            role_description="Generates formatted corporate invoices and triggers HITL threshold checks.",
            system_prompt="You are a corporate finance and billing specialist.",
            default_model="gpt-4o-mini",
            is_active=True,
        )
        db.add_all([sales_agent, finance_agent])
        await db.commit()


# ── Lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown hooks — auto-create tables and dispose DB engine on teardown."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_default_data()
    yield
    await engine.dispose()


# ── App Factory ───────────────────────────────────────────────────────

app = FastAPI(
    title="NexusFlow Orchestrator",
    version="0.1.0",
    description=(
        "Enterprise-grade multi-tenant Agentic AI Orchestration Interface "
        "for ASEAN SMEs. Phase 1 — Foundation API."
    ),
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────

API_V1 = "/api/v1"

app.include_router(organizations.router, prefix=API_V1, tags=["Organizations"])
app.include_router(departments.router, prefix=API_V1, tags=["Departments"])
app.include_router(agents.router, prefix=API_V1, tags=["Agents"])
app.include_router(cost_logs.router, prefix=API_V1, tags=["Cost Logs"])
app.include_router(workflows.router, prefix=API_V1, tags=["Workflows"])
app.include_router(databank.router, prefix=API_V1, tags=["Databank"])


# ── Health Check ──────────────────────────────────────────────────────

@app.get("/healthz", tags=["System"])
async def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}
