"""Organization (tenant) model — PRD §5.1."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.department import Department


class Organization(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Top-level multi-tenant entity representing a company."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str] = mapped_column(String(50), default="SG", server_default="SG")

    # ── Relationships ─────────────────────────────────────────────────
    departments: Mapped[list[Department]] = relationship(
        "Department",
        back_populates="organization",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Organization name={self.name!r} country={self.country!r}>"
