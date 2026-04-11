import re
import json
import time
import math
import asyncio
import logging
import pathlib
import httpx
from datetime import datetime
from datetime import timezone as tz

YF_QUERY1 = "https://query1.finance.yahoo.com"
YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

_cache: dict[str, dict] = {}

CACHE_DIR = pathlib.Path(__file__).resolve().parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def _cache_get(key: str, ttl: int):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < ttl:
        return entry["data"]
    safe_key = key.replace(":", "_").replace("/", "_")
    file_path = CACHE_DIR / f"{safe_key}.json"
    if file_path.exists():
        try:
            raw = json.loads(file_path.read_text(encoding="utf-8"))
            if (time.time() - raw.get("ts", 0)) < ttl:
                _cache[key] = {"data": raw["data"], "ts": raw["ts"]}
                return raw["data"]
        except Exception:
            pass
    return None


def _cache_set(key: str, data):
    ts = time.time()
    _cache[key] = {"data": data, "ts": ts}
    safe_key = key.replace(":", "_").replace("/", "_")
    file_path = CACHE_DIR / f"{safe_key}.json"
    try:
        file_path.write_text(
            json.dumps({"data": data, "ts": ts}, default=str), encoding="utf-8"
        )
    except Exception:
        pass


def _safe_float(val, default=0.0) -> float:
    if val is None:
        return default
    try:
        v = str(val).replace("%", "").replace(",", "").strip()
        if v in ("None", "-", "N/A", ""):
            return default
        return float(v)
    except (ValueError, TypeError):
        return default


async def search_ticker(query: str) -> list:
    """
    Resolve a natural-language prompt or ticker to Yahoo Finance search results.
    Uses AI to extract the stock symbol/company name from the prompt first.
    """
    from services import ai_analysis

    stripped = query.strip()
    # Short queries (1-2 words) are likely already a ticker/company — skip AI
    if len(stripped.split()) <= 2:
        search_term = stripped
    else:
        search_term = await ai_analysis.extract_stock_symbol(stripped)

    cache_key = f"search:{search_term.lower()}"
    cached = _cache_get(cache_key, 3600)
    if cached is not None and len(cached) > 0:
        return cached
    results = await _search_yahoo_finance(search_term)
    # Only cache non-empty results so transient failures don't stick
    if results:
        _cache_set(cache_key, results)
    return results


async def _search_yahoo_finance(keyword: str) -> list:
    log = logging.getLogger(__name__)
    try:
        async with httpx.AsyncClient(timeout=10, headers=YF_HEADERS) as client:
            resp = await client.get(
                f"{YF_QUERY1}/v1/finance/search",
                params={
                    "q": keyword,
                    "quotesCount": "10",
                    "newsCount": "0",
                    "listsCount": "0",
                    "enableFuzzyQuery": "true",
                },
            )
            log.info("YF search [%s] -> status %s", keyword, resp.status_code)
            resp.raise_for_status()
            data = resp.json()
        quotes = data.get("quotes", [])
        allowed_types = {"EQUITY", "ETF", "CRYPTOCURRENCY", "MUTUALFUND", "INDEX", "FUTURE"}
        return [
            {
                "symbol": q.get("symbol", ""),
                "name": q.get("longname") or q.get("shortname", ""),
                "type": q.get("quoteType", ""),
                "region": q.get("exchDisp", ""),
                "currency": q.get("currency", ""),
                "matchScore": "1.0000",
                "source": "yahoo",
            }
            for q in quotes
            if q.get("symbol") and q.get("quoteType") in allowed_types
        ]
    except Exception as exc:
        logging.getLogger(__name__).warning("Yahoo search failed: %s", exc)
        return []


async def get_quote(symbol: str) -> dict:
    cache_key = f"quote:{symbol.upper()}"
    cached = _cache_get(cache_key, 60)
    if cached is not None:
        return cached
    result = await _get_quote_yahoo(symbol)
    if result:
        _cache_set(cache_key, result)
    return result or {}


