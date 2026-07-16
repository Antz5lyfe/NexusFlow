"""feat: add tools array to agents

Revision ID: 0e429d7ba419
Revises: a1b2c3d4e5f6
Create Date: 2026-07-16 09:52:42.473917

Adds the ``tools`` column to ``agents`` — a Postgres native ``VARCHAR[]``
holding the tool keys (e.g. ``web_search``) that the LangGraph router binds
to the agent's LLM at run time.

The ``server_default`` of ``'{}'`` backfills rows that pre-date this column
with an empty array, so the NOT NULL constraint is satisfied without a
separate data migration and no existing agent is lost.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Revision identifiers, used by Alembic.
revision: str = "0e429d7ba419"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column(
            "tools",
            postgresql.ARRAY(sa.String()),
            server_default="{}",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("agents", "tools")
