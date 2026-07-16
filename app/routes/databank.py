"""Databank routes — document upload, OCR extraction, and retrieval."""

from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session, get_db
from app.engine.document_extraction import (
    UnsupportedDocumentError,
    extract_document_fields,
)
from app.engine.llm_clients import SUPPORTED_VISION_MIME_TYPES
from app.models.databank_asset import AssetStatus, DatabankAsset
from app.schemas.databank import DatabankAssetRead

logger = logging.getLogger(__name__)

router = APIRouter()

_settings = get_settings()

#: Project root — app/routes/databank.py → app/routes → app → root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def _storage_dir() -> Path:
    """Resolve (and create) the upload directory."""
    configured = Path(_settings.DATABANK_STORAGE_DIR)
    path = configured if configured.is_absolute() else _PROJECT_ROOT / configured
    path.mkdir(parents=True, exist_ok=True)
    return path


# ── Background extraction ─────────────────────────────────────────────


async def _run_extraction(asset_id: uuid.UUID) -> None:
    """Read the stored file, extract its fields, and record the outcome.

    Runs after the upload response has been returned. It opens its own
    session because the request-scoped one is already closed by then, and
    it must never raise: an unhandled error in a background task is
    invisible to the client, so failures are persisted on the row instead.
    """
    async with async_session() as db:
        asset = await db.get(DatabankAsset, asset_id)
        if asset is None:
            logger.warning("Extraction skipped — asset %s vanished", asset_id)
            return

        asset.status = AssetStatus.PROCESSING
        await db.commit()

        try:
            file_bytes = await asyncio.to_thread(Path(asset.file_path).read_bytes)
            # extract_document_fields wraps a blocking SDK call, so keep it
            # off the event loop — same pattern as the workflow engine.
            payload, _response = await asyncio.to_thread(
                extract_document_fields, file_bytes, asset.content_type
            )
        except Exception as exc:  # noqa: BLE001 — must not escape a background task
            logger.exception("Extraction failed for asset %s", asset_id)
            asset.status = AssetStatus.FAILED
            asset.error = str(exc)[:2000]
            await db.commit()
            return

        asset.extracted_json = payload
        asset.status = AssetStatus.PARSED
        asset.error = None
        await db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/databank/upload",
    response_model=DatabankAssetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document and queue it for OCR extraction",
)
async def upload_asset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> DatabankAsset:
    content_type = (file.content_type or "").lower()
    if content_type not in SUPPORTED_VISION_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type {content_type!r}. Supported: "
                f"{', '.join(sorted(SUPPORTED_VISION_MIME_TYPES))}"
            ),
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )
    if len(contents) > _settings.DATABANK_MAX_UPLOAD_BYTES:
        limit_mb = _settings.DATABANK_MAX_UPLOAD_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {limit_mb:.0f} MB upload limit.",
        )

    original_name = Path(file.filename or "document").name

    # The on-disk name is derived from a fresh UUID, never from user input,
    # so a crafted filename ("../../.env") cannot escape the storage dir.
    asset_id = uuid.uuid4()
    suffix = Path(original_name).suffix[:16]
    dest = _storage_dir() / f"{asset_id}{suffix}"
    await asyncio.to_thread(dest.write_bytes, contents)

    asset = DatabankAsset(
        id=asset_id,
        filename=original_name,
        file_path=str(dest),
        content_type=content_type,
        size_bytes=len(contents),
        status=AssetStatus.UPLOADED,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    background_tasks.add_task(_run_extraction, asset.id)
    return asset


@router.get(
    "/databank/assets",
    response_model=list[DatabankAssetRead],
    summary="List all databank assets, newest first",
)
async def list_assets(db: AsyncSession = Depends(get_db)) -> list[DatabankAsset]:
    result = await db.execute(
        select(DatabankAsset).order_by(DatabankAsset.created_at.desc())
    )
    return list(result.scalars().all())


@router.get(
    "/databank/assets/{asset_id}",
    response_model=DatabankAssetRead,
    summary="Retrieve a single databank asset",
)
async def get_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DatabankAsset:
    asset = await db.get(DatabankAsset, asset_id)
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found.",
        )
    return asset


@router.post(
    "/databank/assets/{asset_id}/reprocess",
    response_model=DatabankAssetRead,
    summary="Re-run extraction on an existing asset",
)
async def reprocess_asset(
    asset_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> DatabankAsset:
    asset = await db.get(DatabankAsset, asset_id)
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found.",
        )
    background_tasks.add_task(_run_extraction, asset.id)
    return asset


@router.delete(
    "/databank/assets/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an asset and its stored file",
)
async def delete_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    asset = await db.get(DatabankAsset, asset_id)
    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found.",
        )

    stored = Path(asset.file_path)
    await db.delete(asset)
    await db.commit()

    # Remove the blob only after the row is gone, so a failed unlink leaves
    # an orphaned file rather than a row pointing at nothing.
    try:
        await asyncio.to_thread(stored.unlink, True)
    except OSError as exc:
        logger.warning("Could not remove %s: %s", stored, exc)
