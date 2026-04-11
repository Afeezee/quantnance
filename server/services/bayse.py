import os
import time
import httpx
from typing import Optional

BAYSE_BASE_URL = "https://relay.bayse.markets"
BAYSE_PUBLIC_KEY = os.getenv("BAYSE_PUBLIC_KEY", "")

_cache: dict[str, dict] = {}


def _cache_get(key: str, ttl: int) -> Optional[dict]:
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < ttl:
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}


def _headers() -> dict:
    return {"X-Public-Key": BAYSE_PUBLIC_KEY or os.getenv("BAYSE_PUBLIC_KEY", "")}


async def get_events(
    keyword: str, category: str | None = None, status: str = "open"
) -> dict:
    cache_key = f"bayse_events:{keyword}:{category}:{status}"
    cached = _cache_get(cache_key, 60)
    if cached is not None:
        return cached

    params: dict = {"keyword": keyword, "status": status, "limit": 10}
    if category:
        params["category"] = category

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BAYSE_BASE_URL}/v1/pm/events", headers=_headers(), params=params
        )
        resp.raise_for_status()
        data = resp.json()

    _cache_set(cache_key, data)
    return data


async def get_price_history(event_id: str, interval: str = "1h") -> dict:
    cache_key = f"bayse_price_history:{event_id}:{interval}"
    cached = _cache_get(cache_key, 300)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BAYSE_BASE_URL}/v1/pm/events/{event_id}/price-history",
            headers=_headers(),
            params={"interval": interval},
        )
        resp.raise_for_status()
        data = resp.json()

    _cache_set(cache_key, data)
    return data


async def get_market_ticker(market_id: str) -> dict:
    cache_key = f"bayse_ticker:{market_id}"
    cached = _cache_get(cache_key, 60)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BAYSE_BASE_URL}/v1/pm/markets/{market_id}/ticker",
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()

    _cache_set(cache_key, data)
    return data


def extract_crowd_sentiment(events: list) -> dict:
    if not events:
        return {
            "available": False,
            "message": "No active Bayse prediction markets found for this asset.",
        }

    best = events[0]
    markets = best.get("markets", [])
    if not markets:
        return {
            "available": False,
            "message": "No active Bayse prediction markets found for this asset.",
        }

    market = markets[0]
    outcomes = market.get("outcomes", [])
    o1 = outcomes[0] if len(outcomes) > 0 else {}
    o2 = outcomes[1] if len(outcomes) > 1 else {}

    o1_price = float(o1.get("price", 0.5))
    o2_price = float(o2.get("price", 0.5))

    confidence = "High" if abs(o1_price - 0.5) > 0.2 else "Low"

    return {
        "available": True,
        "event_title": best.get("title", ""),
        "category": best.get("category", ""),
        "closing_date": best.get("closingDate", ""),
        "status": best.get("status", ""),
        "outcome1_label": o1.get("label", "Yes"),
        "outcome1_price": round(o1_price * 100, 1),
        "outcome2_label": o2.get("label", "No"),
        "outcome2_price": round(o2_price * 100, 1),
        "crowd_confidence": confidence,
    }
