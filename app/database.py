"""Async SQLAlchemy engine, session factory, and FastAPI dependency."""

from __future__ import annotations

import ssl
from collections.abc import AsyncGenerator
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

# ── Engine & Session Factory ──────────────────────────────────────────

_settings = get_settings()


def _prepare_db_url(raw: str) -> tuple[str, dict[str, Any]]:
    """Normalise a Postgres URL for SQLAlchemy's asyncpg driver.

    - Upgrades a bare ``postgresql://`` / ``postgres://`` scheme to
      ``postgresql+asyncpg://``, so a connection string copied verbatim from
      a managed provider (Neon, Supabase, …) works without hand-editing.
    - asyncpg does not understand libpq's ``sslmode`` query parameter and
      errors if it is left in the URL. When the provider asks for SSL we drop
      the parameter and enable TLS via ``connect_args`` instead.

    A plain local URL (no ``sslmode``) is returned essentially unchanged with
    no SSL, so local development keeps working untouched.
    """
    split = urlsplit(raw)

    # Only Postgres URLs need the scheme/SSL rewrite below. Non-Postgres
    # schemes (e.g. SQLite's ``sqlite+aiosqlite:///./nexusflow.db``) must be
    # returned untouched — round-tripping them through urlunsplit collapses
    # the empty-netloc "///" down to a single slash, producing an invalid
    # URL SQLAlchemy can't parse.
    if split.scheme not in ("postgresql", "postgres", "postgresql+asyncpg"):
        return raw, {}

    scheme = split.scheme
    if scheme in ("postgresql", "postgres"):
        scheme = "postgresql+asyncpg"

    params = dict(parse_qsl(split.query))
    sslmode = params.pop("sslmode", None)
    ssl_flag = params.pop("ssl", None)
    want_ssl = sslmode in ("require", "verify-ca", "verify-full") or ssl_flag in (
        "require",
        "true",
    )

    url = urlunsplit(
        (scheme, split.netloc, split.path, urlencode(params), split.fragment)
    )

    connect_args: dict[str, Any] = {}
    if want_ssl:
        connect_args["ssl"] = ssl.create_default_context()
    return url, connect_args


_db_url, _connect_args = _prepare_db_url(_settings.DATABASE_URL)

engine = create_async_engine(
    _db_url,
    echo=(_settings.APP_ENV == "development"),
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── FastAPI Dependency ────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session and ensure it is closed after the request."""
    session = async_session()
    try:
        yield session
    finally:
        await session.close()
