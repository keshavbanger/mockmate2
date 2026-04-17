"""
Report Generator — Gemini 1.5 Flash narrative + per-section scoring.
Assembles all session data (transcript, emotion, filler stats, Q&A scores)
into a professional structured JSON report.
"""

import json
import logging
import re

import google.generativeai as genai

from filler_detector import (
    count_filler_words,
    get_pause_count,
    get_words_per_minute,
    summarise_filler_stats,
    detect_fillers_with_timestamps,
    get_filler_timeline,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------
_REPORT_PROMPT = """
You are an expert professional interview coach. Analyse the following mock interview data and generate a comprehensive performance report.

Interview Details:
- Type: {interview_type}
- Difficulty: {difficulty}
- Duration: {duration_minutes:.1f} minutes
- Candidate: {candidate_name}

Per-Question Performance:
{qa_summary}

Communication Metrics:
- Words per minute: {wpm}
- Filler word rate: {filler_rate}% of total words
- Most used fillers: {top_fillers}
- Estimated pause count: {pause_count}

Emotion / Confidence Data (from facial analysis):
{emotion_summary}

Based on ALL of the above, generate the following and return ONLY a valid JSON object with these exact keys:

1. "executive_summary" (string): 3–4 sentences. Overall impression, stand-out positives, most important area to improve.
2. "strengths" (array of 3 strings): specific, evidence-based strengths observed. Each string is one bullet point.
3. "improvements" (array of 3 strings): specific, actionable areas for improvement. Not generic advice.
4. "recommendations" (array of 3 strings): concrete next steps the candidate should take to improve before their next interview.
5. "communication_score" (integer 1–10): based on clarity, pace, filler usage, sentence structure.
6. "confidence_score" (integer 1–10): based on emotion data, pause patterns, answer assertiveness.
7. "technical_score" (integer 1–10 or null): score only if interview type is Technical or Mixed, else null.
8. "overall_score" (integer 1–10): weighted average of all applicable scores.
9. "question_feedback" (array of 7 objects): for each question {{ "question": str, "answer_summary": str (1 sentence), "score": int 1-5, "ai_feedback": str (max 25 words) }}

Return ONLY the JSON. No markdown, no extra text.
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_report(
    session_id: str,
    session_data: dict,
    gemini_model: genai.GenerativeModel,
) -> dict:
    """
    Generate a full interview performance report.

    Args:
        session_id:    Session identifier (for logging).
        session_data:  Full session dict from session_store. Expected keys:
                       resume_data, interview_type, difficulty, language,
                       questions, turns (list of turn dicts),
                       emotion_snapshots (list), conversation_id,
                       start_time, end_time
        gemini_model:  Instantiated Gemini GenerativeModel.

    Returns:
        Complete report dict.

    Raises:
        RuntimeError: on Gemini API failure
        ValueError:   on malformed Gemini response
    """
    resume_data: dict = session_data.get("resume_data", {})
    interview_type: str = session_data.get("interview_type", "Mixed")
    difficulty: str = session_data.get("difficulty", "Mid")
    questions: list[str] = session_data.get("questions", [])
    turns: list[dict] = session_data.get("turns", [])
    emotion_snapshots: list[dict] = session_data.get("emotion_snapshots", [])
    start_time: float = session_data.get("start_time", 0.0)
    end_time: float = session_data.get("end_time", start_time)

    candidate_name: str = resume_data.get("name", "Candidate")
    duration_seconds: float = max(0.0, end_time - start_time)
    duration_minutes: float = duration_seconds / 60.0

    # ----------------------------------------------------------------
    # Aggregate transcript from all turns
    # ----------------------------------------------------------------
    full_transcript = _build_full_transcript(turns)

    # ----------------------------------------------------------------
    # Filler word analysis
    # ----------------------------------------------------------------
    filler_counts = count_filler_words(full_transcript)
    filler_stats = summarise_filler_stats(filler_counts, full_transcript)
    wpm = get_words_per_minute(full_transcript, duration_seconds)
    pause_count = get_pause_count(full_transcript)

    # ----------------------------------------------------------------
    # Q&A summary for prompt
    # ----------------------------------------------------------------
    qa_summary = _format_qa_summary(questions, turns)

    # ----------------------------------------------------------------
    # Emotion summary for prompt
    # ----------------------------------------------------------------
    emotion_summary_text = _format_emotion_summary(emotion_snapshots)

    # ----------------------------------------------------------------
    # Build and send Gemini prompt
    # ----------------------------------------------------------------
    prompt = _REPORT_PROMPT.format(
        interview_type=interview_type,
        difficulty=difficulty,
        duration_minutes=duration_minutes,
        candidate_name=candidate_name,
        qa_summary=qa_summary,
        wpm=wpm,
        filler_rate=filler_stats["filler_rate_percent"],
        top_fillers=", ".join(filler_stats["top_fillers"]) or "none",
        pause_count=pause_count,
        emotion_summary=emotion_summary_text,
    )

    logger.info("Generating report for session %s ...", session_id)

    try:
        response = await gemini_model.generate_content_async(prompt)
        raw = response.text.strip()
    except Exception as exc:
        logger.error("Gemini error during report generation: %s", exc)
        raise RuntimeError(f"Gemini report generation failed: {exc}") from exc

    # Strip markdown
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw).strip()

    try:
        gemini_report = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned invalid JSON for report:\n%s", raw[:600])
        raise ValueError(
            f"Gemini report JSON parse error: {exc}. First 600 chars: {raw[:600]}"
        ) from exc

    # ----------------------------------------------------------------
    # Assemble final report
    # ----------------------------------------------------------------
    report = _assemble_report(
        session_id=session_id,
        session_data=session_data,
        gemini_report=gemini_report,
        filler_stats=filler_stats,
        wpm=wpm,
        pause_count=pause_count,
        emotion_snapshots=emotion_snapshots,
        duration_seconds=duration_seconds,
    )

    logger.info(
        "Report generated for session %s. Overall score: %s",
        session_id,
        report.get("overall_score"),
    )
    return report


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_full_transcript(turns: list[dict]) -> str:
    """Concatenate all candidate answer turns into one string."""
    parts = []
    for turn in turns:
        if turn.get("role") == "candidate":
            text = turn.get("text", "").strip()
            if text:
                parts.append(text)
    return " ".join(parts)


def _format_qa_summary(questions: list[str], turns: list[dict]) -> str:
    """
    Create a textual Q&A summary for the Gemini prompt.
    
    Maps questions to answers by inferring the sequence:
    - Interviewer turns ask questions
    - Following candidate turns are answers
    """
    if not questions:
        return "No questions were asked in this interview."
    
    if not turns:
        return "No Q&A data available. No turns recorded."
    
    # Build answer map by matching interviewer/candidate turn pairs
    answer_map: dict[int, str] = {}
    current_q_idx = 0
    
    for turn in turns:
        role = turn.get("role", "").lower()
        text = turn.get("text", "").strip()
        
        # Track which question is being asked (by finding interviewer turns)
        if role == "interviewer" and current_q_idx < len(questions):
            # This is a question being asked
            current_q_idx += 1
        elif role == "candidate" and text and current_q_idx > 0:
            # This is an answer to the current question
            q_idx = current_q_idx - 1
            if q_idx not in answer_map:
                answer_map[q_idx] = text
            else:
                # Append if there are multiple answer segments
                answer_map[q_idx] += " " + text
    
    # Format output
    lines = []
    for i, question in enumerate(questions):
        answer = answer_map.get(i, "No answer recorded.")
        # Truncate long answers for the prompt
        answer_preview = answer[:400] if len(answer) > 400 else answer
        lines.append(
            f"Q{i+1}: {question}\n"
            f"   Answer: {answer_preview}\n"
        )
    
    return "\n".join(lines) if lines else "No Q&A data available."


def _format_emotion_summary(snapshots: list[dict]) -> str:
    """
    Aggregate and format emotion snapshot data for the prompt.
    Handles empty snapshots gracefully.
    """
    if not snapshots:
        return (
            "No facial emotion data available. "
            "Emotion analysis could not be performed due to missing emotion snapshots."
        )

    emotion_totals: dict[str, float] = {}
    confidence_vals: list[float] = []
    gaze_counts: dict[str, int] = {}

    for snap in snapshots:
        emotions: dict = snap.get("emotions", {})
        if emotions:
            for emotion, val in emotions.items():
                emotion_totals[emotion] = emotion_totals.get(emotion, 0.0) + float(val)
        conf = snap.get("confidence_score")
        if conf is not None:
            try:
                confidence_vals.append(float(conf))
            except (ValueError, TypeError):
                pass
        gaze = snap.get("gaze", "unknown")
        gaze_counts[gaze] = gaze_counts.get(gaze, 0) + 1

    n = len(snapshots) or 1
    avg_emotions = {k: round(v / n, 3) for k, v in emotion_totals.items()} if emotion_totals else {}
    avg_confidence = round(sum(confidence_vals) / len(confidence_vals), 3) if confidence_vals else None
    dominant_emotion = max(avg_emotions, key=avg_emotions.get) if avg_emotions else "unknown"  # type: ignore[arg-type]

    lines = [
        f"- Dominant emotion: {dominant_emotion}",
        f"- Average confidence: {avg_confidence if avg_confidence is not None else 'N/A'}",
        f"- Emotion breakdown: {json.dumps(avg_emotions)}",
        f"- Gaze distribution (snapshot counts): {json.dumps(gaze_counts)}",
    ]
    return "\n".join(lines)


def _assemble_report(
    session_id: str,
    session_data: dict,
    gemini_report: dict,
    filler_stats: dict,
    wpm: float,
    pause_count: int,
    emotion_snapshots: list[dict],
    duration_seconds: float,
) -> dict:
    """Merge Gemini output with raw metrics into the final report schema."""
    resume_data: dict = session_data.get("resume_data", {})
    turns: list[dict] = session_data.get("turns", [])

    # Generate filler timeline with timestamps
    filler_analysis = detect_fillers_with_timestamps(turns)
    filler_timeline = get_filler_timeline(filler_analysis)

    return {
        "session_id": session_id,
        "candidate_name": resume_data.get("name", "Candidate"),
        "interview_type": session_data.get("interview_type", "Mixed"),
        "difficulty": session_data.get("difficulty", "Mid"),
        "language": session_data.get("language", "English"),
        "duration_seconds": round(duration_seconds),
        # ---- Gemini-generated narrative ----
        "executive_summary": gemini_report.get("executive_summary", ""),
        "strengths": gemini_report.get("strengths", []),
        "improvements": gemini_report.get("improvements", []),
        "recommendations": gemini_report.get("recommendations", []),
        # ---- Scores (1–10) ----
        "scores": {
            "communication": gemini_report.get("communication_score"),
            "confidence": gemini_report.get("confidence_score"),
            "technical": gemini_report.get("technical_score"),
            "overall": gemini_report.get("overall_score"),
        },
        # ---- Per-question feedback ----
        "question_feedback": gemini_report.get("question_feedback", []),
        # ---- Communication metrics ----
        "communication_metrics": {
            "words_per_minute": wpm,
            "pause_count": pause_count,
            "filler_stats": filler_stats,
        },
        # ---- Filler word timeline (with timestamps for video visualization) ----
        "filler_timeline": filler_timeline,
        "filler_analysis": filler_analysis,
        # ---- Emotion data (raw for charts) ----
        "emotion_data": {
            "snapshot_count": len(emotion_snapshots),
            "snapshots": emotion_snapshots,  # frontend uses this for timeline chart
        },
    }
