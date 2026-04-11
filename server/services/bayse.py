import os
import time
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

BAYSE_BASE_URL = "https://relay.bayse.markets"
BAYSE_PUBLIC_KEY = os.getenv("BAYSE_PUBLIC_KEY", "")

_cache: dict[str, dict] = {}

# ── Crypto symbols map: symbol → search keywords for Bayse ──
_CRYPTO_MAP: dict[str, list[str]] = {
    "BTC": ["Bitcoin", "BTC"], "ETH": ["Ethereum", "ETH"],
    "SOL": ["Solana", "SOL"], "BNB": ["BNB", "Binance"],
    "XRP": ["XRP", "Ripple"], "ADA": ["Cardano", "ADA"],
    "DOGE": ["Dogecoin", "DOGE"], "DOT": ["Polkadot", "DOT"],
    "AVAX": ["Avalanche", "AVAX"], "MATIC": ["Polygon", "MATIC"],
    "LINK": ["Chainlink", "LINK"], "SHIB": ["Shiba", "SHIB"],
    "LTC": ["Litecoin", "LTC"], "UNI": ["Uniswap", "UNI"],
    "ATOM": ["Cosmos", "ATOM"], "ARB": ["Arbitrum", "ARB"],
    "OP": ["Optimism", "OP"],
}

# ── Stock sector → Bayse keyword search strategies ──
# Each entry is a list of keywords to try in order
_SECTOR_KEYWORDS: dict[str, list[str]] = {
    "technology": ["technology", "tech", "AI"],
    "financial services": ["finance", "bank", "economy"],
    "healthcare": ["health", "pharma"],
    "energy": ["oil", "energy", "crude"],
    "consumer cyclical": ["consumer", "retail"],
    "consumer defensive": ["consumer", "food"],
    "communication services": ["media", "social media"],
    "industrials": ["industry", "manufacturing"],
    "basic materials": ["commodities", "gold"],
    "real estate": ["real estate", "property"],
    "utilities": ["energy", "utilities"],
}


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
        "event_slug": best.get("slug", ""),
        "event_id": best.get("id", ""),
        "category": best.get("category", ""),
        "closing_date": best.get("closingDate", ""),
        "status": best.get("status", ""),
        "outcome1_label": o1.get("label", "Yes"),
        "outcome1_price": round(o1_price * 100, 1),
        "outcome2_label": o2.get("label", "No"),
        "outcome2_price": round(o2_price * 100, 1),
        "crowd_confidence": confidence,
    }


def _extract_events_list(raw) -> list:
    """Normalize API response into a flat list of events."""
    if isinstance(raw, dict):
        evts = raw.get("events", raw.get("data", []))
        return evts if isinstance(evts, list) else []
    if isinstance(raw, list):
        return raw
    return []


async def get_smart_events(
    symbol: str, company_name: str = "", sector: str = ""
) -> list:
    """
    Intelligent Bayse event search.
    Strategy:
      1. If crypto asset → search by coin name, then "crypto"
      2. Try exact symbol keyword
      3. Try company name
      4. Try sector-mapped keywords
      5. Return best results found or empty list
    """
    sym_upper = symbol.upper().replace("-USD", "").replace("=X", "")

    # ── Crypto path ──
    if sym_upper in _CRYPTO_MAP:
        for kw in _CRYPTO_MAP[sym_upper]:
            try:
                raw = await get_events(keyword=kw)
                evts = _extract_events_list(raw)
                if evts:
                    logger.info("Bayse: crypto match for %s via keyword '%s' (%d events)", symbol, kw, len(evts))
                    return evts
            except Exception:
                pass
        # Fallback: generic crypto
        try:
            raw = await get_events(keyword="crypto")
            evts = _extract_events_list(raw)
            if evts:
                return evts
        except Exception:
            pass
        return []

    # ── Stock path ──
    # 1. Try exact symbol
    try:
        raw = await get_events(keyword=sym_upper)
        evts = _extract_events_list(raw)
        if evts:
            logger.info("Bayse: exact symbol match for %s (%d events)", symbol, len(evts))
            return evts
    except Exception:
        pass

    # 2. Try company name (first word to avoid overly specific queries)
    if company_name:
        short_name = company_name.split(",")[0].split(" Inc")[0].split(" Corp")[0].strip()
        if short_name and short_name.upper() != sym_upper:
            try:
                raw = await get_events(keyword=short_name)
                evts = _extract_events_list(raw)
                if evts:
                    logger.info("Bayse: company name match for '%s' (%d events)", short_name, len(evts))
                    return evts
            except Exception:
                pass

    # 3. Try sector-mapped keywords
    sector_lower = (sector or "").lower().strip()
    keywords = _SECTOR_KEYWORDS.get(sector_lower, [])
    for kw in keywords:
        try:
            raw = await get_events(keyword=kw)
            evts = _extract_events_list(raw)
            if evts:
                logger.info("Bayse: sector keyword match for '%s' via '%s' (%d events)", sector, kw, len(evts))
                return evts
        except Exception:
            pass

    # 4. Final fallback — trending/general markets
    try:
        raw = await get_events(keyword="stock")
        evts = _extract_events_list(raw)
        if evts:
            return evts
    except Exception:
        pass

    return []
