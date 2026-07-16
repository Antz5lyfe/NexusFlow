"""SQLAlchemy declarative base with common mixins."""

from __future__ import annotations

import json
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, TypeDecorator, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class JSONType(TypeDecorator):
    """PostgreSQL JSONB with SQLite Text fallback."""
    
    impl = JSONB
    cache_ok = True

    def load_dialect_impl(self, dialect):
        """Use JSONB for PostgreSQL, Text for SQLite."""
        if dialect.name == "sqlite":
            return dialect.type_descriptor(String())
        return dialect.type_descriptor(JSONB())

    def process_bind_param(self, value, dialect):
        """Serialize to JSON for SQLite."""
        if dialect.name == "sqlite" and value is not None:
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        """Deserialize from JSON for SQLite."""
        if dialect.name == "sqlite" and value is not None:
            return json.loads(value)
        return value


class ArrayType(TypeDecorator):
    """PostgreSQL ARRAY with SQLite Text fallback (JSON-encoded list)."""
    
    impl = ARRAY
    cache_ok = True

    def __init__(self, item_type=String, *args, **kwargs):
        self.item_type = item_type
        super().__init__(item_type, *args, **kwargs)

    def load_dialect_impl(self, dialect):
        """Use ARRAY for PostgreSQL, Text for SQLite."""
        if dialect.name == "sqlite":
            return dialect.type_descriptor(String())
        return dialect.type_descriptor(ARRAY(self.item_type))

    def process_bind_param(self, value, dialect):
        """Serialize to JSON for SQLite."""
        if dialect.name == "sqlite" and value is not None:
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        """Deserialize from JSON for SQLite."""
        if dialect.name == "sqlite" and value is not None:
            if isinstance(value, str):
                return json.loads(value)
        return value


class Base(DeclarativeBase):
    """Shared declarative base for all NexusFlow models."""

    pass


class TimestampMixin:
    """Adds a server-defaulted ``created_at`` column."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    """Adds a UUID primary key column named ``id``."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
