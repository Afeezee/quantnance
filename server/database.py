import importlib
import logging
import os
from pathlib import Path
from typing import AsyncIterator
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def _default_sqlite_url() -> str:
    db_path = Path(__file__).resolve().parent / "quantnance.db"
    return f"sqlite+aiosqlite:///{db_path.as_posix()}"


_ASYNCPG_INCOMPATIBLE_PARAMS = {
    # psycopg2-style flags that asyncpg does not accept as kwargs.
    "sslmode",
    "channel_binding",
    "gssencmode",
    "target_session_attrs",
}


def _split_asyncpg_url(value: str) -> tuple[str, dict]:
    """
    Pop asyncpg-incompatible query params out of the URL and return them as
    SQLAlchemy connect_args. Neon's dashboards hand out URLs with
    `?sslmode=require` which asyncpg rejects — translate that to `ssl=True`.
    """
    parts = urlsplit(value)
    kept: list[tuple[str, str]] = []
    connect_args: dict = {}
    for key, val in parse_qsl(parts.query, keep_blank_values=True):
        if key in _ASYNCPG_INCOMPATIBLE_PARAMS:
            if key == "sslmode" and val.lower() in {"require", "verify-ca", "verify-full"}:
                connect_args["ssl"] = True
            continue
        kept.append((key, val))
    new_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))
    return new_url, connect_args


def normalize_database_url(raw_url: str | None) -> tuple[str, dict]:
    value = (raw_url or "").strip()
    if not value:
        return _default_sqlite_url(), {}
    if value.startswith("postgresql://"):
        value = value.replace("postgresql://", "postgresql+asyncpg://", 1)
    if value.startswith("sqlite:///"):
        return value.replace("sqlite:///", "sqlite+aiosqlite:///", 1), {}
    if "+asyncpg://" in value:
        url, connect_args = _split_asyncpg_url(value)
        # On Vercel each warm instance may hit Neon's pooler (PgBouncer in
        # transaction mode), which does not retain prepared statements across
        # requests — disable asyncpg's prepared statement cache.
        connect_args.setdefault("statement_cache_size", 0)
        return url, connect_args
    return value, {}


DATABASE_URL, _CONNECT_ARGS = normalize_database_url(os.getenv("DATABASE_URL"))

# Serverless: don't hold onto DB connections across invocations — the next
# cold start can't reuse them anyway. NullPool opens a fresh asyncpg
# connection per checkout and lets Neon's pooler handle multiplexing.
_IS_SERVERLESS = bool(os.getenv("VERCEL") or os.getenv("K_SERVICE"))
_engine_kwargs: dict = {"future": True, "pool_pre_ping": True, "connect_args": _CONNECT_ARGS}
if _IS_SERVERLESS and DATABASE_URL.startswith("postgresql+asyncpg://"):
    _engine_kwargs["poolclass"] = NullPool
    _engine_kwargs.pop("pool_pre_ping", None)

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def _load_models() -> None:
    models_dir = Path(__file__).resolve().parent / "models"
    if not models_dir.exists():
        return

    for module_path in sorted(models_dir.glob("*.py")):
        if module_path.stem == "__init__":
            continue
        importlib.import_module(f"models.{module_path.stem}")


async def init_database() -> None:
    _load_models()
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        log.info("Database initialized using %s", DATABASE_URL.split("://", 1)[0])
    except Exception as exc:
        # Don't crash the whole function on a DB blip — history endpoints will
        # surface the real error at request time, everything else keeps serving.
        log.error("Database init failed (%s): %s", DATABASE_URL.split("://", 1)[0], exc)


async def close_database() -> None:
    await engine.dispose()