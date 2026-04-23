"""
Report routes:

  POST /api/generate-report
    - Runs full Gemini analysis on session data
    - Returns complete report JSON

  GET /api/report/{session_id}
    - Returns the cached report JSON for a completed session
"""

import logging

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from dependencies import get_gemini_model
from report_generator_enhanced import generate_enhanced_report
from session_store import get_session, update_session

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateReportRequest(BaseModel):
    session_id: str


# ---------------------------------------------------------------------------
# POST /api/generate-report
# ---------------------------------------------------------------------------

@router.post("/generate-report")
async def generate_report_endpoint(
    body: GenerateReportRequest,
    gemini_model: genai.GenerativeModel = Depends(get_gemini_model),
):
    """
    Generate a full performance report for a completed interview session.
    Saves the report to the session and returns the full JSON.
    
    Validates that session has required data (questions, turns, emotion_snapshots).
    """
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(404, f"Session '{body.session_id}' not found or expired.")

    if session.get("status") != "completed":
        raise HTTPException(
            400,
            "Interview must be completed before generating a report. "
            f"Current status: {session.get('status')}",
        )

    # Return cached report if already generated
    if session.get("report"):
        logger.info("Returning cached report for session %s.", body.session_id)
        return session["report"]

    # ── Validate that session has required data ────────────────────────────────
    questions = session.get("questions", [])
    turns = session.get("turns", [])
    emotion_snapshots = session.get("emotion_snapshots", [])
    
    # Log data status
    logger.info(
        "Report generation for session %s: "
        "questions=%d, turns=%d, emotion_snapshots=%d",
        body.session_id,
        len(questions),
        len(turns),
        len(emotion_snapshots),
    )
    
    # Warn if data seems incomplete (but still allow generation with available data)
    if not questions:
        logger.warning("Session %s has no questions - using empty list", body.session_id)
    if not turns:
        logger.warning("Session %s has no transcript turns - using empty list", body.session_id)
    if not emotion_snapshots:
        logger.warning("Session %s has no emotion snapshots - facial analysis will be empty", body.session_id)

    # Generate
    try:
        report = await generate_enhanced_report(
            session_id=body.session_id,
            session_data=session,
            gemini_model=gemini_model,
        )
    except RuntimeError as exc:
        raise HTTPException(502, f"Report generation failed: {exc}")
    except ValueError as exc:
        raise HTTPException(422, f"Report data error: {exc}")

    # Cache report in session
    update_session(body.session_id, "report", report)
    update_session(body.session_id, "report_ready", True)

    logger.info(
        "Report generated for session %s. Overall score: %s",
        body.session_id,
        report.get("scores", {}).get("overall"),
    )

    return report


# ---------------------------------------------------------------------------
# GET /api/report/{session_id}
# ---------------------------------------------------------------------------

@router.get("/report/{session_id}")
async def get_report(session_id: str):
    """
    Return the generated report for a session.
    Returns 404 if not found, 425 if not yet generated.
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, f"Session '{session_id}' not found or expired.")

    report = session.get("report")
    if not report:
        raise HTTPException(
            425,
            detail="Report not yet generated. Call POST /api/generate-report first.",
        )

    return report
