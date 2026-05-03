import importlib
import logging
import os
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def _default_sqlite_url() -> str:
    db_path = Path(__file__).resolve().parent / "quantnance.db"
    return f"sqlite+aiosqlite:///{db_path.as_posix()}"


def normalize_database_url(raw_url: str | None) -> str:
    value = (raw_url or "").strip()
    if not value:
        return _default_sqlite_url()
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+asyncpg://", 1)
    if value.startswith("sqlite:///"):
        return value.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    return value


DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL"))

engine = create_async_engine(
    DATABASE_URL,
    future=True,
    pool_pre_ping=True,
)

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
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    log.info("Database initialized using %s", DATABASE_URL.split("://", 1)[0])


async def close_database() -> None:
    await engine.dispose()