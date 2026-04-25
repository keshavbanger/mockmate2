"""
Resume Parser — PyMuPDF text extraction + Gemini 1.5 Flash structured parsing.
"""

import json
import logging
import re
from io import BytesIO

import asyncio
import fitz  # PyMuPDF
import google.generativeai as genai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini prompt
# ---------------------------------------------------------------------------
_EXTRACTION_PROMPT = """
Extract information from the following resume text and return ONLY valid JSON with these exact keys:
- name (string): full name of the candidate
- email (string): email address, empty string if not found
- skills (array of strings): technical and soft skills listed
- total_experience_years (number): estimated total years of professional experience, 0 if fresher
- job_titles (array of strings): all job/role titles found
- companies (array of strings): all company/organization names found
- education (array of strings): degrees and institutions, each as one string e.g. "B.Tech CS — NIT Trichy (2023)"
- summary (string): exactly 2 sentences summarising the candidate's profile

Important:
- Return ONLY the raw JSON object. No markdown fences, no explanation, no extra text.
- If a field cannot be determined, use an empty string or empty array as appropriate.

Resume Text:
\"\"\"
{resume_text}
\"\"\"
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Use PyMuPDF to extract all text from a PDF byte stream.
    Raises ValueError if the file cannot be opened or yields no text.
    """
    try:
        doc = fitz.open(stream=BytesIO(pdf_bytes), filetype="pdf")
    except Exception as exc:
        logger.error("PyMuPDF failed to open PDF: %s", exc)
        raise ValueError(f"Could not open PDF: {exc}") from exc

    pages_text: list[str] = []
    for page in doc:
        pages_text.append(page.get_text("text"))
    doc.close()

    full_text = "\n".join(pages_text).strip()
    if not full_text:
        raise ValueError("PDF appears to contain no extractable text (scanned image?).")

    logger.info("Extracted %d characters from PDF (%d pages).", len(full_text), len(pages_text))
    return full_text


async def parse_resume_with_gemini(
    pdf_bytes: bytes,
    gemini_model: genai.GenerativeModel,
) -> dict:
    """
    Full pipeline:
      1. Extract raw text via PyMuPDF
      2. Send to Gemini 1.5 Flash for structured JSON extraction
      3. Return parsed dict

    Raises:
        ValueError: on invalid PDF, no text, or unparseable Gemini response
        RuntimeError: on Gemini API error
    """
    # Step 1: extract raw text
    raw_text = await extract_text_from_pdf(pdf_bytes)

    # Truncate to ~12 000 chars to stay well within Gemini context limits
    truncated_text = raw_text[:12_000]
    if len(raw_text) > 12_000:
        logger.warning(
            "Resume text truncated from %d to 12,000 chars for Gemini.", len(raw_text)
        )

    prompt = _EXTRACTION_PROMPT.format(resume_text=truncated_text)

    # Step 2: call Gemini
    try:
        response = await asyncio.wait_for(
            gemini_model.generate_content_async(prompt),
            timeout=25.0,
        )
        raw_json = response.text.strip()
    except asyncio.TimeoutError:
        logger.error("Gemini API timed out after 25 seconds during resume parsing.")
        raise RuntimeError("Gemini API timed out. Please try again.")
    except Exception as exc:
        logger.error("Gemini API error during resume parsing: %s", exc)
        raise RuntimeError(f"Gemini API error: {exc}") from exc

    # Step 3: strip any accidental markdown fences
    raw_json = _strip_markdown_fences(raw_json)

    # Step 4: parse JSON
    try:
        parsed = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned non-JSON for resume:\n%s", raw_json[:500])
        raise ValueError(
            f"Gemini returned invalid JSON: {exc}. Raw response (first 500 chars): {raw_json[:500]}"
        ) from exc

    # Step 5: normalise / fill missing keys with safe defaults
    parsed = _normalise_resume(parsed)

    logger.info("Resume parsed successfully for candidate: %s", parsed.get("name", "Unknown"))
    return parsed


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers if present."""
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _normalise_resume(data: dict) -> dict:
    """Ensure all expected keys exist with correct types."""
    defaults: dict = {
        "name": "",
        "email": "",
        "skills": [],
        "total_experience_years": 0,
        "job_titles": [],
        "companies": [],
        "education": [],
        "summary": "",
    }
    for key, default in defaults.items():
        if key not in data:
            data[key] = default
        else:
            # Type coercion safety
            if isinstance(default, list) and not isinstance(data[key], list):
                data[key] = [data[key]] if data[key] else []
            elif isinstance(default, (int, float)) and isinstance(data[key], str):
                try:
                    data[key] = float(data[key])
                except ValueError:
                    data[key] = 0
    return data
