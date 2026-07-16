"""Pydantic schemas for the databank asset API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.databank_asset import AssetStatus


# ── Extraction payload ────────────────────────────────────────────────


class LineItem(BaseModel):
    """A single billed row on an invoice."""

    description: str = ""
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None


class ExtractedInvoice(BaseModel):
    """The financial vectors the LLM is asked to pull out of a document.

    Every field is optional: a real document may be unreadable, partially
    legible, or simply not an invoice, and a null is more honest than a
    fabricated value.
    """

    invoice_id: Optional[str] = None
    vendor_name: Optional[str] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    issue_date: Optional[str] = None
    line_items: list[LineItem] = Field(default_factory=list)


# ── Response schema ───────────────────────────────────────────────────


class DatabankAssetRead(BaseModel):
    """Serialised databank asset returned from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    file_path: str
    content_type: str
    size_bytes: int
    status: AssetStatus
    extracted_json: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime
