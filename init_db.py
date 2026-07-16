#!/usr/bin/env python3
"""Initialize the database schema from models."""

import asyncio
import sys
from app.database import engine
from app.models import Base


async def init_db():
    """Create all tables defined in models."""
    try:
        # Create all tables from models
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✓ Database tables created successfully")
        return True
    except Exception as e:
        print(f"✗ Error creating database tables: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    success = asyncio.run(init_db())
    sys.exit(0 if success else 1)
