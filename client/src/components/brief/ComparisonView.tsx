import type { CompareStock, ComparisonData } from '../../hooks/useBrief';
import GlassCard from '../shared/GlassCard';
import AnimatedNumber from '../shared/AnimatedNumber';

interface Props {
  stocks: CompareStock[];
  comparison: ComparisonData;
  onAnalyze: (symbol: string) => void;
}

function formatMCap(val: number | null | undefined) {
  if (!val) return '--';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

const metricLabels: Record<string, string> = {
  price_action: 'Price Action',
  valuation: 'Valuation',
  risk_profile: 'Risk Profile',
  fundamentals: 'Fundamentals',
};

export default function ComparisonView({ stocks, comparison, onAnalyze }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary */}
      <GlassCard title="Comparison Summary" icon={<span style={{ fontSize: 11 }}>⚖️</span>}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {comparison.summary}
        </p>
      </GlassCard>

      {/* Side-by-side stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stocks.length}, 1fr)`,
        gap: 16,
      }}>
        {stocks.map((s) => {
          const change = s.quote?.change ?? 0;
          const changePct = s.quote?.change_percent ?? 0;
          const isUp = change >= 0;

          return (
            <GlassCard key={s.symbol}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <button
                  type="button"
                  className="comparison-symbol-button"
                  onClick={() => onAnalyze(s.symbol)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 20, fontWeight: 700, color: 'var(--accent-blue)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {s.symbol}
                </button>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {s.overview?.name || s.symbol}
                </p>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  $<AnimatedNumber value={s.quote?.price ?? 0} decimals={2} />
                </span>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: isUp ? 'var(--success)' : 'var(--danger)' }}>
                  {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                {([
                  ['Market Cap', formatMCap(s.overview?.market_cap)],
                  ['P/E', s.overview?.pe_ratio ? s.overview.pe_ratio.toFixed(2) : '--'],
                  ['EPS', s.overview?.eps ? `$${s.overview.eps.toFixed(2)}` : '--'],
                  ['Beta', s.overview?.beta ? s.overview.beta.toFixed(2) : '--'],
                  ['52W High', s.overview?.['52_week_high'] ? `$${s.overview['52_week_high'].toFixed(2)}` : '--'],
                  ['52W Low', s.overview?.['52_week_low'] ? `$${s.overview['52_week_low'].toFixed(2)}` : '--'],
                  ['Sector', s.overview?.sector || '--'],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{val}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="no-print"
                onClick={() => onAnalyze(s.symbol)}
                style={{
                  marginTop: 16, width: '100%', padding: '8px 0',
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 8, color: 'var(--accent-blue)', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Full Analysis →
              </button>
            </GlassCard>
          );
        })}
      </div>

      {/* Metrics comparison */}
      {comparison.metrics_comparison && Object.keys(comparison.metrics_comparison).length > 0 && (
        <GlassCard title="Detailed Comparison" icon={<span style={{ fontSize: 11 }}>📊</span>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(comparison.metrics_comparison).map(([key, text]) => (
              <div key={key}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4 }}>
                  {metricLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{text}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Strengths & Weaknesses */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stocks.length}, 1fr)`, gap: 16 }}>
        {stocks.map((s) => (
          <GlassCard key={s.symbol} title={s.symbol} subtitle="Strengths & Weaknesses">
            {comparison.strengths?.[s.symbol]?.length ? (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Strengths</span>
                <ul style={{ paddingLeft: 16, marginTop: 6 }}>
                  {comparison.strengths[s.symbol].map((str, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>{str}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {comparison.weaknesses?.[s.symbol]?.length ? (
              <div>
                <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Weaknesses</span>
                <ul style={{ paddingLeft: 16, marginTop: 6 }}>
                  {comparison.weaknesses[s.symbol].map((str, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>{str}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </GlassCard>
        ))}
      </div>

      {/* AI Verdict */}
      {comparison.verdict && (
        <GlassCard title="AI Verdict" icon={<span style={{ fontSize: 11 }}>🎯</span>}>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {comparison.verdict}
          </p>
        </GlassCard>
      )}
    </div>
  );
}
