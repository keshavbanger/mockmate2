"""
POST /api/tavus-webhook
  Receives event callbacks from Tavus CVI during an active conversation.
  Handles: conversation.started, conversation.ended, transcript events.
"""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from session_store import get_session, update_session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/tavus-webhook")
async def tavus_webhook(request: Request):
    """
    Receive Tavus event callbacks.

    Tavus POSTs JSON payloads here throughout the conversation lifecycle.
    We handle:
      - conversation.started  → log + update status
      - participant.transcript → append transcript turn to session
      - conversation.ended    → mark session complete if not already done
      - All others            → log and acknowledge (200 OK)
    """
    try:
        payload: dict = await request.json()
    except Exception as exc:
        logger.warning("Tavus webhook: could not parse JSON body: %s", exc)
        return JSONResponse(status_code=400, content={"error": "Invalid JSON payload"})

    event_type: str = payload.get("event_type", payload.get("type", "unknown"))
    conversation_id: str = payload.get("conversation_id", "")
    logger.info("Tavus webhook event: %s | conversation: %s", event_type, conversation_id)

    # Find matching session by conversation_id
    session_id, session = _find_session_by_conversation(conversation_id)

    # ----------------------------------------------------------------
    # Event handlers
    # ----------------------------------------------------------------

    if event_type == "conversation.started":
        if session_id:
            update_session(session_id, "status", "active")
            logger.info("Tavus conversation started — session %s marked active.", session_id)

    elif event_type in ("participant.transcript", "transcript"):
        # Tavus sends incremental transcript chunks
        # Expected payload shape (varies by Tavus version):
        #   { "properties": { "transcript": str, "is_final": bool, "role": str } }
        props: dict = payload.get("properties", payload)
        transcript_text: str = props.get("transcript", props.get("text", ""))
        role: str = props.get("role", "unknown").lower()
        is_final: bool = props.get("is_final", True)

        if is_final and transcript_text and session_id:
            turns: list = session.get("turns", [])  # type: ignore[union-attr]
            turns.append(
                {
                    "role": role,
                    "text": transcript_text.strip(),
                    "timestamp_ms": payload.get("timestamp_ms"),
                    "question_index": None,
                }
            )
            update_session(session_id, "turns", turns)
            logger.debug(
                "Transcript appended for session %s (role=%s, len=%d chars).",
                session_id,
                role,
                len(transcript_text),
            )

    elif event_type == "conversation.ended":
        if session_id:
            import time

            current_status = session.get("status", "")  # type: ignore[union-attr]
            if current_status != "completed":
                update_session(session_id, "status", "completed")
                update_session(session_id, "end_time", time.time())
                logger.info(
                    "Tavus conversation.ended webhook — session %s marked completed.", session_id
                )

    else:
        logger.debug("Unhandled Tavus event type '%s' — acknowledged.", event_type)

    # Always return 200 to Tavus to prevent retries
    return {"ok": True, "event_received": event_type}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_session_by_conversation(conversation_id: str) -> tuple[str | None, dict | None]:
    """
    Find a session by its stored Tavus conversation_id.
    Linear scan — acceptable for MVP (sessions dict is small).
    """
    if not conversation_id:
        return None, None

    from session_store import _sessions  # noqa: PLC0415

    for session_id, record in _sessions.items():
        data: dict = record.get("data", {})
        if data.get("tavus_conversation_id") == conversation_id:
            return session_id, data

    logger.warning("No session found for conversation_id '%s'.", conversation_id)
    return None, None
