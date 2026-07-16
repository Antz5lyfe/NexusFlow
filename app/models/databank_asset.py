"""Databank asset model — uploaded documents and their OCR extraction."""

from __future__ import annotations

import enum
from typing import Optional

from sqlalchemy import Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONType, TimestampMixin, UUIDPrimaryKeyMixin


class AssetStatus(str, enum.Enum):
    """Lifecycle of an uploaded asset as it moves through extraction."""

    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PARSED = "PARSED"
    FAILED = "FAILED"


class DatabankAsset(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A document uploaded to the databank, plus its extracted OCR payload."""

    __tablename__ = "databank_assets"

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    #: Path on local disk. Named generically so a future S3 URL can replace it
    #: without a schema change.
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False, default=0)
    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, name="asset_status_enum"),
        default=AssetStatus.UPLOADED,
        server_default=AssetStatus.UPLOADED.value,
        nullable=False,
    )
    #: Structured OCR result. Null until extraction succeeds.
    extracted_json: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)
    #: Populated only when ``status`` is FAILED, for operator diagnosis.
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<DatabankAsset filename={self.filename!r} status={self.status.value}>"
