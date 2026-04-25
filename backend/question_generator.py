"""
Interview Question Generator — Gemini 1.5 Flash.
Generates exactly 7 progressively harder interview questions based on resume data.
"""

import asyncio
import json
import logging
import re

import google.generativeai as genai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------
_QUESTION_PROMPT = """
Generate exactly 7 interview questions for a {difficulty} level {interview_type} interview.

Candidate profile:
- Skills: {skills}
- Job titles held: {job_titles}
- Companies worked at: {companies}
- Education: {education}
- Total experience: {experience_years} years

Requirements:
- Questions must be progressively harder (Q1 easiest → Q7 hardest).
- Interview type is "{interview_type}": tailor questions accordingly.
  - Technical: focus on coding, system design, architecture, problem-solving
  - Behavioral: focus on STAR-method situational questions
  - HR: focus on culture fit, motivation, salary, goals
  - Mixed: blend of all three types
- Difficulty level is "{difficulty}":
  - Junior: foundational concepts, basic scenarios
  - Mid: intermediate depth, real-world trade-offs
  - Senior: complex, leadership, architectural decisions
- Language instruction: questions should be asked in {language}.
  - English: standard professional English
  - Hindi: modern Hindi with technical terms kept in English
  - Hinglish: natural mix of Hindi and English as spoken in Indian tech interviews
- Do NOT number the questions inside the strings.
- Return ONLY a JSON array of exactly 7 strings. No markdown, no explanation, no extra text.

Example format:
["Question one?", "Question two?", "Question three?", "Question four?", "Question five?", "Question six?", "Question seven?"]
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_questions(
    resume_data: dict,
    interview_type: str,
    difficulty: str,
    language: str,
    gemini_model: genai.GenerativeModel,
) -> list[str]:
    """
    Generate 7 interview questions using Gemini 1.5 Flash.

    Args:
        resume_data:    Parsed resume dict from resume_parser.
        interview_type: One of: Technical, Behavioral, HR, Mixed
        difficulty:     One of: Junior, Mid, Senior
        language:       One of: English, Hindi, Hinglish
        gemini_model:   Instantiated Gemini GenerativeModel.

    Returns:
        List of exactly 7 question strings.

    Raises:
        RuntimeError: on Gemini API failure
        ValueError:   if Gemini returns malformed data
    """
    skills_str = ", ".join(resume_data.get("skills", [])) or "Not specified"
    job_titles_str = ", ".join(resume_data.get("job_titles", [])) or "Not specified"
    companies_str = ", ".join(resume_data.get("companies", [])) or "Not specified"
    education_str = ", ".join(resume_data.get("education", [])) or "Not specified"
    experience_years = resume_data.get("total_experience_years", 0)

    prompt = _QUESTION_PROMPT.format(
        difficulty=difficulty,
        interview_type=interview_type,
        skills=skills_str,
        job_titles=job_titles_str,
        companies=companies_str,
        education=education_str,
        experience_years=experience_years,
        language=language,
    )

    logger.info(
        "Generating questions: type=%s | difficulty=%s | language=%s",
        interview_type,
        difficulty,
        language,
    )

    try:
        response = await asyncio.wait_for(
            gemini_model.generate_content_async(prompt),
            timeout=30.0,
        )
        raw = response.text.strip()
    except asyncio.TimeoutError:
        logger.error("Gemini API timed out after 30 seconds during question generation.")
        raise RuntimeError("Gemini API timed out generating questions. Please try again.")
    except Exception as exc:
        logger.error("Gemini API error during question generation: %s", exc)
        raise RuntimeError(f"Gemini API error: {exc}") from exc

    # Strip any accidental markdown fences
    raw = _strip_markdown_fences(raw)

    # Parse JSON array
    try:
        questions = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned non-JSON for questions:\n%s", raw[:500])
        raise ValueError(
            f"Gemini returned invalid JSON array: {exc}. Raw (first 500): {raw[:500]}"
        ) from exc

    if not isinstance(questions, list):
        raise ValueError(f"Expected a JSON array, got {type(questions).__name__}.")

    # Ensure exactly 7
    if len(questions) < 7:
        logger.warning("Gemini returned only %d questions; padding.", len(questions))
        questions += [f"Tell me more about your experience with {skills_str}."] * (7 - len(questions))
    elif len(questions) > 7:
        logger.warning("Gemini returned %d questions; trimming to 7.", len(questions))
        questions = questions[:7]

    # Ensure all items are strings
    questions = [str(q).strip() for q in questions]

    logger.info("Successfully generated %d questions.", len(questions))
    return questions


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers if present."""
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()
