import os
import re
import json
import logging
import asyncio
import httpx

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"

# Persistent httpx client for connection pooling (reduces latency)
_http_client: httpx.Client | None = None


def _get_http_client() -> httpx.Client:
    global _http_client
    if _http_client is None:
        _http_client = httpx.Client(timeout=30, limits=httpx.Limits(max_connections=10))
    return _http_client


def _get_api_key() -> str:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_key_here":
        raise RuntimeError("GROQ_API_KEY is not configured in server/.env")
    return api_key


class GroqCallError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _extract_groq_error_message(resp: httpx.Response) -> str:
    try:
        payload = resp.json()
        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict) and error.get("message"):
                return str(error["message"])
    except Exception:
        pass
    return resp.text[:500].strip() or f"HTTP {resp.status_code} {resp.reason_phrase}"


async def extract_stock_symbol(user_prompt: str) -> str:
    """
    Use AI to extract a stock ticker or company name from a natural language
    investment prompt.  Returns a short, clean search term for Yahoo Finance.
    """
    system = (
        "You are a stock-symbol extraction engine. "
        "Given a user's investment query, respond with ONLY the stock ticker "
        "symbol (e.g. AAPL, TSLA, DANGCEM.NL) or the company name if no "
        "ticker is obvious. "
        "Rules:\n"
        "- Return ONLY the ticker or company name, nothing else.\n"
        "- No explanation, no punctuation, no quotes.\n"
        "- If the user mentions a product (e.g. iPhone), return the parent "
        "company's ticker.\n"
        "- If multiple stocks are mentioned, return only the first/primary one.\n"
        "- If the input IS already a ticker (e.g. 'AAPL'), return it as-is.\n"
        "- For Nigerian stocks, use the .NL suffix if appropriate."
    )
    raw = await asyncio.to_thread(
        _call_groq, user_prompt, system, max_tokens=30, temperature=0.0
    )
    # Clean up — strip whitespace, quotes, periods at end
    cleaned = raw.strip().strip('"').strip("'").strip(".").strip()
    # If AI returned multiple words/lines, take first line
    if "\n" in cleaned:
        cleaned = cleaned.split("\n")[0].strip()
    return cleaned if cleaned else user_prompt.strip()