async def _get_quote_yahoo(symbol: str) -> dict | None:
    import logging
    try:
        async with httpx.AsyncClient(timeout=12, headers=YF_HEADERS) as client:
            resp = await client.get(
                f"{YF_QUERY1}/v8/finance/chart/{symbol}",
                params={"interval": "1d", "range": "1d"},
            )
            resp.raise_for_status()
            raw = resp.json()
        result_list = raw.get("chart", {}).get("result")
        if not result_list:
            return None
        meta = result_list[0].get("meta", {})
        price = _safe_float(meta.get("regularMarketPrice"))
        if not price:
            return None
        prev_close = _safe_float(
            meta.get("previousClose") or meta.get("chartPreviousClose")
        )
        change = round(price - prev_close, 4) if prev_close else 0.0
        change_pct = round((change / prev_close) * 100, 4) if prev_close else 0.0
        market_ts = meta.get("regularMarketTime")
        latest_day = (
            datetime.fromtimestamp(market_ts, tz=tz.utc).strftime("%Y-%m-%d")
            if market_ts else ""
        )
        return {
            "symbol": meta.get("symbol", symbol).upper(),
            "price": price,
            "change": change,
            "change_percent": change_pct,
            "volume": _safe_float(meta.get("regularMarketVolume")),
            "latest_trading_day": latest_day,
            "previous_close": prev_close,
            "open": _safe_float(meta.get("regularMarketOpen")),
            "high": _safe_float(meta.get("regularMarketDayHigh")),
            "low": _safe_float(meta.get("regularMarketDayLow")),
            "currency": meta.get("currency", ""),
            "exchange": meta.get("fullExchangeName", ""),
            "source": "yahoo",
        }
    except Exception as exc:
        logging.getLogger(__name__).warning("YF quote failed [%s]: %s", symbol, exc)
        return None


async def get_company_overview(symbol: str) -> dict:
    log = logging.getLogger(__name__)
    cache_key = f"overview:{symbol.upper()}"
    cached = _cache_get(cache_key, 86400)
    if cached is not None:
        log.info("Overview cache HIT for %s", symbol)
        return cached
    log.info("Overview cache MISS for %s — fetching", symbol)
    result = await _get_overview_yahoo(symbol)
    if result:
        _cache_set(cache_key, result)
    return result or {}


async def _get_overview_yahoo(symbol: str) -> dict | None:
    """
    Fetch company overview from Yahoo Finance.
    Primary: chart meta (always works, has 52W, name, exchange).
    Secondary: quoteSummary with crumb/cookie auth (has P/E, EPS, market cap).
    """
    log = logging.getLogger(__name__)
    overview: dict = {}

    # --- Primary: chart meta (reliable, no auth needed) ---
    try:
        async with httpx.AsyncClient(timeout=12, headers=YF_HEADERS) as client:
            resp = await client.get(
                f"{YF_QUERY1}/v8/finance/chart/{symbol}",
                params={"interval": "1d", "range": "5d"},
            )
            resp.raise_for_status()
            meta = resp.json().get("chart", {}).get("result", [{}])[0].get("meta", {})

        name = meta.get("longName") or meta.get("shortName", "")
        if not name:
            return None

        overview = {
            "name": name,
            "description": "",
            "exchange": meta.get("fullExchangeName", ""),
            "currency": meta.get("currency", ""),
            "country": "",
            "sector": "",
            "industry": "",
            "market_cap": 0,
            "pe_ratio": 0,
            "eps": 0,
            "dividend_yield": 0,
            "52_week_high": _safe_float(meta.get("fiftyTwoWeekHigh")),
            "52_week_low": _safe_float(meta.get("fiftyTwoWeekLow")),
            "50_day_ma": 0,
            "200_day_ma": 0,
            "revenue_growth": 0,
            "profit_margin": 0,
            "beta": 0,
            "source": "yahoo",
        }
    except Exception as exc:
        log.warning("YF chart-meta failed [%s]: %s", symbol, exc)
        return None

    # --- Secondary: quoteSummary via crumb/cookie auth ---
    try:
        browser_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        def _fetch_with_crumb():
            with httpx.Client(headers=browser_headers, follow_redirects=True, timeout=15) as client:
                # Get cookies from Yahoo Finance
                page_resp = client.get(f"https://finance.yahoo.com/quote/{symbol}/")
                # Get crumb using those cookies
                crumb_resp = client.get("https://query2.finance.yahoo.com/v1/test/getcrumb")
                if crumb_resp.status_code != 200 or not crumb_resp.text.strip():
                    return None
                crumb = crumb_resp.text.strip()
                # Fetch quoteSummary with crumb
                modules = "assetProfile,defaultKeyStatistics,summaryDetail,price,financialData"
                resp = client.get(
                    f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}",
                    params={"modules": modules, "crumb": crumb},
                )
                log.info("YF quoteSummary: %s for %s", resp.status_code, symbol)
                if resp.status_code != 200:
                    return None
                return resp.json()

        raw = await asyncio.to_thread(_fetch_with_crumb)
        if raw:
            res = raw.get("quoteSummary", {}).get("result")
            if res:
                data = res[0]
                profile = data.get("assetProfile", {})
                stats = data.get("defaultKeyStatistics", {})
                summary = data.get("summaryDetail", {})
                price_m = data.get("price", {})
                fin = data.get("financialData", {})

                def _rv(obj, key):
                    v = obj.get(key)
                    if isinstance(v, dict):
                        return v.get("raw", v.get("fmt", 0))
                    return v

                overview["description"] = profile.get("longBusinessSummary", "") or overview["description"]
                overview["country"] = profile.get("country", "") or overview["country"]
                overview["sector"] = profile.get("sector", "") or overview["sector"]
                overview["industry"] = profile.get("industry", "") or overview["industry"]
                overview["market_cap"] = _safe_float(_rv(price_m, "marketCap")) or overview["market_cap"]
                overview["pe_ratio"] = _safe_float(_rv(summary, "trailingPE")) or overview["pe_ratio"]
                overview["eps"] = _safe_float(_rv(stats, "trailingEps")) or overview["eps"]
                overview["dividend_yield"] = _safe_float(_rv(summary, "dividendYield")) or overview["dividend_yield"]
                overview["52_week_high"] = _safe_float(_rv(summary, "fiftyTwoWeekHigh")) or overview["52_week_high"]
                overview["52_week_low"] = _safe_float(_rv(summary, "fiftyTwoWeekLow")) or overview["52_week_low"]
                overview["50_day_ma"] = _safe_float(_rv(summary, "fiftyDayAverage")) or overview["50_day_ma"]
                overview["200_day_ma"] = _safe_float(_rv(summary, "twoHundredDayAverage")) or overview["200_day_ma"]
                overview["revenue_growth"] = _safe_float(_rv(fin, "revenueGrowth")) or overview["revenue_growth"]
                overview["profit_margin"] = _safe_float(_rv(fin, "profitMargins")) or overview["profit_margin"]
                overview["beta"] = _safe_float(_rv(summary, "beta")) or overview["beta"]
                log.info("YF overview enriched with quoteSummary for %s", symbol)
    except Exception as exc:
        log.info("YF quoteSummary unavailable for %s: %s", symbol, exc)

    return overview


