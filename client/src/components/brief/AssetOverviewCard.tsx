import type { Quote, CompanyOverview, PricePoint } from '../../hooks/useBrief';
import GlassCard from '../shared/GlassCard';
import AnimatedNumber from '../shared/AnimatedNumber';
import PriceChart from './PriceChart';
import { useState } from 'react';

interface AssetOverviewCardProps {
  quote: Quote | null;
  overview: CompanyOverview | null;
  priceHistory: PricePoint[] | null;
}

function formatMarketCap(val: number | null | undefined): string {
  if (val == null || val === 0) return '--';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

const PERIOD_FILTERS: { label: string; days: number }[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
];

export default function AssetOverviewCard({ quote, overview, priceHistory }: AssetOverviewCardProps) {
  const [period, setPeriod] = useState(90);

  const change = quote?.change ?? 0;
  const changePct = quote?.change_percent ?? 0;
  const isUp = change >= 0;

  const filteredHistory = priceHistory
    ? priceHistory.slice(-period)
    : [];

  const stats = [
    { label: 'Market Cap', value: formatMarketCap(overview?.market_cap) },
    { label: 'P/E Ratio', value: overview?.pe_ratio ? overview.pe_ratio.toFixed(2) : '--' },
    { label: '52W High', value: overview?.['52_week_high'] ? `$${overview['52_week_high'].toFixed(2)}` : '--' },
    { label: '52W Low', value: overview?.['52_week_low'] ? `$${overview['52_week_low'].toFixed(2)}` : '--' },
    { label: 'Volume', value: quote?.volume ? Math.round(quote.volume).toLocaleString() : '--' },
  ];

  return (
    <GlassCard animationDelay={100}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>{overview?.name || quote?.symbol || '--'}</h2>
        <span className="font-mono" style={{ color: 'var(--accent-blue)', fontSize: 16, fontWeight: 600 }}>
          {quote?.symbol || '--'}
        </span>
        {overview?.exchange && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {overview.exchange}
          </span>
        )}
      </div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
        <AnimatedNumber
          value={quote?.price}
          decimals={2}
          prefix="$"
          style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)' }}
        />
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: isUp ? 'var(--success)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isUp ? '▲' : '▼'}
          <span className="font-mono">
            {Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
          </span>
        </span>
      </div>

      {/* Quick stats */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginBottom: 24,
          flexWrap: 'wrap',
          borderTop: '1px solid var(--card-border)',
          borderBottom: '1px solid var(--card-border)',
          padding: '16px 0',
        }}
      >
        {stats.map((s) => (
          <div key={s.label} style={{ flex: '1 0 100px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
            <div className="font-mono" style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Chart period toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {PERIOD_FILTERS.map((pf) => (
          <button
            key={pf.label}
            onClick={() => setPeriod(pf.days)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              background: period === pf.days ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
              color: period === pf.days ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            {pf.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <PriceChart data={filteredHistory} />
    </GlassCard>
  );
}
