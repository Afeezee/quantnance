import asyncio
import time
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services import stocks, news, bayse, ai_analysis

router = APIRouter()
log = logging.getLogger(__name__)

# Brief-level cache: symbol -> {data, ts}
_brief_cache: dict[str, dict] = {}
_BRIEF_TTL = 1800  # 30 minutes


def _get_cached_brief(symbol: str):
    entry = _brief_cache.get(symbol.upper())
    if entry and (time.time() - entry["ts"]) < _BRIEF_TTL:
        return entry["data"]
    return None


def _set_cached_brief(symbol: str, data: dict):
    _brief_cache[symbol.upper()] = {"data": data, "ts": time.time()}


class ChatRequest(BaseModel):
    symbol: str
    brief_context: dict
    conversation_history: list = []
    user_message: str


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    try:
        results = await stocks.search_ticker(q)
        return results
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search failed: {str(e)}")


@router.get("/analyze")
async def analyze(
    prompt: str = Query(..., min_length=1),
    refresh: bool = Query(default=False),
):
    """
    Accept a natural-language investment prompt, resolve it to a stock symbol
    via Yahoo Finance, and generate a full analysis brief.
    """
    # 1. Search for the stock
    search_results = await stocks.search_ticker(prompt)
    if not search_results:
        raise HTTPException(
            status_code=404,
            detail=f"Could not find a stock matching \"{prompt}\". Try a ticker symbol like AAPL or a company name like Apple.",
        )

    # Pick the top match
    match = search_results[0]
    symbol = match["symbol"]
    match_name = match.get("name", symbol)

    # 2. Serve cached brief if available
    if not refresh:
        cached = _get_cached_brief(symbol)
        if cached:
            # Re-inject the user_prompt so the AI verdict feels contextual
            cached["user_prompt"] = prompt
            cached["resolved_match"] = match
            return cached

    # 3. Fetch all data in parallel
    quote_data = None
    overview_data = None
    price_history_data = None
    news_articles = None
    bayse_events_raw = None

    try:
        results = await asyncio.gather(
            stocks.get_quote(symbol),
            stocks.get_company_overview(symbol),
            stocks.get_price_history(symbol),
            news.get_financial_news(f"{match_name} stock"),
            bayse.get_events(keyword=symbol),
            return_exceptions=True,
        )

        quote_data = results[0] if not isinstance(results[0], Exception) else None
        overview_data = results[1] if not isinstance(results[1], Exception) else None
        price_history_data = results[2] if not isinstance(results[2], Exception) else None
        news_articles = results[3] if not isinstance(results[3], Exception) else None
        bayse_events_raw = results[4] if not isinstance(results[4], Exception) else None
    except Exception:
        pass

    company_name = (overview_data or {}).get("name", "") or match_name

    volatility = 0.0
    if price_history_data:
        try:
            volatility = stocks.calculate_volatility(price_history_data)
        except Exception:
            pass

    bayse_events_list = []
    if isinstance(bayse_events_raw, dict):
        bayse_events_list = bayse_events_raw.get("events", bayse_events_raw.get("data", []))
        if not isinstance(bayse_events_list, list):
            bayse_events_list = []
    elif isinstance(bayse_events_raw, list):
        bayse_events_list = bayse_events_raw

    bayse_sentiment = bayse.extract_crowd_sentiment(bayse_events_list)

    headlines_for_ai = [a for a in news_articles if a.get("title")] if news_articles else []

    sentiment_result = None
    try:
        sentiment_result = await ai_analysis.analyse_news_sentiment(
            symbol, company_name, headlines_for_ai
        )
    except Exception as exc:
        log.error("Sentiment analysis failed for %s: %s", symbol, exc)
        sentiment_result = None

    brief_result = None
    try:
        brief_result = await ai_analysis.generate_investment_brief(
            {
                "symbol": symbol,
                "company_name": company_name,
                "company_overview": overview_data,
                "quote": quote_data,
                "sentiment_result": sentiment_result,
                "bayse_markets": bayse_sentiment,
                "price_history": price_history_data,
                "volatility": volatility,
                "news_articles": news_articles,
                "user_prompt": prompt,
            }
        )
        log.info("Brief generated for %s", symbol)
    except Exception as exc:
        log.error("Brief generation failed for %s: %s", symbol, exc, exc_info=True)
        brief_result = None

    result = {
        "symbol": symbol,
        "exchange": match.get("region", ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_prompt": prompt,
        "resolved_match": match,
        "quote": quote_data,
        "company_overview": overview_data,
        "price_history": price_history_data,
        "volatility": volatility,
        "news": news_articles,
        "bayse_markets": bayse_events_list,
        "bayse_sentiment": bayse_sentiment,
        "sentiment": sentiment_result,
        "brief": brief_result,
    }
    _set_cached_brief(symbol, result)
    return result


@router.get("/brief")
async def get_brief(
    symbol: str = Query(..., min_length=1),
    exchange: str = Query(default=""),
    refresh: bool = Query(default=False),
):
    # Serve from cache unless refresh=true
    if not refresh:
        cached = _get_cached_brief(symbol)
        if cached:
            return cached
    quote_data = None
    overview_data = None
    price_history_data = None
    news_articles = None
    bayse_events_raw = None

    try:
        results = await asyncio.gather(
            stocks.get_quote(symbol),
            stocks.get_company_overview(symbol),
            stocks.get_price_history(symbol),
            news.get_financial_news(f"{symbol} stock"),
            bayse.get_events(keyword=symbol),
            return_exceptions=True,
        )

        quote_data = results[0] if not isinstance(results[0], Exception) else None
        overview_data = results[1] if not isinstance(results[1], Exception) else None
        price_history_data = results[2] if not isinstance(results[2], Exception) else None
        news_articles = results[3] if not isinstance(results[3], Exception) else None
        bayse_events_raw = results[4] if not isinstance(results[4], Exception) else None
    except Exception:
        pass

    company_name = (overview_data or {}).get("name", symbol)

    volatility = 0.0
    if price_history_data:
        try:
            volatility = stocks.calculate_volatility(price_history_data)
        except Exception:
            pass

    bayse_events_list = []
    if isinstance(bayse_events_raw, dict):
        bayse_events_list = bayse_events_raw.get("events", bayse_events_raw.get("data", []))
        if not isinstance(bayse_events_list, list):
            bayse_events_list = []
    elif isinstance(bayse_events_raw, list):
        bayse_events_list = bayse_events_raw

    bayse_sentiment = bayse.extract_crowd_sentiment(bayse_events_list)

    # Pass full article dicts (ai_analysis uses .get('title', '') on each)
    headlines_for_ai = [a for a in news_articles if a.get("title")] if news_articles else []

    sentiment_result = None
    try:
        sentiment_result = await ai_analysis.analyse_news_sentiment(
            symbol, company_name, headlines_for_ai
        )
    except Exception:
        sentiment_result = None

    brief_result = None
    try:
        brief_result = await ai_analysis.generate_investment_brief(
            {
                "symbol": symbol,
                "company_name": company_name,
                "company_overview": overview_data,
                "quote": quote_data,
                "sentiment_result": sentiment_result,
                "bayse_markets": bayse_sentiment,
                "price_history": price_history_data,
                "volatility": volatility,
                "news_articles": news_articles,
            }
        )
    except Exception:
        brief_result = None

    result = {
        "symbol": symbol,
        "exchange": exchange,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "quote": quote_data,
        "company_overview": overview_data,
        "price_history": price_history_data,
        "volatility": volatility,
        "news": news_articles,
        "bayse_markets": bayse_events_list,
        "bayse_sentiment": bayse_sentiment,
        "sentiment": sentiment_result,
        "brief": brief_result,
    }
    _set_cached_brief(symbol, result)
    return result


@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        response = await ai_analysis.answer_question(
            symbol=req.symbol,
            brief_context=req.brief_context,
            conversation_history=req.conversation_history,
            user_question=req.user_message,
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")