async def get_price_history(symbol: str, interval: str = "daily") -> list:
    cache_key = f"history:{symbol.upper()}:{interval}"
    cached = _cache_get(cache_key, 3600)
    if cached is not None:
        return cached
    result = await _get_history_yahoo(symbol, interval)
    if result:
        _cache_set(cache_key, result)
    return result or []


async def _get_history_yahoo(symbol: str, interval: str = "daily") -> list | None:
    import logging
    yf_interval = "1wk" if interval == "weekly" else "1d"
    yf_range = "1y" if interval == "weekly" else "6mo"
    try:
        async with httpx.AsyncClient(timeout=15, headers=YF_HEADERS) as client:
            resp = await client.get(
                f"{YF_QUERY1}/v8/finance/chart/{symbol}",
                params={"interval": yf_interval, "range": yf_range},
            )
            resp.raise_for_status()
            raw = resp.json()
        result_list = raw.get("chart", {}).get("result")
        if not result_list:
            return None
        chart = result_list[0]
        timestamps = chart.get("timestamp") or []
        quote_data = chart.get("indicators", {}).get("quote") or []
        quotes = quote_data[0] if quote_data else {}
        opens = quotes.get("open") or []
        highs = quotes.get("high") or []
        lows = quotes.get("low") or []
        closes = quotes.get("close") or []
        volumes = quotes.get("volume") or []
        if not timestamps or not closes:
            return None
        rows = []
        for i, ts_val in enumerate(timestamps):
            close = closes[i] if i < len(closes) else None
            if close is None:
                continue
            rows.append({
                "date": datetime.fromtimestamp(ts_val, tz=tz.utc).strftime("%Y-%m-%d"),
                "open": _safe_float(opens[i] if i < len(opens) else None),
                "high": _safe_float(highs[i] if i < len(highs) else None),
                "low": _safe_float(lows[i] if i < len(lows) else None),
                "close": _safe_float(close),
                "volume": _safe_float(volumes[i] if i < len(volumes) else None),
            })
        return rows[-90:] if rows else None
    except Exception as exc:
        logging.getLogger(__name__).warning("YF history failed [%s]: %s", symbol, exc)
        return None


def calculate_volatility(price_history: list) -> float:
    if not price_history or len(price_history) < 2:
        return 0.0

    closes = [p["close"] for p in price_history if p.get("close")]
    if len(closes) < 2:
        return 0.0

    returns = []
    for i in range(1, len(closes)):
        if closes[i - 1] != 0:
            returns.append((closes[i] - closes[i - 1]) / closes[i - 1])

    window = returns[-30:] if len(returns) >= 30 else returns
    if not window:
        return 0.0

    mean = sum(window) / len(window)
    variance = sum((r - mean) ** 2 for r in window) / len(window)
    return round(math.sqrt(variance), 4)
