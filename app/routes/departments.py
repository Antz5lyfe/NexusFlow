"""Department CRUD routes — scoped to an organization."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.department import Department
from app.models.organization import Organization
from app.schemas.department import (
    DepartmentCreate,
    DepartmentRead,
    DepartmentUpdate,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────


async def _verify_org_exists(org_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization {org_id} not found.",
        )


async def _get_dept_or_404(
    dept_id: uuid.UUID, db: AsyncSession
) -> Department:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if dept is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department {dept_id} not found.",
        )
    return dept


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post(
    "/organizations/{org_id}/departments",
    response_model=DepartmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a department within an organization",
)
async def create_department(
    org_id: uuid.UUID,
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
) -> Department:
    await _verify_org_exists(org_id, db)
    dept = Department(org_id=org_id, **payload.model_dump())
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.get(
    "/organizations/{org_id}/departments",
    response_model=list[DepartmentRead],
    summary="List all departments for an organization",
)
async def list_departments(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[Department]:
    await _verify_org_exists(org_id, db)
    result = await db.execute(
        select(Department)
        .where(Department.org_id == org_id)
        .order_by(Department.created_at.desc())
    )
    return list(result.scalars().all())


@router.get(
    "/departments",
    response_model=list[DepartmentRead],
    summary="List all departments across all organizations",
)
async def list_all_departments(
    db: AsyncSession = Depends(get_db),
) -> list[Department]:
    result = await db.execute(select(Department).order_by(Department.created_at.desc()))
    return list(result.scalars().all())


@router.get(
    "/departments/{dept_id}",
    response_model=DepartmentRead,
    summary="Retrieve a single department by ID",
)
async def get_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Department:
    return await _get_dept_or_404(dept_id, db)


@router.patch(
    "/departments/{dept_id}",
    response_model=DepartmentRead,
    summary="Partially update a department (name, budget, spend)",
)
async def update_department(
    dept_id: uuid.UUID,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
) -> Department:
    dept = await _get_dept_or_404(dept_id, db)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields provided for update.",
        )
    for field, value in update_data.items():
        setattr(dept, field, value)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete(
    "/departments/{dept_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete a department and cascade to agents",
)
async def delete_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    dept = await _get_dept_or_404(dept_id, db)
    await db.delete(dept)
    await db.commit()
