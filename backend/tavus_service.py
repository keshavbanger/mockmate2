"""
Tavus CVI Service — persona creation, conversation lifecycle, cleanup.
Docs: https://docs.tavus.io/api-reference
"""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

TAVUS_BASE_URL = "https://tavusapi.com/v2"
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# ---------------------------------------------------------------------------
# System prompt template (injected into Tavus persona)
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT_TEMPLATE = """
You are InterviewBot, a professional and empathetic AI interview coach.
You are conducting a {interview_type} interview at {difficulty} level in {language}.

Candidate Resume:
- Name: {name}
- Skills: {skills}
- Experience: {experience}
- Companies: {companies}
- Education: {education}

Your Questions (ask in this order, adapt follow-ups based on answers):
{numbered_questions}

Behavior Rules:
- Start with: "Hello {name}! Welcome to your mock interview. I'm InterviewBot. Let's begin with a quick introduction — please tell me about yourself."
- Ask ONE question at a time. Never ask two questions together.
- After each answer, give a 1-sentence acknowledgment, then ask the next question.
- If the candidate's answer is under 15 words, prompt once: "Could you elaborate a bit more on that?"
- After all 7 questions, say: "That brings us to the end of the interview. You did great, {name}. Your detailed performance report will be ready shortly. Thank you!"
- Never reveal scores, never give feedback during the interview.
- Be warm, professional, and encouraging throughout.
- Do not go off-topic. Bring the conversation back to the interview if needed.
""".strip()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_test_mode() -> bool:
    """Return True when running with test credentials or forced test mode."""
    val = os.getenv("TAVUS_API_KEY", "").strip().lower()
    return val == "test" or val == ""


def _get_headers() -> dict:
    api_key = os.getenv("TAVUS_API_KEY", "")
    if not api_key:
        raise EnvironmentError("TAVUS_API_KEY is not set in the environment.")
    return {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }


