"""
Filler Word Detector & Answer Quality Analyzer.

Provides:
  - count_filler_words(transcript)      → { word: count }
  - get_words_per_minute(transcript, duration_seconds) → float
  - get_pause_count(transcript) → int
  - analyze_answer_quality(question, answer, gemini_model) → { score, feedback }
"""

import json
import logging
import re

import google.generativeai as genai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Filler word list — ordered longest-first so multi-word fillers match first
# ---------------------------------------------------------------------------
FILLER_WORDS: list[str] = [
    "you know",
    "kind of",
    "sort of",
    "you see",
    "i mean",
    "i guess",
    "um",
    "uh",
    "hmm",
    "err",
    "like",
    "basically",
    "actually",
    "literally",
    "right",
    "so",
    "well",
]

# Pre-compile patterns (word-boundary aware, case-insensitive)
_FILLER_PATTERNS: list[tuple[str, re.Pattern]] = [
    (word, re.compile(r"\b" + re.escape(word) + r"\b", re.IGNORECASE))
    for word in FILLER_WORDS
]

# ---------------------------------------------------------------------------
# Answer quality prompt
# ---------------------------------------------------------------------------
_QUALITY_PROMPT = """
Rate this interview answer from 1 to 5 based on three criteria: relevance, clarity, and depth.

Question: {question}
Answer: {answer}

Scoring guide:
  5 = Excellent — highly relevant, clearly explained, well-structured, detailed
  4 = Good — relevant and clear but could use slightly more depth
  3 = Average — partially relevant or lacking specifics
  2 = Weak — vague, off-topic, or very short
  1 = Very poor — does not address the question at all

Return ONLY valid JSON with exactly these two keys:
  score (integer 1-5)
  feedback (string, max 20 words, constructive improvement hint)

No markdown, no explanation. JSON only.
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def count_filler_words(transcript: str) -> dict[str, int]:
    """
    Count occurrences of each filler word in the transcript.

    Returns a dict mapping each filler word to its count.
    Only includes words with count > 0.
    """
    if not transcript or not transcript.strip():
        return {}

    counts: dict[str, int] = {}
    for word, pattern in _FILLER_PATTERNS:
        matches = pattern.findall(transcript)
        if matches:
            counts[word] = len(matches)

    logger.debug(
        "Filler words detected: %s (total: %d)",
        counts,
        sum(counts.values()),
    )
    return counts


def get_words_per_minute(transcript: str, duration_seconds: float) -> float:
    """
    Calculate speaking rate in words per minute.

    Args:
        transcript:        Full transcript string.
        duration_seconds:  Interview duration in seconds (> 0).

    Returns:
        WPM as float, rounded to 1 decimal. Returns 0.0 if duration is invalid.
    """
    if not transcript or duration_seconds <= 0:
        return 0.0

    # Simple whitespace tokenisation — sufficient for WPM estimation
    word_count = len(transcript.split())
    duration_minutes = duration_seconds / 60.0
    wpm = word_count / duration_minutes

    logger.debug("WPM: %.1f (%d words / %.1f min)", wpm, word_count, duration_minutes)
    return round(wpm, 1)


def get_pause_count(transcript: str) -> int:
    """
    Estimate the number of pauses/hesitations in the transcript.

    Detects:
      - Explicit ellipsis markers: "..." or ". . ."
      - Square-bracket pause annotations: [pause], [silence], [...]
      - Double-dash hesitations: " -- "

    Returns:
        Integer count of detected pauses.
    """
    if not transcript:
        return 0

    patterns: list[re.Pattern] = [
        re.compile(r"\.{3,}"),                        # "..." or "....."
        re.compile(r"\.\s\.\s\."),                    # ". . ."
        re.compile(r"\[(?:pause|silence|\.\.\.)\]", re.IGNORECASE),  # bracketed
        re.compile(r"\s--\s"),                        # em-dash hesitations
    ]

    count = 0
    for pat in patterns:
        count += len(pat.findall(transcript))

    logger.debug("Pause count: %d", count)
    return count


async def analyze_answer_quality(
    question: str,
    answer: str,
    gemini_model: genai.GenerativeModel,
) -> dict:
    """
    Use Gemini 1.5 Flash to score the quality of a candidate's answer.

    Args:
        question:      The interview question asked.
        answer:        The candidate's answer transcript.
        gemini_model:  Instantiated Gemini GenerativeModel.

    Returns:
        dict: { "score": int (1-5), "feedback": str }

    On any error, returns a safe fallback: { "score": 3, "feedback": "Analysis unavailable." }
    """
    if not answer or len(answer.strip()) < 5:
        return {"score": 1, "feedback": "Answer was too short to evaluate."}

    prompt = _QUALITY_PROMPT.format(
        question=question.strip(),
        answer=answer.strip()[:3000],  # cap answer length
    )

    try:
        response = await gemini_model.generate_content_async(prompt)
        raw = response.text.strip()
    except Exception as exc:
        logger.error("Gemini error in analyze_answer_quality: %s", exc)
        return {"score": 3, "feedback": "Analysis unavailable."}

    # Strip markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw).strip()

    try:
        result = json.loads(raw)
        score = int(result.get("score", 3))
        score = max(1, min(5, score))  # clamp to [1, 5]
        feedback = str(result.get("feedback", "No feedback provided."))
        return {"score": score, "feedback": feedback}
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        logger.warning("Could not parse Gemini quality response: %s | Raw: %s", exc, raw[:200])
        return {"score": 3, "feedback": "Could not parse quality score."}


# ---------------------------------------------------------------------------
# Derived aggregates
# ---------------------------------------------------------------------------

def summarise_filler_stats(counts: dict[str, int], transcript: str) -> dict:
    """
    Return a rich filler-word statistics summary.

    Returns:
        {
          "total_words": int,
          "filler_count": int,
          "filler_rate_percent": float,
          "breakdown": { word: count },
          "top_fillers": [word, ...],   # top 3 by count
        }
    """
    total_words = len(transcript.split()) if transcript else 0
    filler_count = sum(counts.values())
    rate = round((filler_count / total_words * 100), 2) if total_words > 0 else 0.0
    top_fillers = sorted(counts, key=counts.get, reverse=True)[:3]  # type: ignore[arg-type]

    return {
        "total_words": total_words,
        "filler_count": filler_count,
        "filler_rate_percent": rate,
        "breakdown": counts,
        "top_fillers": top_fillers,
    }


# ---------------------------------------------------------------------------
# Filler word detection with timestamps
# ---------------------------------------------------------------------------

def detect_fillers_with_timestamps(turns: list[dict]) -> dict:
    """
    Detect filler words from a list of turns and map to timestamps.
    
    Each turn should have:
      - text: str - the transcript text
      - timestamp_ms: int or None - when this turn occurred
      - role: str - "candidate" or "interviewer"
    
    Returns:
        {
            "word": {
                "count": int,
                "occurrences": [
                    { "timestamp_ms": int, "turn_index": int, "role": str }
                ]
            }
        }
    """
    if not turns:
        return {}

    analysis = {}

    for turn_idx, turn in enumerate(turns):
        text = turn.get("text", "").lower()
        role = turn.get("role", "unknown")
        timestamp_ms = turn.get("timestamp_ms")

        if not text:
            continue

        # Count filler occurrences in this turn
        for word, pattern in _FILLER_PATTERNS:
            matches = pattern.findall(text)
            if not matches:
                continue

            if word not in analysis:
                analysis[word] = {
                    "count": 0,
                    "occurrences": [],
                }

            occurrence_count = len(matches)
            analysis[word]["count"] += occurrence_count

            # Record timestamp
            if timestamp_ms is not None:
                analysis[word]["occurrences"].append({
                    "timestamp_ms": timestamp_ms,
                    "turn_index": turn_idx,
                    "role": role,
                    "count_in_turn": occurrence_count,
                })

    return analysis


def get_filler_timeline(filler_analysis: dict) -> list[dict]:
    """
    Convert filler analysis to a chronological timeline for visualization.
    
    Args:
        filler_analysis: Output from detect_fillers_with_timestamps()
    
    Returns:
        List of timeline events sorted by timestamp:
        [
            {
                "timestamp_ms": int,
                "word": str,
                "count": int,
                "role": str,
                "turn_index": int
            }
        ]
    """
    timeline = []

    for word, data in filler_analysis.items():
        for occurrence in data.get("occurrences", []):
            timeline.append({
                "timestamp_ms": occurrence["timestamp_ms"],
                "word": word,
                "count": occurrence.get("count_in_turn", 1),
                "role": occurrence.get("role", "unknown"),
                "turn_index": occurrence.get("turn_index"),
            })

    # Sort by timestamp
    timeline.sort(key=lambda x: x["timestamp_ms"] or 0)
    return timeline
