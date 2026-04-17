"""
POST /api/parse-resume
  - Accept multipart/form-data PDF upload
  - Extract text with PyMuPDF
  - Parse structure with Gemini 1.5 Flash
  - Return structured resume JSON
"""

import logging
import os

import google.generativeai as genai
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from dependencies import get_gemini_model
from resume_parser import parse_resume_with_gemini

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_SIZE_MB = int(os.getenv("MAX_RESUME_SIZE_MB", "5"))
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024


@router.post("/parse-resume")
async def parse_resume(
    file: UploadFile = File(..., description="PDF resume file"),
    session_id: str = Form(..., description="Active session ID"),
    gemini_model: genai.GenerativeModel = Depends(get_gemini_model),
):
    """
    Upload a PDF resume and return structured JSON extracted by Gemini.
    """
    # Validate content type
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Please upload a PDF.",
        )

    # Read file bytes
    try:
        pdf_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded file: %s", exc)
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {exc}")

    # Validate size
    if len(pdf_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {len(pdf_bytes) / 1024:.1f} KB. Maximum is {MAX_SIZE_MB} MB.",
        )

    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Parse
    try:
        resume_data = await parse_resume_with_gemini(pdf_bytes, gemini_model)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Persist to session
    from session_store import get_session, update_session
    if session_id and get_session(session_id):
        update_session(session_id, "resume_data", resume_data)
        update_session(session_id, "resume_filename", file.filename)

    logger.info("Resume parsed for session %s: %s", session_id, resume_data.get("name"))
    return {
        "session_id": session_id,
        "filename": file.filename,
        "resume_data": resume_data,
    }
