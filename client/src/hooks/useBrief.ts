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
  event_slug?: string;
  event_id?: string;
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

/* ─── Comparison & Recommendation Types ──────── */

export interface CompareStock {
  symbol: string;
  quote: Quote | null;
  overview: CompanyOverview | null;
}

export interface ComparisonData {
  summary: string;
  metrics_comparison: Record<string, string>;
  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;
  verdict: string;
}

export interface ComparisonResult {
  type: 'compare';
  prompt: string;
  stocks: CompareStock[];
  comparison: ComparisonData;
  generated_at: string;
}

export interface RecommendationStock {
  symbol: string;
  name: string;
  rationale: string;
}

export interface RecommendationResult {
  type: 'recommend';
  prompt: string;
  recommendations: {
    theme: string;
    reasoning: string;
    stocks: RecommendationStock[];
    disclaimer: string;
  };
  generated_at: string;
}

export type AppMode = 'idle' | 'analyze' | 'compare' | 'recommend';

/* ─── Hook ───────────────────────────────────── */

export function useBrief() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('idle');

  const reset = useCallback(() => {
    setBrief(null);
    setComparison(null);
    setRecommendations(null);
    setError(null);
  }, []);

  const analyze = useCallback(async (prompt: string) => {
    setLoading(true);
    setError(null);
    reset();
    try {
      // 1. Classify intent
      const { data: cls } = await axios.get<{ intent: string; symbols: string[] }>(
        `${API_URL}/api/classify`, { params: { prompt }, timeout: 30000 },
      );

      if (cls.intent === 'recommend') {
        setMode('recommend');
        const { data } = await axios.get<RecommendationResult>(
          `${API_URL}/api/recommend`, { params: { prompt }, timeout: 60000 },
        );
        setRecommendations(data);
      } else if (cls.intent === 'compare' && cls.symbols?.length >= 2) {
        setMode('compare');
        const { data } = await axios.get<ComparisonResult>(
          `${API_URL}/api/compare`, {
            params: { prompt, symbols: cls.symbols.join(',') },
            timeout: 120000,
          },
        );
        setComparison(data);
      } else {
        setMode('analyze');
        const { data } = await axios.get<BriefData>(
          `${API_URL}/api/analyze`, { params: { prompt }, timeout: 120000 },
        );
        setBrief(data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message || 'Request failed');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, [reset]);

  return { brief, comparison, recommendations, mode, loading, error, analyze };
}