def _call_groq(prompt: str, system: str = None, max_tokens: int = 2000,
               temperature: float = 0.3) -> str:
    """
    Core Groq call wrapper using direct HTTP (bypasses SDK Pydantic V1 issue
    on Python 3.14). Returns the response text string.
    Retries on 429 rate-limit errors. Returns empty string on failure.
    """
    import time

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    logger.info("Groq call: max_tokens=%d, temp=%.1f, prompt_len=%d",
                 max_tokens, temperature, len(prompt))

    for attempt in range(3):
        try:
            resp = _get_http_client().post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {_get_api_key()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            if resp.status_code == 429:
                raw_retry = resp.headers.get("retry-after", "")
                try:
                    retry_secs = float(raw_retry)
                except (ValueError, TypeError):
                    retry_secs = 2 ** (attempt + 1)
                # If retry-after is more than 60s, this is a daily limit — don't wait
                if retry_secs > 60:
                    logger.warning("Groq daily rate limit hit (retry-after=%ss). Skipping retries.", raw_retry)
                    return ""
                wait = min(retry_secs, 10)
                logger.warning("Groq 429 rate-limited (retry-after=%s), waiting %.1fs (attempt %d/3)",
                               raw_retry, wait, attempt + 1)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            logger.info("Groq response: %d chars, finish_reason=%s",
                         len(content), data["choices"][0].get("finish_reason", "?"))
            return content
        except Exception as e:
            logger.error("Groq API call failed (attempt %d/3): %s", attempt + 1, e)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
            return ""
    return ""


def _call_groq_strict(prompt: str, system: str = None, max_tokens: int = 2000,
                      temperature: float = 0.3) -> str:
    """Groq call variant that raises a detailed error instead of returning an empty string."""
    import time

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    logger.info("Groq strict call: max_tokens=%d, temp=%.1f, prompt_len=%d",
                max_tokens, temperature, len(prompt))

    last_error: GroqCallError | None = None

    for attempt in range(3):
        try:
            resp = _get_http_client().post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {_get_api_key()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )

            if resp.status_code == 429:
                raw_retry = resp.headers.get("retry-after", "")
                try:
                    retry_secs = float(raw_retry)
                except (ValueError, TypeError):
                    retry_secs = 2 ** (attempt + 1)
                if retry_secs > 60:
                    raise GroqCallError(
                        f"Groq rate limit exceeded (retry-after={raw_retry}).",
                        status_code=429,
                    )
                wait = min(retry_secs, 10)
                logger.warning(
                    "Groq 429 rate-limited (retry-after=%s), waiting %.1fs (attempt %d/3)",
                    raw_retry, wait, attempt + 1,
                )
                time.sleep(wait)
                continue

            if resp.status_code in (401, 403):
                detail = _extract_groq_error_message(resp)
                raise GroqCallError(
                    f"Groq API returned {resp.status_code} {resp.reason_phrase}: {detail}",
                    status_code=resp.status_code,
                )

            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            logger.info("Groq strict response: %d chars, finish_reason=%s",
                        len(content), data["choices"][0].get("finish_reason", "?"))
            return content
        except GroqCallError as exc:
            last_error = exc
            logger.error("Groq strict call failed (attempt %d/3): %s", attempt + 1, exc)
            if exc.status_code in (401, 403):
                raise
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            detail = _extract_groq_error_message(exc.response) if exc.response is not None else ""
            last_error = GroqCallError(
                f"Groq API returned {status_code or 'unknown'} error{f': {detail}' if detail else ''}.",
                status_code=status_code,
            )
            logger.error("Groq strict HTTP error (attempt %d/3): %s", attempt + 1, exc)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue
        except Exception as exc:
            last_error = GroqCallError(f"Groq API call failed: {exc}")
            logger.error("Groq strict unexpected error (attempt %d/3): %s", attempt + 1, exc)
            if attempt < 2:
                time.sleep(2 ** (attempt + 1))
                continue

    if last_error is not None:
        raise last_error
    raise GroqCallError("Groq API call failed for an unknown reason.")


def _parse_json_response(raw: str, fallback: dict) -> dict:
    """
    Safely parse a JSON string from the model response.
    Handles code fences, trailing text, and truncated responses.
    Uses json.JSONDecoder.raw_decode for robust extraction.
    """
    try:
        cleaned = raw.strip()
        # Strip markdown code fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```\s*$", "", cleaned)
        cleaned = cleaned.strip()

        # Try direct parse first (fastest path)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Use raw_decode — it properly handles braces inside strings
        # and stops at the end of the first complete JSON value
        start = cleaned.find("{")
        if start == -1:
            raise ValueError("No JSON object found")

        decoder = json.JSONDecoder()
        try:
            obj, _ = decoder.raw_decode(cleaned, start)
            return obj
        except json.JSONDecodeError:
            pass

        # Try from first { to last }
        last = cleaned.rfind("}")
        if last > start:
            try:
                return json.loads(cleaned[start:last + 1])
            except json.JSONDecodeError:
                pass

        # Attempt to repair truncated JSON by closing open structures
        fragment = cleaned[start:]
        repaired = _repair_truncated_json(fragment)
        if repaired:
            return json.loads(repaired)

        raise ValueError("Could not parse or repair JSON")
    except Exception as e:
        logger.warning("Failed to parse JSON response: %s", e)
        logger.debug("Raw response was: %s", raw[:500])
        return fallback


def _repair_truncated_json(s: str) -> str | None:
    """
    Attempt to repair truncated JSON by closing open strings, arrays, and objects.
    Returns the repaired string or None if repair isn't possible.
    """
    try:
        # If we're inside an unterminated string, close it
        in_string = False
        escaped = False
        stack = []  # track [ and {
        for ch in s:
            if escaped:
                escaped = False
                continue
            if ch == '\\' and in_string:
                escaped = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch in ('{', '['):
                stack.append(ch)
            elif ch == '}' and stack and stack[-1] == '{':
                stack.pop()
            elif ch == ']' and stack and stack[-1] == '[':
                stack.pop()

        suffix = ""
        if in_string:
            suffix += '"'
        # Close any open arrays/objects in reverse order
        for bracket in reversed(stack):
            suffix += ']' if bracket == '[' else '}'

        if suffix:
            repaired = s + suffix
            json.loads(repaired)  # validate
            return repaired
        return None
    except Exception:
        return None


async def analyse_news_sentiment(symbol: str, company_name: str,
                                headlines: list) -> dict:
    """
    Analyses a list of news headlines and returns structured sentiment data.
    """
    fallback = {
        "overall_sentiment": "Neutral",
        "sentiment_score": 0.0,
        "confidence": "Low",
        "reasoning": "Sentiment analysis unavailable at this time.",
        "key_themes": [],
        "risk_flags": [],
        "opportunity_signals": [],
    }

    if not headlines:
        return fallback

    headlines_formatted = "\n".join(
        [f"- {h.get('title', '')}" for h in headlines[:10]]
    )

    system_prompt = (
        "You are a senior financial analyst specialising in qualitative "
        "investment research. You always respond with valid JSON only — "
        "no markdown, no explanation, no code fences."
    )

    user_prompt = f"""Analyse the following news headlines about {company_name} ({symbol}) and return ONLY a valid JSON object.

Return exactly this structure:
{{
  "overall_sentiment": "Bullish" or "Bearish" or "Neutral",
  "sentiment_score": <float between -1.0 (most bearish) and 1.0 (most bullish)>,
  "confidence": "High" or "Medium" or "Low",
  "reasoning": "<2-3 sentence explanation of the overall sentiment>",
  "key_themes": ["<theme1>", "<theme2>", "<theme3>"],
  "risk_flags": ["<risk1>", "<risk2>"],
  "opportunity_signals": ["<signal1>", "<signal2>"]
}}

Headlines to analyse:
{headlines_formatted}

Important: Do not provide buy or sell recommendations. Only analyse sentiment."""

    raw = await asyncio.to_thread(_call_groq, user_prompt, system_prompt, 800)
    if not raw:
        return fallback

    return _parse_json_response(raw, fallback)


async def generate_investment_brief(brief_input: dict) -> dict:
    """
    Generates a comprehensive qualitative investment brief from all
    available data sources.
    """
    fallback = {
        "executive_summary": "Brief generation encountered an issue. Please try again.",
        "asset_overview": {
            "description": "",
            "key_metrics_commentary": "",
            "sector_position": "",
        },
        "sentiment_analysis": {
            "commentary": "",
            "catalyst_watch": "",
        },
        "crowd_intelligence": {
            "commentary": "No Bayse prediction market data available.",
            "reliability_note": "",
        },
        "risk_assessment": {
            "overall_risk_level": "Medium",
            "volatility_commentary": "",
            "key_risks": [],
            "nigerian_investor_context": "",
        },
        "macroeconomic_context": {
            "commentary": "",
            "sector_outlook": "",
        },
        "plain_language_verdict": "Analysis unavailable. Please try again.",
    }

    symbol = brief_input.get("symbol", "Unknown")
    company_name = brief_input.get("company_name", symbol)
    quote = brief_input.get("quote", {})
    overview = brief_input.get("company_overview", {})
    sentiment = brief_input.get("sentiment_result", {})
    bayse = brief_input.get("bayse_markets", [])
    volatility = brief_input.get("volatility", 0)
    user_prompt = brief_input.get("user_prompt", "")

    quote_formatted = json.dumps(quote, indent=2) if quote else "Not available"
    overview_formatted = json.dumps(overview, indent=2) if overview else "Not available"
    sentiment_formatted = json.dumps(sentiment, indent=2) if sentiment else "Not available"
    bayse_list = bayse if isinstance(bayse, list) else []
    bayse_formatted = json.dumps(bayse_list[:3], indent=2) if bayse_list else "No active Bayse prediction markets found for this asset"
    volatility_formatted = f"{float(volatility) * 100:.2f}%" if volatility else "Not available"

    prompt_context = ""
    if user_prompt and len(user_prompt.split()) > 2:
        prompt_context = f"""
The user asked: "{user_prompt}"
Tailor the executive_summary and plain_language_verdict to directly address what they asked. Speak to them conversationally — e.g. "You asked about Apple's performance — here's what the data shows..."
"""

    system_prompt = (
        "You are Quantnance AI, a senior investment research analyst. "
        "You write clear, data-driven, plain-language investment briefs. "
        "You always respond with valid JSON only — no markdown, no explanation, "
        "no code fences. You never make explicit buy/sell/hold recommendations. "
        "You always frame conclusions as 'the data suggests' not 'you should'. "
        "Base ALL your analysis EXCLUSIVELY on the Yahoo Finance market data "
        "provided below. Do NOT use your pre-trained knowledge about the "
        "company's historical performance or financials. If a data field shows "
        "'Not available', state that explicitly rather than filling in from memory."
    )

    user_prompt = f"""Generate a comprehensive qualitative investment brief for {company_name} ({symbol}).
{prompt_context}
CURRENT MARKET DATA:
{quote_formatted}

COMPANY FUNDAMENTALS:
{overview_formatted}

VOLATILITY: {volatility_formatted}

NEWS SENTIMENT ANALYSIS:
{sentiment_formatted}

CROWD PREDICTION MARKET DATA (from Bayse):
{bayse_formatted}

Return ONLY a valid JSON object with exactly this structure:
{{
  "executive_summary": "<3-4 sentence plain-language summary of the investment case>",
  "asset_overview": {{
    "description": "<2 sentence company description>",
    "key_metrics_commentary": "<plain language explanation of the most important metrics>",
    "sector_position": "<how this asset sits within its sector>"
  }},
  "sentiment_analysis": {{
    "commentary": "<3-4 sentences interpreting news sentiment in context of price action>",
    "catalyst_watch": "<upcoming events or catalysts to watch>"
  }},
  "crowd_intelligence": {{
    "commentary": "<2-3 sentences interpreting Bayse prediction market odds. If no data, state that.>",
    "reliability_note": "<comment on how much weight to give this signal>"
  }},
  "risk_assessment": {{
    "overall_risk_level": "Low" or "Medium" or "High" or "Very High",
    "volatility_commentary": "<plain language interpretation of volatility>",
    "key_risks": ["<risk1>", "<risk2>", "<risk3>"],
    "nigerian_investor_context": "<specific commentary for Nigerian investors including naira/USD exposure and currency risk>"
  }},
  "macroeconomic_context": {{
    "commentary": "<2-3 sentences on macro environment and how it affects this asset>",
    "sector_outlook": "<brief sector outlook>"
  }},
  "plain_language_verdict": "<5-6 sentence final verdict in completely plain English. No jargon. What the data suggests about near-term outlook. Include what investor profile this suits. Do not make buy/sell recommendations.>"
}}"""

    raw = await asyncio.to_thread(_call_groq, user_prompt, system_prompt, 2500, 0.4)
    if not raw:
        return fallback

    return _parse_json_response(raw, fallback)


async def answer_question(symbol: str, brief_context: dict,
                    conversation_history: list,
                    user_question: str) -> str:
    """
    Answers a user question about the investment brief using conversation
    history for context.
    """
    system_prompt = (
        f"You are Quantnance AI, a financial research assistant. "
        f"You have generated an investment brief for {symbol}. "
        f"Answer questions based EXCLUSIVELY on the Yahoo Finance data and "
        f"analysis provided in the brief context below. Do NOT supplement "
        f"with your pre-trained knowledge about the company. "
        f"Be conversational, clear, and helpful. Never make buy/sell "
        f"recommendations. If the user asks about something not covered "
        f"in the brief data, say 'That information isn't available in the "
        f"current Yahoo Finance data' rather than using general knowledge. "
        f"Keep answers under 150 words unless more detail is needed."
    )

    messages = [{"role": "system", "content": system_prompt}]

    context_str = json.dumps(brief_context, indent=2)
    messages.append({
        "role": "user",
        "content": f"Here is the investment brief context for our conversation:\n{context_str}"
    })
    messages.append({
        "role": "assistant",
        "content": f"Understood. I have reviewed the Quantnance investment brief for {symbol}. I am ready to answer your questions based on this data."
    })

    for turn in conversation_history[-8:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({
                "role": turn["role"],
                "content": turn["content"]
            })

    messages.append({"role": "user", "content": user_question})

    def _do_chat():
        resp = httpx.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {_get_api_key()}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": messages,
                "max_tokens": 400,
                "temperature": 0.5,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    try:
        return await asyncio.to_thread(_do_chat)
    except Exception as e:
        logger.error(f"Groq chat call failed: {e}")
        return "I'm sorry, I encountered an error processing your question. Please try again."


async def classify_prompt(user_prompt: str) -> dict:
    """Classify whether a prompt is analyze, compare, or recommend."""
    system = (
        "You classify investment queries. Respond with ONLY valid JSON.\n"
        "Return exactly: {\"intent\": \"<type>\", \"symbols\": [\"<sym1>\", ...]}\n"
        "intent must be one of:\n"
        "- \"analyze\" — user asks about ONE stock (e.g. 'How is AAPL doing?')\n"
        "- \"compare\" — user wants to compare TWO or more stocks "
        "(e.g. 'NVDA vs AMD', 'Compare Apple and Microsoft')\n"
        "- \"recommend\" — user asks for stock suggestions/ideas "
        "(e.g. 'Suggest dividend stocks', 'What Nigerian stocks should I buy?')\n"
        "symbols: extract ticker symbols or company names mentioned. "
        "For recommend intent, symbols can be empty [].\n"
        "Rules: no explanation, no markdown. JSON only."
    )
    raw = await asyncio.to_thread(_call_groq, user_prompt, system, 120, 0.0)
    fallback = {"intent": "analyze", "symbols": []}
    if not raw:
        return fallback
    result = _parse_json_response(raw, fallback)
    if result.get("intent") not in ("analyze", "compare", "recommend"):
        result["intent"] = "analyze"
    return result


async def generate_comparison(stocks_data: list[dict], user_prompt: str) -> dict:
    """Generate a side-by-side AI comparison of 2+ stocks."""
    system_prompt = (
        "You are Quantnance AI, a senior investment research analyst. "
        "You write clear, data-driven stock comparisons. "
        "Respond with ONLY valid JSON — no markdown, no code fences. "
        "Never make buy/sell/hold recommendations. "
        "Base analysis EXCLUSIVELY on the data provided."
    )

    # Build a compact data summary — only essential comparison fields
    compact = []
    for s in stocks_data:
        q = s.get("quote") or {}
        o = s.get("overview") or {}
        compact.append({
            "symbol": s.get("symbol", "?"),
            "name": o.get("name", ""),
            "price": q.get("price"),
            "change": q.get("change"),
            "change_percent": q.get("change_percent"),
            "market_cap": o.get("market_cap"),
            "pe_ratio": o.get("pe_ratio"),
            "eps": o.get("eps"),
            "beta": o.get("beta"),
            "52w_high": o.get("52_week_high"),
            "52w_low": o.get("52_week_low"),
            "dividend_yield": o.get("dividend_yield"),
            "sector": o.get("sector"),
        })
    stocks_formatted = json.dumps(compact, default=str)
    symbols = [s.get("symbol", "?") for s in stocks_data]

    user_msg = f"""Compare these stocks based on the market data below: {', '.join(symbols)}

The user asked: "{user_prompt}"

STOCK DATA:
{stocks_formatted}

Return ONLY valid JSON with this structure:
{{
  "summary": "<3-4 sentence overview comparing the stocks>",
  "metrics_comparison": {{
    "price_action": "<compare recent price performance>",
    "valuation": "<compare P/E, market cap, EPS>",
    "risk_profile": "<compare beta, volatility, 52-week ranges>",
    "fundamentals": "<compare revenue growth, profit margins>"
  }},
  "strengths": {{
    "{symbols[0]}": ["<strength1>", "<strength2>"],
    "{symbols[1] if len(symbols) > 1 else 'B'}": ["<strength1>", "<strength2>"]
  }},
  "weaknesses": {{
    "{symbols[0]}": ["<weakness1>"],
    "{symbols[1] if len(symbols) > 1 else 'B'}": ["<weakness1>"]
  }},
  "verdict": "<2-3 sentence verdict. Which suits what investor profile. No buy/sell recs.>"
}}"""

    raw = await asyncio.to_thread(_call_groq, user_msg, system_prompt, 1500, 0.4)
    fallback = {"summary": "Comparison unavailable.", "verdict": "Please try again.",
                "metrics_comparison": {}, "strengths": {}, "weaknesses": {}}
    if not raw:
        logger.warning("Comparison: Groq returned empty response")
        return fallback
    result = _parse_json_response(raw, fallback)
    logger.info("Comparison parsed — summary=%d chars, verdict=%d chars",
                len(result.get("summary", "")), len(result.get("verdict", "")))
    return result


async def generate_recommendations(user_prompt: str) -> dict:
    """AI stock suggestions based on user preferences."""
    system_prompt = (
        "You are Quantnance AI. Suggest stocks for RESEARCH only — never financial advice. "
        "Respond with ONLY valid JSON — no markdown, no code fences. "
        "Suggest real, currently traded stocks with valid ticker symbols."
    )
    user_msg = f"""The user asked: "{user_prompt}"

Suggest 4-6 stocks that match what the user is looking for.
Return ONLY valid JSON with this structure:
{{
  "theme": "<short label for the recommendation theme, e.g. 'High-Growth Tech' or 'Nigerian Banks'>",
  "reasoning": "<2-3 sentences on why these were selected>",
  "stocks": [
    {{
      "symbol": "<TICKER>",
      "name": "<Company Name>",
      "rationale": "<1 sentence why this stock fits the query>"
    }}
  ],
  "disclaimer": "These are AI-generated starting points for research, not financial advice. Always do your own due diligence before investing."
}}"""

    raw = await asyncio.to_thread(_call_groq, user_msg, system_prompt, 1200, 0.5)
    fallback = {
        "theme": "Suggestions",
        "reasoning": "Unable to generate recommendations at this time.",
        "stocks": [],
        "disclaimer": "These are AI-generated starting points for research, not financial advice.",
    }
    return _parse_json_response(raw, fallback) if raw else fallback


async def analyze_quantdocs_document(document_text: str, question: str = "") -> dict:
    """Generate structured investor-grade analysis for an uploaded financial document."""
    fallback = {
        "document_type": "Unknown",
        "company_name": "Unknown",
        "period_covered": "Unknown",
        "overview": "Unable to analyse this document at the moment.",
        "quant_score": 50,
        "radar_scores": {
            "Revenue Growth": 50.0,
            "Gross Margin": 50.0,
            "Profitability": 50.0,
            "Liquidity": 50.0,
            "Debt Level": 50.0,
            "Operational Efficiency": 50.0,
        },
        "extracted_metrics": [],
        "risk_flags": [],
        "opportunity_signals": [],
        "ai_verdict": "Analysis could not be completed. Please try another document.",
        "suggested_questions": [
            "What are the most important financial trends in this document?",
            "What are the biggest financial risks shown here?",
            "What should an investor verify next based on this document?",
        ],
    }

    system_prompt = (
        "You are Quantnance AI, a senior financial document analyst focused on investor-grade analysis. "
        "You analyse uploaded annual reports, statements, and financial spreadsheets. "
        "Respond with JSON only. No markdown, no prose outside JSON, no code fences."
    )

    question_text = question.strip() if question else ""
    user_prompt = f"""Analyse the uploaded financial document content below.

{f'User context question: {question_text}' if question_text else 'User context question: (none)'}

Return ONLY valid JSON with exactly these fields:
{{
  "document_type": "string",
  "company_name": "string",
  "period_covered": "string",
  "overview": "string",
  "quant_score": 0,
  "radar_scores": {{
    "Revenue Growth": 0.0,
    "Gross Margin": 0.0,
    "Profitability": 0.0,
    "Liquidity": 0.0,
    "Debt Level": 0.0,
    "Operational Efficiency": 0.0
  }},
  "extracted_metrics": [
    {{"label": "string", "value": "string", "unit": "string"}}
  ],
  "risk_flags": ["string"],
  "opportunity_signals": ["string"],
  "ai_verdict": "string",
  "suggested_questions": ["string", "string", "string"]
}}

Rules:
- quant_score must be an integer from 0 to 100.
- Each radar score must be a float from 0 to 100.
- If a field is unknown, return "Unknown" or an empty array as appropriate.
- suggested_questions must contain exactly 3 document-specific follow-up questions.

Document content:
{document_text[:50000]}
"""

    try:
        raw = await asyncio.to_thread(_call_groq_strict, user_prompt, system_prompt, 2500, 0.2)
        parsed = _parse_json_response(raw, fallback)
        normalized = _normalize_quantdocs_result(parsed, fallback)
        normalized["analysis_mode"] = "ai"
        normalized["warning"] = ""
        return normalized
    except GroqCallError as exc:
        logger.error("QuantDocs AI analysis unavailable: %s", exc)
        return _build_rule_based_quantdocs_analysis(document_text, question_text, str(exc))


def _normalize_quantdocs_result(parsed: dict, fallback: dict) -> dict:
    """Normalize model output to guaranteed QuantDocs response schema."""
    result = dict(fallback)

    result["document_type"] = str(parsed.get("document_type") or fallback["document_type"])
    result["company_name"] = str(parsed.get("company_name") or fallback["company_name"])
    result["period_covered"] = str(parsed.get("period_covered") or fallback["period_covered"])
    result["overview"] = str(parsed.get("overview") or fallback["overview"])
    result["ai_verdict"] = str(parsed.get("ai_verdict") or fallback["ai_verdict"])

    try:
        score = int(float(parsed.get("quant_score", fallback["quant_score"])))
    except (ValueError, TypeError):
        score = fallback["quant_score"]
    result["quant_score"] = max(0, min(100, score))

    radar = parsed.get("radar_scores") if isinstance(parsed.get("radar_scores"), dict) else {}
    normalized_radar = {}
    for axis in fallback["radar_scores"].keys():
        try:
            value = float(radar.get(axis, fallback["radar_scores"][axis]))
        except (ValueError, TypeError):
            value = fallback["radar_scores"][axis]
        normalized_radar[axis] = max(0.0, min(100.0, value))
    result["radar_scores"] = normalized_radar

    extracted_metrics = parsed.get("extracted_metrics")
    if isinstance(extracted_metrics, list):
        cleaned_metrics = []
        for item in extracted_metrics:
            if isinstance(item, dict):
                cleaned_metrics.append({
                    "label": str(item.get("label", "")).strip(),
                    "value": str(item.get("value", "")).strip(),
                    "unit": str(item.get("unit", "")).strip(),
                })
        result["extracted_metrics"] = [m for m in cleaned_metrics if m["label"] and m["value"]]

    risk_flags = parsed.get("risk_flags")
    if isinstance(risk_flags, list):
        result["risk_flags"] = [str(v).strip() for v in risk_flags if str(v).strip()]

    opportunities = parsed.get("opportunity_signals")
    if isinstance(opportunities, list):
        result["opportunity_signals"] = [str(v).strip() for v in opportunities if str(v).strip()]

    suggestions = parsed.get("suggested_questions")
    if isinstance(suggestions, list):
        cleaned = [str(v).strip() for v in suggestions if str(v).strip()]
        if len(cleaned) >= 3:
            result["suggested_questions"] = cleaned[:3]

    return result


def _find_metric_line(document_text: str, keywords: tuple[str, ...]) -> str | None:
    for line in document_text.splitlines():
        lower = line.lower()
        if all(keyword in lower for keyword in keywords):
            return line.strip()
    return None


def _extract_token_from_line(line: str | None) -> tuple[str | None, float | None, str]:
    if not line:
        return None, None, ""

    match = re.search(
        r"([$€£]?\s?-?\d[\d,]*(?:\.\d+)?(?:\s?(?:bn|b|m|k|million|billion|thousand))?\s*%?)",
        line,
        re.IGNORECASE,
    )
    if not match:
        return None, None, ""

    token = match.group(1).strip()
    lower = token.lower().replace(",", "")
    unit = ""
    multiplier = 1.0

    if lower.endswith("%"):
        unit = "%"
        lower = lower[:-1].strip()

    if lower.endswith("billion"):
        multiplier = 1_000_000_000.0
        lower = lower[:-7].strip()
    elif lower.endswith("million"):
        multiplier = 1_000_000.0
        lower = lower[:-7].strip()
    elif lower.endswith("thousand"):
        multiplier = 1_000.0
        lower = lower[:-8].strip()
    elif lower.endswith("bn"):
        multiplier = 1_000_000_000.0
        lower = lower[:-2].strip()
    elif lower.endswith("b"):
        multiplier = 1_000_000_000.0
        lower = lower[:-1].strip()
    elif lower.endswith("m"):
        multiplier = 1_000_000.0
        lower = lower[:-1].strip()
    elif lower.endswith("k"):
        multiplier = 1_000.0
        lower = lower[:-1].strip()

    numeric_text = lower.replace("$", "").replace("€", "").replace("£", "").strip()
    try:
        numeric_value = float(numeric_text) * multiplier
    except ValueError:
        numeric_value = None

    if unit == "%":
        value_text = numeric_text
    else:
        value_text = token

    return value_text, numeric_value, unit


def _scale_score(value: float | None, low: float, high: float, invert: bool = False) -> float:
    if value is None or high == low:
        return 50.0
    clipped = max(low, min(high, value))
    score = ((clipped - low) / (high - low)) * 100.0
    if invert:
        score = 100.0 - score
    return round(max(0.0, min(100.0, score)), 1)


def _detect_company_name(document_text: str) -> str:
    match = re.search(r"(?im)^\s*(?:company|issuer|entity)\s*[:\-]\s*(.+)$", document_text)
    if match:
        return match.group(1).strip()[:120]

    for line in document_text.splitlines()[:8]:
        cleaned = line.strip()
        if len(cleaned) > 4 and len(cleaned) < 100 and not re.search(r"\d", cleaned):
            return cleaned
    return "Unknown"


def _detect_period(document_text: str) -> str:
    patterns = [
        r"\bFY\s?20\d{2}\b",
        r"\bQ[1-4]\s+20\d{2}\b",
        r"\b20\d{2}\b",
        r"(?i)year ended[^\n\r]{0,40}",
        r"(?i)quarter ended[^\n\r]{0,40}",
    ]
    for pattern in patterns:
        match = re.search(pattern, document_text)
        if match:
            return match.group(0).strip()
    return "Unknown"


def _detect_document_type(document_text: str) -> str:
    lower = document_text.lower()
    if "annual report" in lower:
        return "Annual Report"
    if "balance sheet" in lower:
        return "Balance Sheet"
    if "income statement" in lower or "statement of operations" in lower:
        return "Income Statement"
    if "cash flow" in lower:
        return "Cash Flow Statement"
    if "sheet:" in lower or "columns:" in lower:
        return "Financial Spreadsheet"
    return "Financial Document"


def _build_rule_based_quantdocs_analysis(document_text: str, question: str, error_message: str) -> dict:
    metric_specs = [
        ("Revenue", ("revenue",)),
        ("Net Income", ("net", "income")),
        ("EBITDA", ("ebitda",)),
        ("Gross Margin", ("gross", "margin")),
        ("Cash Position", ("cash",)),
        ("Debt", ("debt",)),
        ("Revenue Growth", ("revenue", "growth")),
        ("Operating Margin", ("operating", "margin")),
        ("Current Ratio", ("current", "ratio")),
    ]

    extracted_metrics = []
    numeric_metrics: dict[str, float] = {}
    for label, keywords in metric_specs:
        line = _find_metric_line(document_text, keywords)
        value_text, numeric_value, unit = _extract_token_from_line(line)
        if value_text:
            extracted_metrics.append({"label": label, "value": value_text, "unit": unit})
        if numeric_value is not None:
            numeric_metrics[label] = numeric_value

    revenue_growth = numeric_metrics.get("Revenue Growth")
    gross_margin = numeric_metrics.get("Gross Margin")
    operating_margin = numeric_metrics.get("Operating Margin")
    net_income = numeric_metrics.get("Net Income")
    cash_position = numeric_metrics.get("Cash Position")
    debt = numeric_metrics.get("Debt")
    current_ratio = numeric_metrics.get("Current Ratio")
    revenue = numeric_metrics.get("Revenue")
    ebitda = numeric_metrics.get("EBITDA")

    debt_level_score = 50.0
    if debt is not None and cash_position is not None and cash_position > 0:
        debt_level_score = _scale_score(debt / cash_position, 0.0, 3.0, invert=True)
    elif debt is not None:
        debt_level_score = _scale_score(debt, 0.0, max(debt * 1.5, 1.0), invert=True)

    liquidity_score = 50.0
    if current_ratio is not None:
        liquidity_score = _scale_score(current_ratio, 0.7, 2.5)
    elif cash_position is not None and debt is not None and debt > 0:
        liquidity_score = _scale_score(cash_position / debt, 0.4, 2.0)

    efficiency_score = 50.0
    if revenue and ebitda is not None and revenue > 0:
        efficiency_score = _scale_score((ebitda / revenue) * 100.0, 0.0, 35.0)
    elif operating_margin is not None:
        efficiency_score = _scale_score(operating_margin, 0.0, 30.0)

    profitability_score = 50.0
    if operating_margin is not None:
        profitability_score = _scale_score(operating_margin, -10.0, 30.0)
    elif net_income is not None:
        profitability_score = 80.0 if net_income > 0 else 25.0

    radar_scores = {
        "Revenue Growth": _scale_score(revenue_growth, -20.0, 30.0),
        "Gross Margin": _scale_score(gross_margin, 0.0, 60.0),
        "Profitability": profitability_score,
        "Liquidity": liquidity_score,
        "Debt Level": debt_level_score,
        "Operational Efficiency": efficiency_score,
    }
    quant_score = int(round(sum(radar_scores.values()) / len(radar_scores)))

    risk_flags = []
    opportunity_signals = []

    if debt is not None and cash_position is not None and debt > cash_position:
        risk_flags.append("Debt load exceeds cash position")
    if net_income is not None and net_income <= 0:
        risk_flags.append("Net income appears weak or negative")
    if revenue_growth is not None and revenue_growth < 0:
        risk_flags.append("Revenue growth is negative")
    if gross_margin is not None and gross_margin < 20:
        risk_flags.append("Gross margin looks compressed")
    if liquidity_score < 40:
        risk_flags.append("Liquidity buffer appears limited")

    if revenue_growth is not None and revenue_growth >= 10:
        opportunity_signals.append("Revenue growth is running at a healthy pace")
    if gross_margin is not None and gross_margin >= 35:
        opportunity_signals.append("Gross margin profile is strong")
    if cash_position is not None and debt is not None and cash_position >= debt:
        opportunity_signals.append("Cash position covers debt obligations")
    if net_income is not None and net_income > 0:
        opportunity_signals.append("Business appears profitable on extracted figures")
    if efficiency_score >= 60:
        opportunity_signals.append("Operational efficiency metrics are supportive")

    if not risk_flags:
        risk_flags.append("No major numerical red flags were detected in the extracted figures")
    if not opportunity_signals:
        opportunity_signals.append("Further AI review is needed for deeper upside signals")

    company_name = _detect_company_name(document_text)
    period_covered = _detect_period(document_text)
    document_type = _detect_document_type(document_text)

    metric_preview = ", ".join(metric["label"] for metric in extracted_metrics[:4])
    overview = (
        f"This appears to be a {document_type.lower()} for {company_name} covering {period_covered}. "
        f"I extracted {len(extracted_metrics)} key metrics"
        f"{f' including {metric_preview}' if metric_preview else ''}. "
        "The dashboard below is based on rule-based analysis of the extracted figures because the live Groq AI request was rejected."
    )

    ai_verdict = (
        f"The configured Groq service rejected the QuantDocs AI request ({error_message}), so this result is generated from the document's extracted figures rather than the LLM. "
        f"Based on those figures, the overall financial profile scores {quant_score}/100. "
        f"Key strengths: {opportunity_signals[0].lower() if opportunity_signals else 'none identified'}. "
        f"Key risk: {risk_flags[0].lower() if risk_flags else 'none identified'}."
    )

    suggested_questions = [
        "Which extracted metrics had the biggest impact on the quant score?",
        "What additional filings or notes should I review to validate these numbers?",
        f"How should I interpret the main risk in light of {question or 'this document'}?",
    ]

    return {
        "document_type": document_type,
        "company_name": company_name,
        "period_covered": period_covered,
        "overview": overview,
        "quant_score": quant_score,
        "radar_scores": radar_scores,
        "extracted_metrics": extracted_metrics,
        "risk_flags": risk_flags,
        "opportunity_signals": opportunity_signals,
        "ai_verdict": ai_verdict,
        "suggested_questions": suggested_questions,
        "analysis_mode": "rule_based",
        "warning": error_message,
    }


async def quantdocs_chat(user_message: str, conversation_history: list, document_context: dict) -> str:
    """Answer user questions grounded in uploaded QuantDocs analysis context."""
    system_prompt = (
        "You are Quantnance AI, a financial document analysis assistant. "
        "You must answer questions about the uploaded document context only. "
        "Do not invent values not present in the provided context. "
        "If information is missing, clearly say it is not present in the uploaded document. "
        "Keep responses concise, clear, and investor-grade. "
        "Do not provide explicit buy/sell instructions."
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.append({
        "role": "user",
        "content": "Uploaded document analysis context:\n" + json.dumps(document_context, indent=2),
    })
    messages.append({
        "role": "assistant",
        "content": "Understood. I will answer questions using only this uploaded document context.",
    })

    for turn in conversation_history[-10:]:
        if isinstance(turn, dict) and turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})

    messages.append({"role": "user", "content": user_message})

    def _do_chat():
        resp = _get_http_client().post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {_get_api_key()}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": messages,
                "max_tokens": 600,
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

    try:
        return await asyncio.to_thread(_do_chat)
    except Exception as exc:
        logger.error("QuantDocs chat failed: %s", exc)
        return "I could not answer that from the uploaded document right now. Please try again."


async def research_chat(user_message: str, conversation_history: list,
                        file_content: str | None = None,
                        image_base64: str | None = None) -> str:
    """
    Open-ended financial research chat — not tied to any specific stock.
    Supports optional file content (extracted text) and image analysis.
    """
    system_prompt = (
        "You are Quantnance AI, a knowledgeable financial research assistant. "
        "You help users understand markets, financial concepts, economic events, "
        "investment strategies, and asset classes. You can analyse financial "
        "documents, balance sheets, reports, and chart images when provided.\n"
        "Rules:\n"
        "- ALWAYS include quantitative data when discussing a company or asset: "
        "market capitalisation, current share price, "
        "P/E ratio, revenue, profit margins, 52-week range, and volatility metrics "
        "where available. State the approximate date of the data.\n"
        "- Do not mention knowledge cutoffs, training data dates, or model limitations. "
        "If freshness is uncertain, advise users to verify with live market data for "
        "the latest developments.\n"
        "- Mention the primary exchange(s) where the asset is traded "
        "(e.g. NYSE, NASDAQ, NGX, LSE) and the ticker symbol.\n"
        "- Be conversational, clear, and educational.\n"
        "- Never give explicit buy/sell/hold recommendations.\n"
        "- Frame insights as 'the data suggests' not 'you should'.\n"
        "- If the user asks about a specific stock ticker, suggest they use "
        "the Quantnance Stock Analysis for a full real-time analysis brief.\n"
        "- When analysing uploaded documents or images, reference specific "
        "numbers and details from the content.\n"
        "- Keep responses concise — aim for 150-250 words.\n"
        "- If you don't know something, say so honestly."
    )

    messages = [{"role": "system", "content": system_prompt}]

    for turn in conversation_history[-16:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({
                "role": turn["role"],
                "content": turn["content"]
            })

    user_content = user_message
    if file_content:
        user_content += f"\n\n--- Uploaded Document Content ---\n{file_content[:15000]}"

    if image_base64:
        # Use Groq vision model with image
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": user_content},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
            ],
        })
        vision_model = "llama-3.2-90b-vision-preview"

        def _do_vision_chat():
            import time as _time
            for attempt in range(3):
                try:
                    resp = httpx.post(
                        GROQ_API_URL,
                        headers={
                            "Authorization": f"Bearer {_get_api_key()}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": vision_model,
                            "messages": messages,
                            "max_tokens": 1500,
                            "temperature": 0.5,
                        },
                        timeout=60,
                    )
                    if resp.status_code == 429:
                        raw_retry = resp.headers.get("retry-after", "")
                        try:
                            retry_secs = float(raw_retry)
                        except (ValueError, TypeError):
                            retry_secs = 2 ** (attempt + 1)
                        if retry_secs > 60:
                            return "I'm currently rate-limited. Please try again in a moment."
                        _time.sleep(min(retry_secs, 10))
                        continue
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"]
                except Exception as e:
                    logger.error("Vision chat failed (attempt %d): %s", attempt + 1, e)
                    if attempt < 2:
                        _time.sleep(2 ** (attempt + 1))
            return "I'm sorry, I encountered an error analysing the image. Please try again."

        return await asyncio.to_thread(_do_vision_chat)
    else:
        messages.append({"role": "user", "content": user_content})

        def _do_research_chat():
            resp = _get_http_client().post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {_get_api_key()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": messages,
                    "max_tokens": 1024,
                    "temperature": 0.5,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

        try:
            return await asyncio.to_thread(_do_research_chat)
        except Exception as e:
            logger.error("Research chat failed: %s", e)
            return "I'm sorry, I encountered an error processing your question. Please try again."


async def fallback_chat(original_query: str) -> str:
    """
    When stock search fails, generate a helpful AI response about the query.
    """
    system_prompt = (
        "You are Quantnance AI, a helpful financial research assistant. "
        "The user searched for something in the Stock Analysis that returned "
        "no results. Help them by:\n"
        "1. Explaining what you know about the topic if it's finance-related.\n"
        "2. Suggesting the correct ticker symbol if they may have misspelled it.\n"
        "3. If it's a known company, providing the correct ticker and exchange.\n"
        "4. If it's not a stock at all, offering to discuss the topic as a "
        "general financial research question.\n"
        "Be concise (100-200 words), conversational, and helpful."
    )

    raw = await asyncio.to_thread(
        _call_groq, original_query, system_prompt, max_tokens=600, temperature=0.5
    )
    return raw if raw else (
        "I couldn't find specific information about that. "
        "Try using Stock Analysis with a ticker symbol (e.g., AAPL for Apple) "
        "or use the AI Research Chat for general financial questions."
    )