def _build_system_prompt(
    resume_data: dict,
    questions: list[str],
    interview_type: str,
    difficulty: str,
    language: str,
) -> str:
    numbered_questions = "\n".join(
        f"{i + 1}. {q}" for i, q in enumerate(questions)
    )
    return _SYSTEM_PROMPT_TEMPLATE.format(
        interview_type=interview_type,
        difficulty=difficulty,
        language=language,
        name=resume_data.get("name", "Candidate"),
        skills=", ".join(resume_data.get("skills", [])) or "Not specified",
        experience=f"{resume_data.get('total_experience_years', 0)} years",
        companies=", ".join(resume_data.get("companies", [])) or "Not specified",
        education=", ".join(resume_data.get("education", [])) or "Not specified",
        numbered_questions=numbered_questions,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def create_persona(
    resume_data: dict,
    questions: list[str],
    interview_type: str,
    difficulty: str,
    language: str,
) -> str:
    """
    Create a Tavus persona injected with the candidate's resume and interview questions.

    Returns:
        persona_id (str)

    Raises:
        RuntimeError: on Tavus API error
        EnvironmentError: if TAVUS_API_KEY is missing
    """
    system_prompt = _build_system_prompt(
        resume_data, questions, interview_type, difficulty, language
    )
    replica_id = os.getenv("TAVUS_REPLICA_ID", "rf4e9d9790f0")

    payload = {
        "persona_name": f"InterviewBot-{interview_type}-{difficulty}",
        "system_prompt": system_prompt,
        "default_replica_id": replica_id,
        "pipeline_mode": "full",
        "context": (
            f"This is a {difficulty}-level {interview_type} interview. "
            f"The candidate is {resume_data.get('name', 'the candidate')}."
        ),
        "layers": {
            "llm": {
                "model": "tavus-gpt-4.1",
            }
        },
    }

    logger.info("Creating Tavus persona for %s ...", resume_data.get("name", "candidate"))

    # ── TEST MODE ──────────────────────────────────────────────────────────────
    if _is_test_mode():
        logger.warning("TEST MODE: returning mock persona_id (no real Tavus call)")
        return "test-persona-123"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.post(
                f"{TAVUS_BASE_URL}/personas",
                json=payload,
                headers=_get_headers(),
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text
            logger.error("Tavus persona creation failed [%s]: %s", exc.response.status_code, body)
            raise RuntimeError(
                f"Tavus persona creation failed ({exc.response.status_code}): {body}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Network error reaching Tavus API: %s", exc)
            raise RuntimeError(f"Network error reaching Tavus: {exc}") from exc

    data = resp.json()
    persona_id = data.get("persona_id") or data.get("id")
    if not persona_id:
        raise RuntimeError(f"Tavus returned no persona_id. Response: {data}")

    logger.info("Tavus persona created: %s", persona_id)
    return persona_id


async def create_conversation(
    persona_id: str,
    candidate_name: str,
    session_id: str,
) -> dict:
    """
    Start a Tavus CVI conversation for the given persona.

    Returns:
        dict with keys: conversation_id, conversation_url

    Raises:
        RuntimeError: on Tavus API error
    """
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    callback_url = f"{backend_url}/api/tavus-webhook"

    payload = {
        "persona_id": persona_id,
        "conversation_name": f"Interview: {candidate_name}",
        "callback_url": callback_url,
        "properties": {
            "max_call_duration": 1800,  # 30 minutes hard cap
            "participant_left_timeout": 60,
            "enable_recording": False,
            "apply_greenscreen": False,
        },
        "custom_greeting": (
            f"Hello {candidate_name}! Welcome to your mock interview. "
            "I'm InterviewBot. Let's begin with a quick introduction — "
            "please tell me about yourself."
        ),
    }

    logger.info("Creating Tavus conversation for persona %s ...", persona_id)

    # ── TEST MODE ──────────────────────────────────────────────────────────────
    if _is_test_mode():
        logger.warning("TEST MODE: returning mock conversation URL (no real Tavus call)")
        name_slug = candidate_name.lower().replace(" ", "-")
        return {
            "conversation_id": f"test-conv-{name_slug}-123",
            "conversation_url": "https://tavus.daily.co/test-room",
        }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.post(
                f"{TAVUS_BASE_URL}/conversations",
                json=payload,
                headers=_get_headers(),
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text
            logger.error(
                "Tavus conversation creation failed [%s]: %s",
                exc.response.status_code,
                body,
            )
            raise RuntimeError(
                f"Tavus conversation creation failed ({exc.response.status_code}): {body}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Network error reaching Tavus API: %s", exc)
            raise RuntimeError(f"Network error reaching Tavus: {exc}") from exc

    data = resp.json()
    conversation_id = data.get("conversation_id") or data.get("id")
    conversation_url = data.get("conversation_url")

    if not conversation_id or not conversation_url:
        raise RuntimeError(
            f"Tavus returned incomplete conversation data. Response: {data}"
        )

    logger.info(
        "Tavus conversation created: id=%s url=%s", conversation_id, conversation_url
    )
    return {
        "conversation_id": conversation_id,
        "conversation_url": conversation_url,
    }


async def end_conversation(conversation_id: str) -> None:
    """
    Terminate an active Tavus conversation via DELETE.

    Raises:
        RuntimeError: on Tavus API error
    """
    logger.info("Ending Tavus conversation: %s", conversation_id)

    # ── TEST MODE ──────────────────────────────────────────────────────────────
    if _is_test_mode():
        logger.warning("TEST MODE: skipping real Tavus end_conversation call")
        return

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.delete(
                f"{TAVUS_BASE_URL}/conversations/{conversation_id}",
                headers=_get_headers(),
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text
            logger.error(
                "Tavus conversation end failed [%s]: %s",
                exc.response.status_code,
                body,
            )
            raise RuntimeError(
                f"Tavus conversation end failed ({exc.response.status_code}): {body}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Network error reaching Tavus API: %s", exc)
            raise RuntimeError(f"Network error reaching Tavus: {exc}") from exc

    logger.info("Tavus conversation %s ended successfully.", conversation_id)


async def get_conversation_status(conversation_id: str) -> dict:
    """
    Fetch current status of a Tavus conversation.

    Returns:
        Raw Tavus conversation object dict.
    """
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.get(
                f"{TAVUS_BASE_URL}/conversations/{conversation_id}",
                headers=_get_headers(),
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"Tavus status check failed ({exc.response.status_code}): {exc.response.text}"
            ) from exc
    return resp.json()
