from datetime import datetime, timezone

from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.history import SearchHistory

MAX_HISTORY_PAGE_SIZE = 100


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _require_prompt(prompt: str) -> str:
    cleaned = prompt.strip()
    if not cleaned:
        raise ValueError("Prompt is required")
    return cleaned


def _timestamp_to_datetime(timestamp_ms: int | None) -> datetime:
    if timestamp_ms is None:
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)


def serialize_history_entry(entry: SearchHistory) -> dict:
    return {
        "id": entry.id,
        "prompt": entry.prompt,
        "display_prompt": entry.display_prompt,
        "mode": entry.mode,
        "timestamp": int(entry.created_at.timestamp() * 1000),
    }


async def _get_latest_entry(session: AsyncSession, user_id: str) -> SearchHistory | None:
    stmt = (
        select(SearchHistory)
        .where(SearchHistory.user_id == user_id)
        .order_by(desc(SearchHistory.created_at))
        .limit(1)
    )
    return await session.scalar(stmt)


def _same_entry_label(entry: SearchHistory, prompt: str, display_prompt: str | None, mode: str) -> bool:
    previous_label = (entry.display_prompt or entry.prompt).strip().lower()
    current_label = (display_prompt or prompt).strip().lower()
    return entry.mode == mode and previous_label == current_label


async def list_history_entries(
    session: AsyncSession,
    *,
    user_id: str,
    limit: int,
    offset: int,
) -> tuple[list[SearchHistory], bool]:
    page_size = max(1, min(limit, MAX_HISTORY_PAGE_SIZE))
    stmt = (
        select(SearchHistory)
        .where(SearchHistory.user_id == user_id)
        .order_by(desc(SearchHistory.created_at))
        .offset(offset)
        .limit(page_size + 1)
    )
    rows = list((await session.scalars(stmt)).all())
    has_more = len(rows) > page_size
    return rows[:page_size], has_more


async def create_history_entry(
    session: AsyncSession,
    *,
    user_id: str,
    prompt: str,
    mode: str,
    display_prompt: str | None = None,
    timestamp_ms: int | None = None,
) -> tuple[SearchHistory, bool]:
    normalized_prompt = _require_prompt(prompt)
    normalized_display_prompt = _normalize_text(display_prompt)

    latest = await _get_latest_entry(session, user_id)
    if latest is not None and _same_entry_label(latest, normalized_prompt, normalized_display_prompt, mode):
        return latest, False

    entry = SearchHistory(
        user_id=user_id,
        prompt=normalized_prompt,
        display_prompt=normalized_display_prompt,
        mode=mode,
        created_at=_timestamp_to_datetime(timestamp_ms),
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry, True


async def import_history_entries(
    session: AsyncSession,
    *,
    user_id: str,
    entries: list[dict],
) -> int:
    imported_count = 0
    seen_keys: set[tuple[str, str | None, str, int]] = set()

    for payload in sorted(entries, key=lambda item: item.get("timestamp") or 0):
        prompt = _require_prompt(payload["prompt"])
        display_prompt = _normalize_text(payload.get("display_prompt"))
        mode = payload["mode"]
        timestamp_ms = payload.get("timestamp")
        timestamp = _timestamp_to_datetime(timestamp_ms)
        entry_key = (prompt, display_prompt, mode, int(timestamp.timestamp() * 1000))

        if entry_key in seen_keys:
            continue
        seen_keys.add(entry_key)

        existing_stmt = select(SearchHistory.id).where(
            SearchHistory.user_id == user_id,
            SearchHistory.prompt == prompt,
            SearchHistory.display_prompt == display_prompt,
            SearchHistory.mode == mode,
            SearchHistory.created_at == timestamp,
        )
        existing = await session.scalar(existing_stmt)
        if existing is not None:
            continue

        session.add(
            SearchHistory(
                user_id=user_id,
                prompt=prompt,
                display_prompt=display_prompt,
                mode=mode,
                created_at=timestamp,
            )
        )
        imported_count += 1

    if imported_count > 0:
        await session.commit()

    return imported_count


async def delete_history_entry(session: AsyncSession, *, user_id: str, entry_id: str) -> bool:
    stmt = delete(SearchHistory).where(
        SearchHistory.id == entry_id,
        SearchHistory.user_id == user_id,
    )
    result = await session.execute(stmt)
    if result.rowcount == 0:
        await session.rollback()
        return False
    await session.commit()
    return True