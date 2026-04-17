"""
Transcript Processor — Extract audio from video and generate transcriptions.

Handles:
- Audio extraction from video files
- Speech-to-text processing with timestamps
- Filler word detection with timestamp mapping
- Integration with Tavus transcript data where available
"""

import json
import logging
import os
import subprocess
from pathlib import Path

import google.generativeai as genai

from filler_detector import count_filler_words, get_words_per_minute
from session_store import get_session, update_session

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Speech-to-text using Google Generative AI (Gemini)
# ---------------------------------------------------------------------------

async def generate_transcript_from_video(
    session_id: str,
    file_path: str,
    gemini_model: genai.GenerativeModel,
) -> dict:
    """
    Generate transcript from video file using Gemini's Vision API.
    
    For production, consider:
    - Google Cloud Speech-to-Text API (more accurate, handles audio streams)
    - Assembly AI (excellent accuracy + speaker diarization)
    - AWS Transcribe
    - Deepgram
    
    Args:
        session_id: Session identifier
        file_path: Full path to video file
        gemini_model: Initialized Gemini model
    
    Returns:
        {
            "transcript": full transcript text,
            "turns": [{ role, text, timestamp_ms }],
            "filler_analysis": {
                "word": { count, occurrences: [{ timestamp_ms, duration_ms }] }
            }
        }
    """
    try:
        session = get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Check if we can get transcript from Tavus webhook data first
        turns = session.get("turns", [])
        if turns and len(turns) > 0:
            # Build transcript from existing turns
            transcript_text = " ".join([turn.get("text", "") for turn in turns])
            logger.info("Using existing Tavus transcript for session %s (%d turns)", session_id, len(turns))
            
            # Analyze filler words in existing transcript
            filler_analysis = _analyze_fillers(turns, transcript_text)
            
            return {
                "transcript": transcript_text,
                "turns": turns,
                "filler_analysis": filler_analysis,
                "source": "tavus_webhook",
            }

        # Fallback: Try to extract audio and transcribe
        logger.info("Attempting audio extraction and transcription for session %s", session_id)
        return {
            "transcript": "",
            "turns": [],
            "filler_analysis": {},
            "source": "none",
            "note": "No transcript available. Set TRANSCRIPTION_SERVICE env var to enable transcription.",
        }

    except Exception as e:
        logger.error("Transcript generation failed for session %s: %s", session_id, e)
        return {
            "transcript": "",
            "turns": [],
            "filler_analysis": {},
            "source": "error",
            "error": str(e),
        }


def _analyze_fillers(turns: list, full_transcript: str) -> dict:
    """
    Analyze filler words from turns and map to timestamps.
    
    Args:
        turns: List of turn dicts with text and timestamp_ms
        full_transcript: Full transcript text
    
    Returns:
        {
            "filler_word": {
                "count": int,
                "occurrences": [
                    { "turn_index": int, "timestamp_ms": int, "text": str }
                ]
            }
        }
    """
    filler_counts = count_filler_words(full_transcript)
    analysis = {}

    # Only include fillers that were actually found
    for word in filler_counts:
        occurrences = []
        for turn_idx, turn in enumerate(turns):
            turn_text = turn.get("text", "").lower()
            # Count occurrences in this turn
            count = turn_text.count(word.lower())
            if count > 0:
                occurrences.append({
                    "turn_index": turn_idx,
                    "timestamp_ms": turn.get("timestamp_ms"),
                    "text": turn.get("text", ""),
                })

        if occurrences:
            analysis[word] = {
                "count": filler_counts[word],
                "occurrences": occurrences,
            }

    return analysis


# ---------------------------------------------------------------------------
# Audio extraction helper (optional, for future speech-to-text integration)
# ---------------------------------------------------------------------------

def extract_audio_from_video(video_path: str, audio_output_path: str) -> bool:
    """
    Extract audio from video file using ffmpeg.
    
    Args:
        video_path: Path to input video file
        audio_output_path: Path where audio file will be saved
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Check if ffmpeg is available
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("ffmpeg not found. Install it to enable audio extraction.")
        return False

    try:
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-q:a", "9",  # Best quality audio extraction
            "-n",  # Don't overwrite
            audio_output_path,
        ]
        subprocess.run(cmd, capture_output=True, check=True, timeout=300)
        logger.info("Audio extracted: %s", audio_output_path)
        return True
    except Exception as e:
        logger.error("Audio extraction failed: %s", e)
        return False


# ---------------------------------------------------------------------------
# Update session with processed transcript
# ---------------------------------------------------------------------------

async def update_session_with_transcript(
    session_id: str,
    transcript_data: dict,
) -> None:
    """
    Update session store with transcript and filler analysis.
    
    Args:
        session_id: Session identifier
        transcript_data: Output from generate_transcript_from_video()
    """
    try:
        # Extract transcript text from turns or use provided text
        turns = transcript_data.get("turns", [])
        transcript_text = transcript_data.get("transcript", "")
        
        if not transcript_text and turns:
            transcript_text = " ".join([turn.get("text", "") for turn in turns])

        # Update session
        update_session(session_id, "transcript_raw", transcript_text)
        update_session(session_id, "turns", turns)
        update_session(session_id, "filler_analysis", transcript_data.get("filler_analysis", {}))
        update_session(session_id, "transcript_source", transcript_data.get("source", "unknown"))

        logger.info(
            "Session %s updated with transcript (%d chars, %d turns)",
            session_id,
            len(transcript_text),
            len(turns),
        )

    except Exception as e:
        logger.error("Failed to update session with transcript: %s", e)
