"""
Interview lifecycle routes:

  POST /api/start-interview
    - Creates Tavus persona + conversation
    - Returns conversation_url, conversation_id, session_id

  POST /api/save-turn
    - Saves a single Q&A turn to session

  POST /api/end-interview
    - Ends the Tavus conversation
    - Marks session as completed
"""

import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from session_store import get_session, update_session
import tavus_service
import google.generativeai as genai
import os

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class StartInterviewRequest(BaseModel):
    session_id: str
    model_config = {"str_strip_whitespace": True}


class TurnData(BaseModel):
    role: str = Field(..., description="'interviewer' or 'candidate'")
    text: str = Field(..., description="Transcript text of this turn")
    question_index: int | None = Field(None, description="0-based index of the question")
    timestamp_ms: int | None = Field(None, description="Client timestamp in ms")
    quality: dict | None = Field(None, description="Optional: {score, feedback} from Gemini")


class SaveTurnRequest(BaseModel):
    session_id: str
    turn_data: TurnData


class EndInterviewRequest(BaseModel):
    session_id: str
    conversation_id: str


class SaveEmotionRequest(BaseModel):
    session_id: str
    snapshots: list


# ---------------------------------------------------------------------------
# POST /api/start-interview
# ---------------------------------------------------------------------------

@router.post("/start-interview")
async def start_interview(body: StartInterviewRequest):
    """
    Validates session has resume + questions, then:
      1. Creates a Tavus persona (with injected system prompt)
      2. Creates a Tavus conversation
      3. Marks session as active
      4. Returns the conversation URL for the frontend embed
    """
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(404, f"Session '{body.session_id}' not found or expired.")

    resume_data: dict = session.get("resume_data", {})
    questions: list = session.get("questions", [])

    if not resume_data:
        raise HTTPException(400, "Resume not uploaded yet. Call /api/parse-resume first.")
    if not questions:
        raise HTTPException(400, "Questions not generated yet. Call /api/generate-questions first.")

    interview_type = session.get("interview_type", "Mixed")
    difficulty = session.get("difficulty", "Mid")
    language = session.get("language", "English")
    candidate_name = resume_data.get("name", "Candidate")

    # --- Create persona
    try:
        persona_id = await tavus_service.create_persona(
            resume_data=resume_data,
            questions=questions,
            interview_type=interview_type,
            difficulty=difficulty,
            language=language,
        )
    except (RuntimeError, EnvironmentError) as exc:
        logger.error("Persona creation failed: %s", exc)
        raise HTTPException(502, f"Failed to create interview persona: {exc}")

    # --- Create conversation
    try:
        convo = await tavus_service.create_conversation(
            persona_id=persona_id,
            candidate_name=candidate_name,
            session_id=body.session_id,
        )
    except RuntimeError as exc:
        logger.error("Conversation creation failed: %s", exc)
        raise HTTPException(502, f"Failed to start interview conversation: {exc}")

    # --- Persist to session
    update_session(body.session_id, "status", "active")
    update_session(body.session_id, "tavus_persona_id", persona_id)
    update_session(body.session_id, "tavus_conversation_id", convo["conversation_id"])
    update_session(body.session_id, "conversation_url", convo["conversation_url"])
    update_session(body.session_id, "turns", [])
    update_session(body.session_id, "emotion_snapshots", [])
    update_session(body.session_id, "start_time", time.time())

    logger.info(
        "Interview started for session %s. Conversation: %s",
        body.session_id,
        convo["conversation_id"],
    )

    return {
        "session_id": body.session_id,
        "conversation_id": convo["conversation_id"],
        "conversation_url": convo["conversation_url"],
        "persona_id": persona_id,
        "status": "active",
    }


# ---------------------------------------------------------------------------
# POST /api/save-turn
# ---------------------------------------------------------------------------

@router.post("/save-turn")
async def save_turn(body: SaveTurnRequest):
    """
    Append a single conversation turn to the session transcript.
    Called by the frontend each time Tavus fires a transcript event.
    """
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(404, f"Session '{body.session_id}' not found or expired.")

    turns: list = session.get("turns", [])
    turns.append(body.turn_data.model_dump())
    update_session(body.session_id, "turns", turns)

    logger.debug(
        "Turn saved for session %s: role=%s q_idx=%s",
        body.session_id,
        body.turn_data.role,
        body.turn_data.question_index,
    )

    return {"ok": True, "turn_count": len(turns)}


