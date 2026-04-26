"""
Shared FastAPI dependency: initialises and returns the Gemini GenerativeModel.
When GEMINI_API_KEY="test", returns a MockGeminiModel that produces realistic
dummy responses so the full UI flow can be tested without real API keys.
"""

import json
import logging
import os

import google.generativeai as genai
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_gemini_model: "genai.GenerativeModel | None" = None
_gemini_api_key_used: str = ""


# ---------------------------------------------------------------------------
# Mock model for test mode
# ---------------------------------------------------------------------------

class _MockResponse:
    def __init__(self, text: str):
        self.text = text


class MockGeminiModel:
    """Drop-in replacement for genai.GenerativeModel when GEMINI_API_KEY=test."""

    async def generate_content_async(self, prompt: str) -> _MockResponse:
        p = prompt.lower()

        # ── 1. Resume extraction ──────────────────────────────────────────────
        if "extract" in p and "resume" in p:
            return _MockResponse(json.dumps({
                "name": "John Doe",
                "email": "john.doe@example.com",
                "skills": ["Python", "FastAPI", "React", "TypeScript", "Docker",
                           "AWS", "PostgreSQL", "Redis", "PyTorch", "Node.js"],
                "total_experience_years": 4,
                "job_titles": ["Senior Software Engineer", "Full Stack Developer"],
                "companies": ["Acme Technologies", "TechStartup India"],
                "education": ["B.Tech CS - IIT Delhi (2021, CGPA 8.7)"],
                "summary": ("Software engineer with 4 years in full-stack and ML pipelines. "
                            "Strong Python and React background with cloud expertise.")
            }))

        # ── 2. Full report (BEFORE question-gen — prompt contains "generate") ─
        if "executive_summary" in p or "communication_score" in p:
            return _MockResponse(json.dumps({
                "executive_summary": (
                    "John demonstrated strong technical depth and clear communication. "
                    "His system-design answers were particularly impressive. "
                    "The main growth area is providing quantitative evidence in behavioural answers. "
                    "Overall a strong candidate with minor communication refinements needed."
                ),
                "strengths": [
                    "Excellent technical depth in distributed systems and API design",
                    "Clear, well-structured communication with minimal filler words",
                    "Strong real-world examples backed by measurable outcomes"
                ],
                "improvements": [
                    "Elaborate on team dynamics in behavioural questions",
                    "Reduce speaking pace slightly under pressure",
                    "Strengthen open-ended answers using the STAR framework"
                ],
                "recommendations": [
                    "Practice 20 STAR-method behavioural answers and record yourself",
                    "Do 2-3 mock system-design interviews on Pramp or Interviewing.io",
                    "Review negotiation and conflict-resolution scenarios"
                ],
                "communication_score": 8,
                "confidence_score": 7,
                "technical_score": 8,
                "overall_score": 8,
                "question_feedback": [
                    {"question": "Tell me about yourself.",
                     "answer_summary": "Covered background and key skills confidently.",
                     "score": 4, "ai_feedback": "Strong intro; add a concise career highlight."},
                    {"question": "Describe a challenging technical problem.",
                     "answer_summary": "Explained API latency issue with clear resolution.",
                     "score": 5, "ai_feedback": "Excellent STAR structure with metrics."},
                    {"question": "How do you handle disagreements?",
                     "answer_summary": "Described a data-driven discussion approach.",
                     "score": 4, "ai_feedback": "Good tone; add a concrete outcome."},
                    {"question": "Design a high-availability REST API.",
                     "answer_summary": "Covered load balancing, caching, DB replication.",
                     "score": 5, "ai_feedback": "Comprehensive; add monitoring strategy."},
                    {"question": "Learning new tech under deadline.",
                     "answer_summary": "Used structured learning and pair programming.",
                     "score": 4, "ai_feedback": "Good example; quantify the time saved."},
                    {"question": "How do you prioritise tasks?",
                     "answer_summary": "Mentioned Eisenhower matrix and stakeholder alignment.",
                     "score": 4, "ai_feedback": "Solid framework; add real scenario."},
                    {"question": "Where do you see yourself in 3 years?",
                     "answer_summary": "Aims for principal engineer in ML infrastructure.",
                     "score": 4, "ai_feedback": "Clear vision; tie it to company growth."},
                ]
            }))

        # ── 3. Question generation ────────────────────────────────────────────
        if "question" in p and ("generate" in p or "interview" in p):
            return _MockResponse(json.dumps([
                "Tell me about yourself and your journey into software engineering.",
                "Describe a challenging technical problem you solved at Acme Technologies. What was your approach?",
                "How do you handle disagreements with teammates about technical decisions?",
                "Walk me through designing a high-availability REST API serving 500k requests per day.",
                "Tell me about a time you had to learn a new technology under a tight deadline.",
                "How do you prioritise tasks when working on multiple projects simultaneously?",
                "Where do you see yourself in 3 years, and how does this role fit that vision?"
            ]))

        # ── 4. Answer quality scoring ─────────────────────────────────────────
        if "rate this interview answer" in p or "score" in p:
            return _MockResponse(json.dumps({
                "score": 4,
                "feedback": "Good answer with clear structure; add more specific metrics."
            }))

        # ── Fallback ──────────────────────────────────────────────────────────
        return _MockResponse('{"result": "mock response"}')


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------

def get_gemini_model():
    """
    FastAPI dependency that returns a cached Gemini model instance.
    Re-initializes if GEMINI_API_KEY has changed since last init.
    Falls back to MockGeminiModel when GEMINI_API_KEY=test.
    Raises HTTP 503 if the API key is missing entirely.
    """
    global _gemini_model, _gemini_api_key_used

    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        logger.error("GEMINI_API_KEY is not configured.")
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured on the server.",
        )

    # Re-initialize if key changed
    if _gemini_model is not None and api_key == _gemini_api_key_used:
        return _gemini_model

    if api_key.lower() == "test":
        logger.warning("TEST MODE: using MockGeminiModel — no real Gemini calls will be made.")
        _gemini_model = MockGeminiModel()
        return _gemini_model

    # Real Gemini model
    genai.configure(api_key=api_key)
    _gemini_model = genai.GenerativeModel(
        "gemini-1.5-flash",
        generation_config=genai.GenerationConfig(
            temperature=0.7,
            max_output_tokens=4096,
        ),
    )
    _gemini_api_key_used = api_key
    logger.info("Gemini 1.5 Flash model initialised.")
    return _gemini_model
