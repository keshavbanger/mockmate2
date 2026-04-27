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
from session_store import get_session, update_session
from report_pipeline import ReportOrchestrator
from report_pipeline.models import (
    Utterance, SpeechMetrics, VisualMetrics, 
    ResumeData, InterviewConfig, QuestionBankItem
)
import os

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

    # ── Map Session Data to Pipeline Input Models ──────────────────────────────
    
    # 1. Transcript Data
    transcript_data = []
    for turn in turns:
        transcript_data.append(Utterance(
            speaker=turn.get("role", "candidate"),
            text=turn.get("text", ""),
            start_time=0.0, # Approximate if missing
            end_time=0.0,
            question_id=turn.get("question_id")
        ))

    # 2. Speech Metrics (Aggregated from turns if not pre-computed)
    # Note: In a full implementation, you'd calculate these per question.
    speech_metrics = [SpeechMetrics(
        total_words=len(t.get("text", "").split()),
        words_per_minute=120.0, # Default if not tracked
        filler_words_count=t.get("filler_count", 0),
        filler_words_breakdown={},
        silence_durations=[],
        avg_pause_duration=0.0,
        longest_pause=0.0,
        answer_duration=30.0
    ) for t in turns if t.get("role") == "candidate"]

    # 3. Visual Metrics
    visual_metrics = [VisualMetrics(
        dominant_emotion=s.get("emotion", "Neutral"),
        emotion_distribution={},
        eye_contact_score=s.get("confidence_score", 0.5),
        head_stability_score=0.8,
        smile_frequency=0.1,
        engagement_score=0.7
    ) for s in emotion_snapshots] or [VisualMetrics(
        dominant_emotion="Neutral",
        emotion_distribution={},
        eye_contact_score=0.5,
        head_stability_score=0.8,
        smile_frequency=0.0,
        engagement_score=0.5
    )]

    # 4. Resume Data
    resume_raw = session.get("resume_data", {})
    resume_data = ResumeData(
        candidate_name=resume_raw.get("name", "Candidate"),
        target_role=resume_raw.get("target_role", "Professional"),
        years_experience=float(resume_raw.get("total_experience_years", 0)),
        skills=resume_raw.get("skills", []),
        projects=[],
        tools=[],
        education=[],
        summary=resume_raw.get("summary", "")
    )

    # 5. Config & Questions
    config_raw = session.get("interview_config", {})
    interview_config = InterviewConfig(
        interview_type=config_raw.get("type", "General"),
        difficulty=config_raw.get("difficulty", "Medium"),
        selected_language=config_raw.get("language", "English"),
        seniority_level=config_raw.get("difficulty", "Mid")
    )

    question_bank = [QuestionBankItem(
        question_id=i + 1,
        question_text=q,
        category="General",
        expected_topics=[],
        expected_domain_terms=[],
        evaluation_focus="Communication"
    ) for i, q in enumerate(questions)]

    # ── Execute Pipeline ───────────────────────────────────────────────────────
    try:
        orchestrator = ReportOrchestrator(api_key=os.getenv("GEMINI_API_KEY"))
        report_obj = await orchestrator.generate_interview_report(
            transcript_data=transcript_data,
            speech_metrics=speech_metrics,
            visual_metrics=visual_metrics,
            resume_data=resume_data,
            interview_config=interview_config,
            question_bank=question_bank
        )
        report = report_obj.dict()
    except Exception as exc:
        logger.error("Report pipeline failed: %s", exc, exc_info=True)
        raise HTTPException(502, f"Report generation failed: {exc}")

    # Cache report in session
    update_session(body.session_id, "report", report)
    update_session(body.session_id, "report_ready", True)

    logger.info(
        "Report generated for session %s using new pipeline. Overall score: %s",
        body.session_id,
        report.get("overall_score"),
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
