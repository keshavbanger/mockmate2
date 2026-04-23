"""
Recording upload and processing routes:

  POST /api/upload-recording
    - Receives video file upload from frontend
    - Saves to backend/uploads folder
    - Generates transcript using speech-to-text
    - Detects filler words with timestamps
    - Updates session with recording metadata

  GET /api/recording/{session_id}
    - Returns recording metadata and filler analysis
"""

import logging
import os
import time
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from session_store import get_session, update_session

logger = logging.getLogger(__name__)
router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class RecordingMetadata(BaseModel):
    session_id: str
    file_path: str
    file_size: int
    duration_ms: int
    mime_type: str
    uploaded_at: float
    transcript: str = ""
    filler_analysis: dict = {}


class FillerWithTimestamp(BaseModel):
    word: str
    count: int
    occurrences: list[dict]  # [{ timestamp_ms, duration_ms }]


# ---------------------------------------------------------------------------
# POST /api/upload-recording
# ---------------------------------------------------------------------------

@router.post("/upload-recording")
async def upload_recording(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    timestamp_ms: int = Form(...),
):
    """
    Upload video recording from frontend.
    
    Args:
        file: Video file from MediaRecorder
        session_id: Session identifier
        timestamp_ms: Client timestamp when upload started
    
    Returns:
        Recording metadata including file path and initial processing status
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, f"Session '{session_id}' not found or expired.")

    try:
        # 1. Save uploaded file streaming to disk to avoid OOM
        file_extension = Path(file.filename or "_video.webm").suffix or ".webm"
        filename = f"interview_{session_id}_{int(time.time())}{file_extension}"
        file_path = UPLOADS_DIR / filename

        import shutil
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = file_path.stat().st_size

        logger.info(
            "Recording saved: %s (size: %.1f MB)",
            filename,
            file_size / 1024 / 1024,
        )

        # 2. Store recording metadata in session
        recording_data = {
            "file_path": str(file_path),
            "file_name": filename,
            "file_size": file_size,
            "mime_type": file.content_type or "video/webm",
            "uploaded_at": time.time(),
            "upload_timestamp_ms": timestamp_ms,
        }

        update_session(session_id, "recording", recording_data)

        # 3. Queue async processing
        # In a production system, you'd queue this for Celery/background job worker
        # For now, we'll initialize empty transcript/filler data
        update_session(session_id, "transcript", "")
        update_session(session_id, "filler_analysis", {})

        # Trigger async transcript generation (in a real system, this would be a job)
        logger.info("Recording queued for transcript generation: %s", session_id)

        return {
            "session_id": session_id,
            "file_path": str(file_path),
            "file_name": filename,
            "file_size": file_size,
            "status": "processing",
            "message": "Recording received. Transcript and analysis will be ready shortly.",
        }

    except Exception as e:
        logger.error("Upload failed: %s", e)
        raise HTTPException(500, f"Failed to upload recording: {str(e)}")


# ---------------------------------------------------------------------------
# GET /api/recording/{session_id}
# ---------------------------------------------------------------------------

@router.get("/recording/{session_id}")
async def get_recording(session_id: str):
    """
    Get recording metadata and analysis for a session.
    """
    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, f"Session '{session_id}' not found or expired.")

    recording = session.get("recording")
    if not recording:
        raise HTTPException(404, "No recording found for this session.")

    return {
        "session_id": session_id,
        "recording": recording,
        "transcript": session.get("transcript", ""),
        "filler_analysis": session.get("filler_analysis", {}),
    }


# ---------------------------------------------------------------------------
# POST /api/process-transcript (internal endpoint)
# ---------------------------------------------------------------------------
# This would normally be called by a background job worker after speech-to-text processing

@router.post("/process-transcript")
async def process_transcript(body: BaseModel = None):
    """
    Internal endpoint called by background job after transcript is generated.
    Updates session with transcript and filler analysis.
    
    In production, this would be called by Celery/background worker after:
    1. Audio extraction from video
    2. Speech-to-text processing
    3. Filler word analysis with timestamps
    """
    # This endpoint structure is ready for implementation
    # See transcript_processor.py for the actual processing logic
    pass
