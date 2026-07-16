"""feat: add databank_assets table

Revision ID: d6835731e782
Revises: 0e429d7ba419
Create Date: 2026-07-16 10:51:30.822518

Adds the ``databank_assets`` table backing the Asset Databank & Document OCR
feature: one row per uploaded document, carrying its storage path, lifecycle
status, and the structured OCR payload in ``extracted_json`` (JSONB).

NOTE: ``create_table`` implicitly creates the ``asset_status_enum`` Postgres
type, but ``drop_table`` does not remove it. The downgrade drops the type
explicitly, otherwise a downgrade→upgrade round-trip fails with
"type asset_status_enum already exists".
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Revision identifiers, used by Alembic.
revision: str = "d6835731e782"
down_revision: Union[str, None] = "0e429d7ba419"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "databank_assets",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("UPLOADED", "PROCESSING", "PARSED", "FAILED", name="asset_status_enum"),
            server_default="UPLOADED",
            nullable=False,
        ),
        sa.Column("extracted_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("databank_assets")
    # drop_table leaves the enum type behind — remove it so re-upgrade works.
    sa.Enum(name="asset_status_enum").drop(op.get_bind(), checkfirst=True)
