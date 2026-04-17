"""
In-memory session store with automatic TTL-based expiry.
All data is lost on backend restart — MVP design by intention.
"""

import asyncio
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------
# sessions[session_id] = {"data": {...}, "created_at": float, "updated_at": float}
_sessions: dict[str, dict] = {}

SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "7200"))  # 2 hours
CLEANUP_INTERVAL_SECONDS = 300  # run cleanup every 5 minutes


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_session(session_id: str, data: dict) -> None:
    """Create or fully overwrite a session."""
    now = time.time()
    _sessions[session_id] = {
        "data": data,
        "created_at": now,
        "updated_at": now,
    }
    logger.debug("Session saved: %s", session_id)


def get_session(session_id: str) -> dict | None:
    """
    Return session data dict, or None if not found / expired.
    Accessing a session resets its updated_at timestamp.
    """
    record = _sessions.get(session_id)
    if record is None:
        return None
    # Check TTL against created_at (hard expiry)
    if time.time() - record["created_at"] > SESSION_TTL_SECONDS:
        del _sessions[session_id]
        logger.info("Session %s expired and removed on access.", session_id)
        return None
    record["updated_at"] = time.time()
    return record["data"]


def update_session(session_id: str, key: str, value: Any) -> bool:
    """
    Update a single top-level key in an existing session.
    Returns True on success, False if session not found.
    """
    record = _sessions.get(session_id)
    if record is None:
        logger.warning("update_session: session %s not found.", session_id)
        return False
    record["data"][key] = value
    record["updated_at"] = time.time()
    logger.debug("Session %s updated key '%s'.", session_id, key)
    return True


def delete_session(session_id: str) -> bool:
    """Explicitly remove a session."""
    if session_id in _sessions:
        del _sessions[session_id]
        logger.info("Session %s deleted.", session_id)
        return True
    return False


def list_sessions() -> list[str]:
    """Return all active session IDs (for debugging)."""
    return list(_sessions.keys())


# ---------------------------------------------------------------------------
# Background cleanup loop
# ---------------------------------------------------------------------------

async def cleanup_loop() -> None:
    """
    Periodically removes sessions that have exceeded SESSION_TTL_SECONDS.
    Intended to be run as an asyncio background task.
    """
    logger.info(
        "Session cleanup loop started (TTL=%ss, interval=%ss).",
        SESSION_TTL_SECONDS,
        CLEANUP_INTERVAL_SECONDS,
    )
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        _cleanup_expired()


def _cleanup_expired() -> None:
    now = time.time()
    expired = [
        sid
        for sid, record in _sessions.items()
        if now - record["created_at"] > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        del _sessions[sid]
        logger.info("Session %s removed by cleanup (TTL exceeded).", sid)
    if expired:
        logger.info("Cleanup removed %d expired session(s).", len(expired))
