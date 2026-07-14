"""Organization CRUD routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.organization import Organization
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────


async def _get_org_or_404(
    org_id: uuid.UUID, db: AsyncSession
) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization {org_id} not found.",
        )
    return org


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/organizations",
    response_model=OrganizationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new organization (tenant)",
)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
) -> Organization:
    org = Organization(**payload.model_dump())
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@router.get(
    "/organizations",
    response_model=list[OrganizationRead],
    summary="List all organizations",
)
async def list_organizations(
    db: AsyncSession = Depends(get_db),
) -> list[Organization]:
    result = await db.execute(
        select(Organization).order_by(Organization.created_at.desc())
    )
    return list(result.scalars().all())


@router.get(
    "/organizations/{org_id}",
    response_model=OrganizationRead,
    summary="Retrieve a single organization by ID",
)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Organization:
    return await _get_org_or_404(org_id, db)


@router.patch(
    "/organizations/{org_id}",
    response_model=OrganizationRead,
    summary="Partially update an organization",
)
async def update_organization(
    org_id: uuid.UUID,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
) -> Organization:
    org = await _get_org_or_404(org_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided for update.",
        )
    for field, value in update_data.items():
        setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return org


@router.delete(
    "/organizations/{org_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an organization and cascade to all children",
)
async def delete_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    org = await _get_org_or_404(org_id, db)
    await db.delete(org)
    await db.commit()
