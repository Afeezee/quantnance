import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# ⚠️ load_dotenv() MUST be called before ANY other imports
# that reference os.getenv() — including routes and services
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

SERVER_DIR = Path(__file__).resolve().parent
CLIENT_DIST_DIR = Path(os.getenv("CLIENT_DIST_DIR", SERVER_DIR.parent / "client" / "dist"))
CLIENT_INDEX_FILE = CLIENT_DIST_DIR / "index.html"
SPA_EXCLUDED_PATHS = {
    "api",
    "docs",
    "docs/oauth2-redirect",
    "openapi.json",
    "redoc",
    "health",
}


def _split_origins(value: str | None) -> list[str]:
    if not value:
        return []

    return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]


def _cors_origins() -> list[str]:
    origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:3000",
    ]
    origins.extend(_split_origins(os.getenv("FRONTEND_URL")))
    origins.extend(_split_origins(os.getenv("FRONTEND_URLS")))

    deduped_origins: list[str] = []
    seen: set[str] = set()
    for origin in origins:
        if origin in seen:
            continue
        seen.add(origin)
        deduped_origins.append(origin)

    return deduped_origins


def _clerk_publishable_key() -> str | None:
    return os.getenv("CLERK_PUBLISHABLE_KEY") or os.getenv("VITE_CLERK_PUBLISHABLE_KEY")

app = FastAPI(
    title="Quantnance API",
    description="AI-powered investment intelligence platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brief_router, prefix="/api")
app.include_router(history_router, prefix="/api")

if CLIENT_DIST_DIR.exists():
    assets_dir = CLIENT_DIST_DIR / "assets"
    brand_dir = CLIENT_DIST_DIR / "brand"
    favicon_file = CLIENT_DIST_DIR / "favicon.svg"
    manifest_file = CLIENT_DIST_DIR / "site.webmanifest"

    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    if brand_dir.exists():
        app.mount("/brand", StaticFiles(directory=brand_dir), name="brand")

    if favicon_file.exists():
        @app.get("/favicon.svg", include_in_schema=False)
        async def favicon():
            return FileResponse(favicon_file)

    if manifest_file.exists():
        @app.get("/site.webmanifest", include_in_schema=False)
        async def site_webmanifest():
            return FileResponse(manifest_file)


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
    if CLIENT_INDEX_FILE.exists():
        return FileResponse(CLIENT_INDEX_FILE)

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


@app.get("/api/health")
async def api_health_check():
    return await health_check()


@app.get("/api/app-config")
async def app_config():
    return {
        "clerk_publishable_key": _clerk_publishable_key(),
    }


if CLIENT_INDEX_FILE.exists():
    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_entry(full_path: str):
        if full_path in SPA_EXCLUDED_PATHS or full_path.startswith("api/") or full_path.startswith("docs/"):
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(CLIENT_INDEX_FILE)