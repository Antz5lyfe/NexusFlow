"""Department workspace model — PRD §5.1."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.agent import Agent
    from app.models.organization import Organization


class Department(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Isolated departmental workspace scoped to an organization."""

    __tablename__ = "departments"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    monthly_budget_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("100.00"),
        server_default="100.00",
    )
    current_spend_usd: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        server_default="0.00",
    )

    # ── Relationships ─────────────────────────────────────────────────
    organization: Mapped[Organization] = relationship(
        "Organization",
        back_populates="departments",
    )
    agents: Mapped[list[Agent]] = relationship(
        "Agent",
        back_populates="department",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Department name={self.name!r} "
            f"budget={self.monthly_budget_usd} spend={self.current_spend_usd}>"
        )
