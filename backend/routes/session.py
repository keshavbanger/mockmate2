"""
GET /api/session/{session_id}
  - Return full session JSON for the frontend
  - Also accepts POST for session creation
"""

import logging
import uuid
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from session_store import get_session, save_session

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# POST /api/session/create  —  create a new session
# ---------------------------------------------------------------------------

@router.post("/session/create")
async def create_session():
    """
    Create a new blank session. Returns the session_id for all subsequent calls.
    """
    session_id = str(uuid.uuid4())
    now = time.time()

    initial_data = {
        "status": "created",
        "created_at": now,
        "resume_data": None,
        "resume_filename": None,
        "interview_type": None,
        "difficulty": None,
        "language": None,
        "questions": [],
        "tavus_persona_id": None,
        "tavus_conversation_id": None,
        "conversation_url": None,
        "turns": [],
        "emotion_snapshots": [],
        "start_time": None,
        "end_time": None,
        "report": None,
    }

    save_session(session_id, initial_data)
    logger.info("Session created: %s", session_id)

    return {
        "session_id": session_id,
        "created_at": now,
        "status": "created",
    }


# ---------------------------------------------------------------------------
# GET /api/session/{session_id}
# ---------------------------------------------------------------------------

@router.get("/session/{session_id}")
async def get_session_endpoint(session_id: str):
    """
    Return the full session state for a given session_id.
    The frontend polls this to track progress/readiness.
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found or has expired.",
        )
    return {"session_id": session_id, **session}


# ---------------------------------------------------------------------------
# GET /api/session/{session_id}/diagnostics
# ---------------------------------------------------------------------------

@router.get("/session/{session_id}/diagnostics")
async def get_session_diagnostics(session_id: str):
    """
    Return detailed diagnostics about session data for debugging.
    Shows what data is actually stored vs. what's expected.
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found or has expired.",
        )
    
    questions = session.get("questions", [])
    turns = session.get("turns", [])
    emotion_snapshots = session.get("emotion_snapshots", [])
    resume_data = session.get("resume_data", {})
    
    # Categorize turns by role
    interviewer_turns = [t for t in turns if t.get("role") == "interviewer"]
    candidate_turns = [t for t in turns if t.get("role") == "candidate"]
    
    # Calculate interview statistics
    start_time = session.get("start_time")
    end_time = session.get("end_time")
    duration_sec = 0
    if start_time and end_time:
        duration_sec = int(end_time - start_time)
    
    # Build candidate answer snippets
    candidate_answers = []
    for turn in candidate_turns:
        text = turn.get("text", "")[:100]  # First 100 chars
        candidate_answers.append(text)
    
    return {
        "session_id": session_id,
        "status": session.get("status"),
        "data_status": {
            "resume_uploaded": bool(resume_data),
            "candidate_name": resume_data.get("name", "NOT SET"),
            "questions_count": len(questions),
            "questions_sample": questions[:3] if questions else [],
            "turns_count": len(turns),
            "interviewer_turns": len(interviewer_turns),
            "candidate_turns": len(candidate_turns),
            "emotion_snapshots_count": len(emotion_snapshots),
            "interview_duration_seconds": duration_sec,
        },
        "interview_config": {
            "type": session.get("interview_type"),
            "difficulty": session.get("difficulty"),
            "language": session.get("language"),
        },
        "tavus_status": {
            "persona_id": session.get("tavus_persona_id"),
            "conversation_id": session.get("tavus_conversation_id"),
            "conversation_url": bool(session.get("conversation_url")),
        },
        "transcript_sample": " ".join(candidate_answers[:3]),
        "has_report": bool(session.get("report")),
        "data_quality": {
            "issues": _diagnose_issues(session, questions, turns, emotion_snapshots),
            "ready_for_report": len(questions) > 0 and len(turns) > 0,
        },
    }


def _diagnose_issues(session: dict, questions: list, turns: list, emotions: list) -> list[str]:
    """Identify potential issues with session data."""
    issues = []
    
    if not session.get("resume_data"):
        issues.append("❌ Resume not uploaded")
    
    if not questions:
        issues.append("❌ No questions generated")
    
    if not turns:
        issues.append("❌ No transcript turns recorded (Tavus webhook may not have fired)")
    
    candidate_turns = [t for t in turns if t.get("role") == "candidate"]
    if not candidate_turns:
        issues.append("⚠️ No candidate answers recorded")
    
    if not emotions:
        issues.append("⚠️ No emotion snapshots collected")
    
    if session.get("status") == "active":
        issues.append("⏳ Interview still in progress")
    
    if not issues:
        issues.append("✅ Session data looks complete")
    
    return issues
