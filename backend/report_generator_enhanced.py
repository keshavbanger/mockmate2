"""
Enhanced Report Generator — Detailed analysis with vocabulary, grammar, and comprehensive scoring.
"""

import json
import logging
import re
from collections import Counter

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
# Enhanced Report Prompt
# ---------------------------------------------------------------------------
_ENHANCED_REPORT_PROMPT = """
You are an expert professional interview coach, linguistic analyst, and CEFR-certified English assessor. Analyze the following mock interview data and generate a comprehensive, visually-rich performance report.

Interview Details:
- Type: {interview_type}
- Difficulty: {difficulty}
- Duration: {duration_minutes:.1f} minutes
- Candidate Name: {candidate_name}

Per-Question Performance:
{qa_summary}

Communication Metrics:
- Words per minute: {wpm}
- Unique words used: {unique_words}
- Total words spoken: {total_words}
- Pause frequency: {pause_count}
- Filler word rate: {filler_rate}%
- Top fillers: {top_fillers}

Vocabulary Analysis:
Domain-specific terms detected: {domain_terms}

Emotion Profile (from facial analysis):
{emotion_summary}

Generate a comprehensive JSON report with these exact keys:

1. "executive_summary": 3-4 sentences summarizing performance.
2. "overall_score": 1-100 score.
3. "scores": {{ "communication": 1-10, "confidence": 1-10, "technical": 1-10, "role_fit": 1-10, "grammar": 1-10, "vocabulary": 1-10, "eye_contact": 1-10 }}

4. "english_coaching":
    {{
      "cefr_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "top_strengths": [string],
      "top_weaknesses": [string],
      "weekly_focus": string,
      "recommended_exercises": [string]
    }}

5. "grammar_analysis":
    {{
      "grammar_score": 1-100,
      "total_errors": int,
      "tense_consistency": 1-100,
      "sentence_complexity": 1-100,
      "detailed_errors": [
        {{ "original": str, "corrected": str, "rule": str, "time_marker": str }}
      ]
    }}

6. "phrase_improvements": [
    {{ "original": str, "suggested": str, "why": str }}
  ]

7. "question_feedback": [
    {{
      "question": str,
      "answer_score": int 1-100,
      "status": "best" | "weakest" | "normal",
      "assessment": str (concise summary),
      "star_feedback": str (evaluate based on Situation, Task, Action, Result),
      "strong_points": [str],
      "missed_points": [str]
    }}
  ]

8. "vocabulary_analysis": 
    {{
      "richness_score": 1-100,
      "domain_terms_used": [str],
      "missing_domain_terms": [str]
    }}

9. "facial_analysis":
    {{
      "dominant_emotion": str,
      "eye_contact_percent": int,
      "posture_assessment": str
    }}

Return ONLY valid JSON.
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_enhanced_report(
    session_id: str,
    session_data: dict,
    gemini_model: genai.GenerativeModel,
) -> dict:
    """
    Generate a comprehensive interview performance report with detailed analysis.
    
    Returns complete report dictionary with sections for:
    - Overall scoring and assessment
    - Per-question analysis
    - Vocabulary and grammar analysis
    - Communication patterns
    - Recommendations
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

    # ---- Build transcript ----
    full_transcript = _build_full_transcript(turns)

    # ---- Analyze vocabulary ----
    unique_words = len(set(full_transcript.lower().split()))
    total_words = len(full_transcript.split())
    domain_terms_found = _extract_domain_terms(full_transcript, interview_type)

    # ---- Filler analysis ----
    filler_counts = count_filler_words(full_transcript)
    filler_stats = summarise_filler_stats(filler_counts, full_transcript)
    wpm = get_words_per_minute(full_transcript, duration_seconds)
    pause_count = get_pause_count(full_transcript)

    # ---- Q&A summary ----
    qa_summary = _format_qa_summary(questions, turns)

    # ---- Emotion summary ----
    emotion_summary_text = _format_emotion_summary(emotion_snapshots)

    # ---- Build prompt ----
    prompt = _ENHANCED_REPORT_PROMPT.format(
        interview_type=interview_type,
        difficulty=difficulty,
        duration_minutes=duration_minutes,
        candidate_name=candidate_name,
        qa_summary=qa_summary,
        wpm=wpm,
        unique_words=unique_words,
        total_words=total_words,
        pause_count=pause_count,
        filler_rate=filler_stats["filler_rate_percent"],
        top_fillers=", ".join(filler_stats["top_fillers"]) or "none",
        domain_terms=", ".join(domain_terms_found) if domain_terms_found else "None detected",
        emotion_summary=emotion_summary_text,
    )

    logger.info("Generating enhanced report for session %s ...", session_id)

    try:
        response = await gemini_model.generate_content_async(prompt)
        raw = response.text.strip()
    except Exception as exc:
        logger.error("Gemini error during report generation: %s", exc)
        raise RuntimeError(f"Gemini report generation failed: {exc}") from exc

    # ---- Parse JSON ----
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw).strip()

    try:
        gemini_report = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned invalid JSON for report:\n%s", raw[:600])
        raise ValueError(f"Gemini JSON parse error: {exc}. Response: {raw[:600]}") from exc

    # ---- Assemble final report ----
    report = _assemble_enhanced_report(
        session_id=session_id,
        session_data=session_data,
        gemini_report=gemini_report,
        filler_stats=filler_stats,
        wpm=wpm,
        pause_count=pause_count,
        emotion_snapshots=emotion_snapshots,
        duration_seconds=duration_seconds,
        full_transcript=full_transcript,
    )

    logger.info(
        "Enhanced report generated for session %s. Overall score: %s",
        session_id,
        report.get("overall_score"),
    )
    return report


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _build_full_transcript(turns: list[dict]) -> str:
    """Concatenate all candidate answer turns."""
    parts = []
    for turn in turns:
        if turn.get("role") == "candidate":
            text = turn.get("text", "").strip()
            if text:
                parts.append(text)
    return " ".join(parts)


