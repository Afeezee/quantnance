import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# ⚠️ load_dotenv() MUST be called before ANY other imports
# that reference os.getenv() — including routes and services
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_database, close_database
from routes.brief import router as brief_router
from routes.history import router as history_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        # On Cloud Run (K_SERVICE is set), stdout is captured by Cloud Logging —
        # no need to write a file. Write the file only during local development.
        *([logging.FileHandler(Path(__file__).resolve().parent / "server.log", mode="w", encoding="utf-8")]
          if not os.getenv("K_SERVICE") else []),
    ],
)
logger = logging.getLogger("quantnance")

app = FastAPI(
    title="Quantnance API",
    description="AI-powered investment intelligence platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3000",
        # Production frontend — set FRONTEND_URL env var on the Cloud Run service
        *([os.getenv("FRONTEND_URL")] if os.getenv("FRONTEND_URL") else []),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brief_router, prefix="/api")
app.include_router(history_router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    await init_database()
    logger.info("Quantnance API ready")
    required_keys = [
        "BAYSE_PUBLIC_KEY",
        "GROQ_API_KEY",
        "NEWS_API_KEY",
    ]
    all_set = True
    for key in required_keys:
        value = os.getenv(key)
        if not value:
            logger.warning(f"⚠️  Environment variable {key} is not set")
            all_set = False
        else:
            # Show first 4 chars only — confirms it loaded without exposing the key
            logger.info(f"✅ {key} loaded ({value[:4]}****)")
    
    if all_set:
        logger.info("✅ All API keys loaded successfully")
    else:
        logger.warning("⚠️  Some API keys are missing — affected features will fail")


@app.on_event("shutdown")
async def shutdown_event():
    await close_database()


@app.get("/")
async def root():
    return {
        "message": "Quantnance API is running",
        "docs": "/docs",
        "health": "/health",
        "api": "/api",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "Quantnance API",
        "version": "1.0.0",
    }