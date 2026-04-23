"""
MongoDB Database Connection and Initialization
"""

import logging
import os
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# Global database reference
_db = None
_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Initialize MongoDB connection."""
    global _db, _client
    
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB", "keiyeta")
    
    try:
        _client = AsyncClient(mongo_uri)
        _db = _client[db_name]
        
        # Verify connection
        await _db.command("ping")
        logger.info(f"✅ Connected to MongoDB: {db_name}")
        
        # Create indexes
        await _create_indexes()
    except Exception as exc:
        logger.error(f"❌ MongoDB connection failed: {exc}")
        raise


async def disconnect_db() -> None:
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")


async def _create_indexes() -> None:
    """Create database indexes for optimal query performance."""
    if not _db:
        return
    
    # Users collection indexes
    users = _db["users"]
    await users.create_index("email", unique=True)
    await users.create_index("username", unique=True)
    
    # Sessions collection indexes
    sessions = _db["sessions"]
    await sessions.create_index("user_id")
    await sessions.create_index("created_at")
    
    logger.info("Database indexes created")


def get_db():
    """Get the MongoDB database instance."""
    if not _db:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