def _extract_domain_terms(transcript: str, interview_type: str) -> list[str]:
    """
    Extract domain-specific terminology from transcript.
    """
    # Common domain terms by interview type
    domain_keywords = {
        "Technical": [
            "algorithm", "database", "api", "rest", "async", "cache",
            "optimization", "scalability", "architecture", "microservice",
            "deployment", "testing", "git", "docker", "kubernetes", "sql",
            "framework", "library", "dependency", "inheritance", "encapsulation"
        ],
        "Behavioral": [
            "stakeholder", "deadline", "conflict", "feedback", "collaboration",
            "leadership", "ownership", "initiative", "communication", "teamwork"
        ],
        "HR": [
            "culture", "values", "growth", "learning", "development", "opportunity",
            "team", "collaboration", "career path", "motivation"
        ],
    }

    keywords = domain_keywords.get(interview_type, domain_keywords.get("Technical", []))
    
    found_terms = []
    transcript_lower = transcript.lower()
    for term in keywords:
        if term in transcript_lower:
            found_terms.append(term)
    
    return found_terms


def _format_qa_summary(questions: list[str], turns: list[dict]) -> str:
    """Format Q&A pairs for the Gemini prompt."""
    if not questions:
        return "No questions were asked."
    
    if not turns:
        return "No Q&A data available."
    
    answer_map: dict[int, str] = {}
    current_q_idx = 0
    
    for turn in turns:
        role = turn.get("role", "").lower()
        text = turn.get("text", "").strip()
        
        if role == "interviewer" and current_q_idx < len(questions):
            current_q_idx += 1
        elif role == "candidate" and text and current_q_idx > 0:
            q_idx = current_q_idx - 1
            if q_idx not in answer_map:
                answer_map[q_idx] = text
            else:
                answer_map[q_idx] += " " + text
    
    lines = []
    for i, question in enumerate(questions):
        answer = answer_map.get(i, "No answer recorded.")
        answer_preview = answer[:500] if len(answer) > 500 else answer
        lines.append(f"Q{i+1}: {question}\nA{i+1}: {answer_preview}\n")
    
    return "\n".join(lines) if lines else "No Q&A data."


def _format_emotion_summary(snapshots: list[dict]) -> str:
    """Format emotion data for the prompt."""
    if not snapshots:
        return "No facial emotion data available."
    
    emotion_totals: dict[str, float] = {}
    confidence_vals: list[float] = []
    
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
    
    n = len(snapshots) or 1
    avg_emotions = {k: round(v / n, 3) for k, v in emotion_totals.items()}
    avg_confidence = round(sum(confidence_vals) / len(confidence_vals), 3) if confidence_vals else None
    dominant = max(avg_emotions, key=avg_emotions.get) if avg_emotions else "neutral"
    
    return f"Dominant emotion: {dominant}, Avg confidence: {avg_confidence}, Emotions: {json.dumps(avg_emotions)}"


def _assemble_enhanced_report(
    session_id: str,
    session_data: dict,
    gemini_report: dict,
    filler_stats: dict,
    wpm: float,
    pause_count: int,
    emotion_snapshots: list[dict],
    duration_seconds: float,
    full_transcript: str,
) -> dict:
    """Assemble the final enhanced report."""
    resume_data: dict = session_data.get("resume_data", {})
    turns: list[dict] = session_data.get("turns", [])

    filler_analysis = detect_fillers_with_timestamps(turns)
    filler_timeline = get_filler_timeline(filler_analysis)

    return {
        "session_id": session_id,
        "candidate_name": resume_data.get("name", "Candidate"),
        "interview_type": session_data.get("interview_type", "Mixed"),
        "difficulty": session_data.get("difficulty", "Mid"),
        "language": session_data.get("language", "English"),
        "interview_date": session_data.get("created_at", None),
        "duration_seconds": round(duration_seconds),
        
        # ---- Overall assessment ----
        "executive_summary": gemini_report.get("executive_summary", ""),
        "overall_score": gemini_report.get("overall_score", 0),
        
        # ---- New Metrics (matching screenshots) ----
        "scores": gemini_report.get("scores", {}),
        "english_coaching": gemini_report.get("english_coaching", {}),
        "phrase_improvements": gemini_report.get("phrase_improvements", []),
        "facial_analysis": gemini_report.get("facial_analysis", {}),

        # ---- Legacy compatibility / Extra details ----
        "question_feedback": gemini_report.get("question_feedback", []),
        "vocabulary_analysis": gemini_report.get("vocabulary_analysis", {}),
        "grammar_analysis": gemini_report.get("grammar_analysis", {}),
        
        # ---- Communication metrics ----
        "communication_metrics": {
            "words_per_minute": wpm,
            "pause_count": pause_count,
            "filler_stats": filler_stats,
            "total_words": len(full_transcript.split()),
            "unique_words": len(set(full_transcript.lower().split())),
        },
        
        # ---- Timeline data ----
        "filler_timeline": filler_timeline,
        "filler_analysis": filler_analysis,
        
        # ---- Emotion data ----
        "emotion_data": {
            "snapshot_count": len(emotion_snapshots),
            "snapshots": emotion_snapshots,
        },
        
        # ---- Raw transcript ----
        "full_transcript": full_transcript,
    }
