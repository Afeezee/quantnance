import os
import time
import httpx
from typing import Optional

NEWS_BASE_URL = "https://newsapi.org/v2"

_cache: dict[str, dict] = {}


def _cache_get(key: str, ttl: int) -> Optional[list]:
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < ttl:
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}


async def get_financial_news(query: str, page_size: int = 8) -> list:
    cache_key = f"news:{query}:{page_size}"
    cached = _cache_get(cache_key, 1800)
    if cached is not None:
        return cached

    api_key = os.getenv("NEWS_API_KEY", "")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{NEWS_BASE_URL}/everything",
            params={
                "q": query,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": page_size,
                "apiKey": api_key,
            },
        )
        resp.raise_for_status()
        raw = resp.json()

    articles = raw.get("articles", [])
    results = []
    for a in articles:
        title = a.get("title")
        description = a.get("description")
        if not title or title == "[Removed]":
            continue
        if description and description == "[Removed]":
            description = None
        results.append(
            {
                "title": title,
                "source_name": (a.get("source") or {}).get("name", ""),
                "published_at": a.get("publishedAt", ""),
                "url": a.get("url", ""),
                "description": description,
                "url_to_image": a.get("urlToImage"),
            }
        )

    _cache_set(cache_key, results)
    return results
