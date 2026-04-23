import os
import json
import asyncio
import logging
from dotenv import load_dotenv

from livekit.agents import AutoSubscribe, JobContext, JobRequest, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import sarvam, google

import sys
sys.path.append(os.path.dirname(__file__))
from session_store import get_session

load_dotenv()
logger = logging.getLogger(__name__)

async def entrypoint(ctx: JobContext):
    # Determine session ID from room name
    session_id = ctx.room.name
    session = get_session(session_id)
    
    if not session:
        logger.error(f"Session not found for room {session_id}")
        return

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    resume_data = session.get("resume_data", {})
    questions = session.get("questions", [])
    
    interview_type = session.get("interview_type", "Mixed")
    difficulty = session.get("difficulty", "Mid")
    language = session.get("language", "English")

    resume_summary = "\n".join([f"{k}: {v}" for k, v in resume_data.items() if v])
    question_list = "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])

    # The agent system prompt template
    system_prompt = f"""
You are InterviewBot, a professional and empathetic interview coach conducting a {interview_type} interview at {difficulty} level.

Candidate Resume Summary:
{resume_summary}

Questions to ask (in order, but adapt based on answers):
{question_list}

Rules:
Be warm but professional. This is a safe practice environment.
Ask one question at a time. Wait for complete answers.
After each answer, give brief acknowledgment (1 sentence max), then proceed.
If the answer is very short (<15 words), gently prompt for more detail once.
Track question index internally. After all questions, give a closing statement and say "The interview is now complete. Thank you for your time."
Speak in {language}. Keep responses concise — you are asking questions, not lecturing.
Never reveal scores or evaluation during the interview.
"""

    model = google.LLM() # uses GEMINI_API_KEY from env
    
    assistant = VoiceAssistant(
        vad=None,
        stt=sarvam.STT(model="saarika:v2"),
        llm=model,
        tts=sarvam.TTS(model="bulbul:v3", voice="meera"), # "voice" parameter
        chat_ctx=llm.ChatContext().append(role="system", text=system_prompt)
    )

    assistant.start(ctx.room)
    
    await asyncio.sleep(1)
    await assistant.say("Hello! Let's begin with a quick introduction. Please tell me about yourself.", allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
