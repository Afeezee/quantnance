import type { RecommendationResult } from '../../hooks/useBrief';
import GlassCard from '../shared/GlassCard';

interface Props {
  data: RecommendationResult['recommendations'];
  onAnalyze: (prompt: string) => void;
}

export default function RecommendationView({ data, onAnalyze }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <GlassCard
        title={data.theme || 'Recommendations'}
        icon={<span style={{ fontSize: 11 }}>💡</span>}
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          {data.reasoning}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {data.stocks.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => onAnalyze(stock.symbol)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--card-border)',
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s, transform 0.2s',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--card-border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {stock.symbol}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stock.name}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {stock.rationale}
              </p>
              <span style={{
                display: 'inline-block', marginTop: 8, fontSize: 11,
                color: 'var(--accent-blue)', fontWeight: 600,
              }}>
                Analyze →
              </span>
            </button>
          ))}
        </div>

        <p style={{
          marginTop: 20, fontSize: 11, color: 'var(--text-muted)',
          fontStyle: 'italic', lineHeight: 1.5,
          padding: '10px 14px', background: 'rgba(255,255,255,0.02)',
          borderRadius: 8, borderLeft: '2px solid var(--warning)',
        }}>
          {data.disclaimer}
        </p>
      </GlassCard>
    </div>
  );
}
