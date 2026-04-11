import os
import json
import logging
import asyncio
import httpx

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


def _get_api_key() -> str:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_key_here":
        raise RuntimeError("GROQ_API_KEY is not configured in server/.env")
    return api_key


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
    Never raises to the caller — returns empty string on failure.
    """
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        logger.info("Groq call: max_tokens=%d, temp=%.1f, prompt_len=%d",
                     max_tokens, temperature, len(prompt))

        resp = httpx.post(
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
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        logger.info("Groq response: %d chars, finish_reason=%s",
                     len(content), data["choices"][0].get("finish_reason", "?"))
        return content
    except Exception as e:
        logger.error(f"Groq API call failed: {e}")
        return ""


def _parse_json_response(raw: str, fallback: dict) -> dict:
    """
    Safely parse a JSON string from the model response.
    Strips markdown code fences if present.
    Returns fallback dict if parsing fails.
    """
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1])
        return json.loads(cleaned)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"Failed to parse JSON response: {e}")
        logger.debug(f"Raw response was: {raw[:500]}")
        return fallback


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
    stocks_formatted = json.dumps(stocks_data, indent=2, default=str)
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
  "verdict": "<5-6 sentence plain-language verdict. Which suits what investor profile. No buy/sell recs.>"
}}"""

    raw = await asyncio.to_thread(_call_groq, user_msg, system_prompt, 2000, 0.4)
    fallback = {"summary": "Comparison unavailable.", "verdict": "Please try again.",
                "metrics_comparison": {}, "strengths": {}, "weaknesses": {}}
    return _parse_json_response(raw, fallback) if raw else fallback


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
