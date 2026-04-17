"""
POST /api/generate-questions
  - Accept interview configuration JSON
  - Generate 7 questions via Gemini 1.5 Flash
  - Return questions array + persist to session
"""

import logging

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from dependencies import get_gemini_model
from question_generator import generate_questions
from session_store import get_session, update_session

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_TYPES = {"Technical", "Behavioral", "HR", "Mixed"}
VALID_DIFFICULTIES = {"Junior", "Mid", "Senior"}
VALID_LANGUAGES = {"English", "Hindi", "Hinglish"}


class GenerateQuestionsRequest(BaseModel):
    session_id: str = Field(..., description="Active session ID")
    interview_type: str = Field("Technical", description="Technical | Behavioral | HR | Mixed")
    difficulty: str = Field("Mid", description="Junior | Mid | Senior")
    language: str = Field("English", description="English | Hindi | Hinglish")

    model_config = {"str_strip_whitespace": True}


@router.post("/generate-questions")
async def generate_questions_endpoint(
    body: GenerateQuestionsRequest,
    gemini_model: genai.GenerativeModel = Depends(get_gemini_model),
):
    """
    Generate exactly 7 interview questions tailored to the candidate's resume and config.
    Persists questions to session.
    """
    # Validate enums
    if body.interview_type not in VALID_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"interview_type must be one of: {sorted(VALID_TYPES)}",
        )
    if body.difficulty not in VALID_DIFFICULTIES:
        raise HTTPException(
            status_code=422,
            detail=f"difficulty must be one of: {sorted(VALID_DIFFICULTIES)}",
        )
    if body.language not in VALID_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"language must be one of: {sorted(VALID_LANGUAGES)}",
        )

    # Fetch session + resume data
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{body.session_id}' not found or expired.",
        )

    resume_data: dict = session.get("resume_data", {})
    if not resume_data:
        raise HTTPException(
            status_code=400,
            detail="No resume data found in session. Upload a resume first.",
        )

    # Generate
    try:
        questions = await generate_questions(
            resume_data=resume_data,
            interview_type=body.interview_type,
            difficulty=body.difficulty,
            language=body.language,
            gemini_model=gemini_model,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Persist config + questions
    update_session(body.session_id, "interview_type", body.interview_type)
    update_session(body.session_id, "difficulty", body.difficulty)
    update_session(body.session_id, "language", body.language)
    update_session(body.session_id, "questions", questions)

    logger.info(
        "Questions generated for session %s (%s / %s / %s).",
        body.session_id,
        body.interview_type,
        body.difficulty,
        body.language,
    )

    return {
        "session_id": body.session_id,
        "interview_type": body.interview_type,
        "difficulty": body.difficulty,
        "language": body.language,
        "questions": questions,
        "count": len(questions),
    }
