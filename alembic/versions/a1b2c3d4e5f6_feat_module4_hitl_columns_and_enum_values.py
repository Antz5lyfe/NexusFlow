"""feat: module4 hitl columns and enum values

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-07-15

Adds Module 4 Human-in-the-Loop (HITL) gating support:
  - Extends the ``workflow_status_enum`` Postgres enum type with the new
    ``PENDING_APPROVAL`` and ``REJECTED`` values (PostgreSQL only).
  - Adds ``thread_id`` VARCHAR(255) column (indexed) to ``workflow_runs``
    so the approve endpoint can look up a run by its LangGraph thread key.
  - Adds ``hitl_context`` column to ``workflow_runs`` to store the
    interrupt payload (amount, company, reason) for the operator UI.

NOTE: Postgres does not support removing enum values in a transaction.
The ``downgrade()`` path removes the columns but leaves the enum values
in place (they are harmless if unused).
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Get the current database dialect
    dialect = op.get_context().dialect.name
    
    # ── 1. Extend the workflow_status_enum with new values (PostgreSQL only) ────
    if dialect == "postgresql":
        # Postgres requires ALTER TYPE ... ADD VALUE outside a transaction block.
        op.execute("COMMIT")
        op.execute(
            "ALTER TYPE workflow_status_enum ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL'"
        )
        op.execute(
            "ALTER TYPE workflow_status_enum ADD VALUE IF NOT EXISTS 'REJECTED'"
        )

    # ── 2. Add thread_id column ───────────────────────────────────────
    op.add_column(
        "workflow_runs",
        sa.Column(
            "thread_id",
            sa.String(length=255),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_workflow_runs_thread_id",
        "workflow_runs",
        ["thread_id"],
        unique=False,
    )

    # ── 3. Add hitl_context column ────────────────────────────────────
    # Use JSONB for PostgreSQL, TEXT for SQLite
    if dialect == "postgresql":
        hitl_context_type = postgresql.JSONB(astext_type=sa.Text())
    else:
        hitl_context_type = sa.Text()
    
    op.add_column(
        "workflow_runs",
        sa.Column(
            "hitl_context",
            hitl_context_type,
            nullable=True,
        ),
    )


def downgrade() -> None:
    # Remove the two new columns.
    op.drop_index("ix_workflow_runs_thread_id", table_name="workflow_runs")
    op.drop_column("workflow_runs", "thread_id")
    op.drop_column("workflow_runs", "hitl_context")
    # NOTE: Postgres does not support DROP VALUE on enum types.
    # The PENDING_APPROVAL and REJECTED enum labels remain but are unused.