# ---------------------------------------------------------------------------
# POST /api/end-interview
# ---------------------------------------------------------------------------

@router.post("/end-interview")
async def end_interview(body: EndInterviewRequest):
    """
    Terminate the Tavus conversation and mark the session as completed.
    """
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(404, f"Session '{body.session_id}' not found or expired.")

    # End Tavus conversation (best-effort — don't fail the session if Tavus errors)
    try:
        await tavus_service.end_conversation(body.conversation_id)
    except RuntimeError as exc:
        logger.warning(
            "Could not end Tavus conversation %s: %s (continuing session close)",
            body.conversation_id,
            exc,
        )

    # Mark session done
    update_session(body.session_id, "status", "completed")
    update_session(body.session_id, "end_time", time.time())

    logger.info("Interview ended for session %s.", body.session_id)

    return {
        "session_id": body.session_id,
        "status": "completed",
        "conversation_id": body.conversation_id,
    }
# ---------------------------------------------------------------------------
# POST /api/mock-chat
# ---------------------------------------------------------------------------

class MockChatRequest(BaseModel):
    session_id: str
    user_text: str

@router.post("/mock-chat")
async def mock_chat(body: MockChatRequest):
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(404, f"Session '{body.session_id}' not found.")

    turns = session.get("turns", [])
    # 1. Save user turn
    if body.user_text.strip():
        turns.append({"role": "candidate", "text": body.user_text, "timestamp_ms": int(time.time() * 1000)})
        update_session(body.session_id, "turns", turns)

    # 2. Build history
    history = []
    for t in turns:
        history.append(f"{t['role'].upper()}: {t['text']}")
    history_str = "\n".join(history)

    questions = session.get("questions", [])
    numbered_questions = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])

    prompt = f"""
    You are InterviewBot, an AI interviewer.
    Here are the planned questions for the interview:
    {numbered_questions}
    
    Here is the conversation so far:
    {history_str}
    
    Instructions:
    Evaluate the candidate's last answer. 
    If the candidate asked to repeat the question, repeat it.
    If the answer is too short or lacks detail, ask a follow-up question.
    If the answer is satisfactory, acknowledge it briefly and ask the NEXT question from the planned list.
    If all questions are asked and answered, say "That concludes our interview. Thank you!".
    Do not give away the score. Keep your response concise, spoken-style, and professional.
    
    Respond only with the exact text you want to speak next. Do not include any other formatting.
    """

    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    
    logger.info(f"MOCK CHAT PROMPT:\n{prompt}")
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        ai_reply = response.text.strip()
    except Exception as e1:
        logger.warning(f"Failed with gemini-2.0-flash: {e1}. Falling back to gemini-flash-latest...")
        try:
            model = genai.GenerativeModel("gemini-flash-latest")
            response = model.generate_content(prompt)
            ai_reply = response.text.strip()
        except Exception as e2:
            logger.error(f"Gemini error in mock-chat: {e2}")
            ai_reply = "I'm having trouble connecting. Could you please repeat that?"

    logger.info(f"MOCK CHAT REPLY:\n{ai_reply}")
    
    # 3. Save AI turn
    turns.append({"role": "interviewer", "text": ai_reply, "timestamp_ms": int(time.time() * 1000)})
    update_session(body.session_id, "turns", turns)

    return {"reply": ai_reply}


# ---------------------------------------------------------------------------
# POST /api/save-emotion-snapshots
# ---------------------------------------------------------------------------

@router.post("/save-emotion-snapshots")
async def save_emotion_snapshots(body: SaveEmotionRequest):
    session = get_session(body.session_id)
    if session is None:
        raise HTTPException(404, f"Session '{body.session_id}' not found.")
        
    snapshots = session.get("emotion_snapshots", [])
    snapshots.extend(body.snapshots)
    update_session(body.session_id, "emotion_snapshots", snapshots)
    return {"ok": True, "count": len(snapshots)}
