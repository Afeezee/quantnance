import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ─── Types ──────────────────────────────────── */

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  latest_trading_day: string;
  previous_close: number;
  open: number;
  high: number;
  low: number;
}

export interface CompanyOverview {
  name: string;
  description: string;
  exchange: string;
  currency: string;
  country: string;
  sector: string;
  industry: string;
  market_cap: number;
  pe_ratio: number;
  eps: number;
  dividend_yield: number;
  '52_week_high': number;
  '52_week_low': number;
  '50_day_ma': number;
  '200_day_ma': number;
  revenue_growth: number;
  profit_margin: number;
  beta: number;
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsArticle {
  title: string;
  source_name: string;
  published_at: string;
  url: string;
  description: string | null;
  url_to_image: string | null;
}

export interface SentimentResult {
  overall_sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  sentiment_score: number;
  confidence: string;
  reasoning: string;
  key_themes: string[];
  risk_flags: string[];
  opportunity_signals: string[];
}

export interface BayseSentiment {
  available: boolean;
  message?: string;
  event_title?: string;
  category?: string;
  closing_date?: string;
  status?: string;
  outcome1_label?: string;
  outcome1_price?: number;
  outcome2_label?: string;
  outcome2_price?: number;
  crowd_confidence?: string;
}

export interface BriefContent {
  executive_summary: string;
  asset_overview: {
    description: string;
    key_metrics_commentary: string;
    sector_position: string;
  };
  sentiment_analysis: {
    commentary: string;
    catalyst_watch: string;
  };
  crowd_intelligence: {
    commentary: string;
    reliability_note: string;
  };
  risk_assessment: {
    overall_risk_level: string;
    volatility_commentary: string;
    key_risks: string[];
    nigerian_investor_context: string;
  };
  macroeconomic_context: {
    commentary: string;
    sector_outlook: string;
  };
  plain_language_verdict: string;
}

export interface BriefData {
  symbol: string;
  exchange: string;
  generated_at: string;
  quote: Quote | null;
  company_overview: CompanyOverview | null;
  price_history: PricePoint[] | null;
  volatility: number;
  news: NewsArticle[] | null;
  bayse_markets: unknown[];
  bayse_sentiment: BayseSentiment | null;
  sentiment: SentimentResult | null;
  brief: BriefContent | null;
}

/* ─── Hook ───────────────────────────────────── */

export function useBrief() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (prompt: string) => {
    setLoading(true);
    setError(null);
    setBrief(null);
    try {
      const { data } = await axios.get<BriefData>(`${API_URL}/api/analyze`, {
        params: { prompt },
        timeout: 120000,
      });
      setBrief(data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message || 'Failed to generate brief');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    if (brief?.symbol) {
      analyze(brief.symbol);
    }
  }, [brief, analyze]);

  return { brief, loading, error, analyze, refetch };
}
