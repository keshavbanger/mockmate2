"""
Development/testing endpoints for report generation diagnostics.
Only enabled in development mode.

These endpoints allow manual data injection to test the report pipeline
without needing to run full interviews.
"""

import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from session_store import get_session, update_session

logger = logging.getLogger(__name__)
router = APIRouter()

# Only enable in development
DEV_MODE = os.getenv("ENV", "development") != "production"


class InjectTestDataRequest(BaseModel):
    session_id: str
    questions_count: int = 7
    answers_count: int = 7
    emotion_snapshots_count: int = 50


@router.post("/dev/inject-test-data")
async def inject_test_data(body: InjectTestDataRequest):
    """
    [DEV ONLY] Inject realistic test data into a session.
    Useful for testing report generation without running full interviews.
    """
    if not DEV_MODE:
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available in development mode",
        )

    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(404, f"Session '{body.session_id}' not found")

    # Generate sample questions if not present
    if not session.get("questions"):
        sample_questions = [
            "Tell me about your background and experience with software development.",
            "Describe a challenging project you worked on and how you solved it.",
            "What is your approach to writing clean, maintainable code?",
            "How do you stay updated with new technologies and best practices?",
            "Tell me about a time you had to collaborate with a difficult team member.",
            "What are your strengths and areas for improvement as a developer?",
            "Why are you interested in this role and our company?",
        ]
        questions = sample_questions[: body.questions_count]
        update_session(body.session_id, "questions", questions)
        logger.info("Injected %d sample questions", len(questions))

    # Generate sample turns (interviewer questions + candidate answers)
    turns = []
    sample_answers = [
        "I've been developing software for about 5 years. I started with Python and JavaScript, then moved to full-stack development with React and Node.js. I've also worked with cloud platforms like AWS.",
        "We had a performance optimization challenge in a data-heavy application. The system was processing large datasets slowly, causing user timeouts. I analyzed the bottlenecks, optimized the query patterns, implemented caching layers, and reduced query time from 30 seconds to 2 seconds.",
        "I focus on SOLID principles, use meaningful naming, keep functions small and single-purpose, maintain proper documentation, and write unit tests. Code reviews are crucial for maintaining standards.",
        "I follow tech blogs, contribute to open-source projects, attend webinars, and experiment with new tools in side projects. I believe continuous learning is essential in this fast-moving industry.",
        "I focused on understanding their perspective, communicated clearly about dependencies, and found compromises that satisfied both parties. It taught me the importance of empathy and early communication.",
        "My strength is problem-solving and debugging complex systems. I tend to perfectionism sometimes, which I'm working on by prioritizing features and accepting good-enough solutions.",
        "I'm drawn to your company's mission and the technical challenges here. The team's commitment to innovation and the opportunity to grow with emerging technologies align perfectly with my career goals.",
    ]

    for i in range(body.answers_count):
        # Add interviewer turn
        q_idx = i % len(session.get("questions", []))
        if q_idx < len(session.get("questions", [])):
            turns.append({
                "role": "interviewer",
                "text": session["questions"][q_idx],
                "timestamp_ms": i * 10000,
                "question_index": q_idx,
            })

        # Add candidate answer
        answer_idx = i % len(sample_answers)
        turns.append({
            "role": "candidate",
            "text": sample_answers[answer_idx],
            "timestamp_ms": i * 10000 + 5000,
            "question_index": q_idx if q_idx < len(session.get("questions", [])) else None,
        })

    update_session(body.session_id, "turns", turns)
    logger.info("Injected %d sample turns", len(turns))

    # Generate sample emotion snapshots
    if not session.get("emotion_snapshots"):
        emotions = []
        for i in range(body.emotion_snapshots_count):
            import random
            emotions.append({
                "timestamp_ms": int(i * (30000 / body.emotion_snapshots_count)),
                "emotions": {
                    "confident": random.uniform(0.3, 0.8),
                    "nervous": random.uniform(0.1, 0.4),
                    "neutral": random.uniform(0.1, 0.4),
                },
                "gaze": random.choice(["center", "away"]),
                "confidence_score": random.uniform(0.4, 0.9),
            })
        update_session(body.session_id, "emotion_snapshots", emotions)
        logger.info("Injected %d sample emotion snapshots", len(emotions))

    # Mark as completed if it's still active
    if session.get("status") == "active":
        import time
        update_session(body.session_id, "status", "completed")
        if not session.get("start_time"):
            update_session(body.session_id, "start_time", time.time() - 600)
        update_session(body.session_id, "end_time", time.time())

    return {
        "ok": True,
        "message": "Test data injected successfully",
        "data": {
            "questions": len(session.get("questions", [])),
            "turns": len(turns),
            "emotion_snapshots": len(session.get("emotion_snapshots", [])),
        },
    }


@router.get("/dev/session/{session_id}/data")
async def get_session_data(session_id: str):
    """
    [DEV ONLY] Return raw session data for inspection.
    """
    if not DEV_MODE:
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only available in development mode",
        )

    session = get_session(session_id)
    if session is None:
        raise HTTPException(404, f"Session '{session_id}' not found")

    return {
        "session_id": session_id,
        "status": session.get("status"),
        "questions": session.get("questions", []),
        "turns_count": len(session.get("turns", [])),
        "turns_sample": session.get("turns", [])[:3],
        "emotion_snapshots_count": len(session.get("emotion_snapshots", [])),
        "emotion_sample": session.get("emotion_snapshots", [])[:3],
        "has_report": bool(session.get("report")),
    }
