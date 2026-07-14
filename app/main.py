"""NexusFlow Orchestrator — FastAPI application entry-point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine
from app.routes import agents, cost_logs, departments, organizations, workflows

settings = get_settings()


# ── Lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown hooks — dispose the DB engine on teardown."""
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


# ── Health Check ──────────────────────────────────────────────────────

@app.get("/healthz", tags=["System"])
async def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}
