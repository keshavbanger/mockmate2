"""
AI Mock Interview Platform — FastAPI Backend Entry Point
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from session_store import cleanup_loop

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AI Mock Interview backend starting up …")
    # Start background session-cleanup task
    cleanup_task = asyncio.create_task(cleanup_loop())
    yield
    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("👋 Backend shut down cleanly.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Mock Interview API",
    description="Backend for the AI-powered mock interview platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — in dev allow all origins so any Vite port (5173, 5174, …) works.
# For production, set CORS_ORIGINS env var to your actual frontend URL.
_dev_mode = os.getenv("ENV", "development") != "production"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _dev_mode else [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ],
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred.", "error": str(exc)},
    )


# ---------------------------------------------------------------------------
# Route imports  (placed after app creation to avoid circular imports)
# ---------------------------------------------------------------------------
from routes.resume import router as resume_router
from routes.questions import router as questions_router
from routes.interview import router as interview_router
from routes.session import router as session_router
from routes.report import router as report_router
from routes.webhook import router as webhook_router
from routes.recording import router as recording_router
from routes.dev import router as dev_router

app.include_router(resume_router, prefix="/api", tags=["Resume"])
app.include_router(questions_router, prefix="/api", tags=["Questions"])
app.include_router(interview_router, prefix="/api", tags=["Interview"])
app.include_router(session_router, prefix="/api", tags=["Session"])
app.include_router(report_router, prefix="/api", tags=["Report"])
app.include_router(webhook_router, prefix="/api", tags=["Webhook"])
app.include_router(recording_router, prefix="/api", tags=["Recording"])
app.include_router(dev_router, prefix="/api", tags=["Development"])

# Serve recordings from uploads folder
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)
app.mount("/recordings", StaticFiles(directory=UPLOADS_DIR), name="recordings")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "ai-mock-interview-api"}


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True, log_level="info")
