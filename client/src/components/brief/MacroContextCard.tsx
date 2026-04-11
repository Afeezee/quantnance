import type { BriefContent } from '../../hooks/useBrief';
import { useBayseSocket } from '../../hooks/useBayseSocket';
import GlassCard from '../shared/GlassCard';

interface MacroContextCardProps {
  brief: BriefContent | null;
}

function parseEnvironmentLevel(commentary: string, keyword: string): 'Low' | 'Medium' | 'High' {
  const lower = commentary.toLowerCase();
  const kw = keyword.toLowerCase();
  if (lower.includes(`high ${kw}`) || lower.includes(`${kw} high`) || lower.includes(`rising ${kw}`) || lower.includes(`elevated ${kw}`)) return 'High';
  if (lower.includes(`low ${kw}`) || lower.includes(`${kw} low`) || lower.includes(`declining ${kw}`) || lower.includes(`subdued ${kw}`)) return 'Low';
  return 'Medium';
}

const LEVEL_WIDTH: Record<string, number> = { Low: 30, Medium: 55, High: 85 };
const LEVEL_COLOR: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };

export default function MacroContextCard({ brief }: MacroContextCardProps) {
  const { prices, connected } = useBayseSocket();
  const usdNgn = prices['USDNGN']?.price;

  const commentary = brief?.macroeconomic_context?.commentary || '';
  const inflation = parseEnvironmentLevel(commentary, 'inflation');
  const interest = parseEnvironmentLevel(commentary, 'interest');
  const growth = parseEnvironmentLevel(commentary, 'growth');

  const indicators = [
    { label: 'Inflation', level: inflation },
    { label: 'Interest Rate', level: interest },
    { label: 'Growth', level: growth },
  ];

  return (
    <GlassCard
      title="Macro Context"
      icon={<span style={{ fontSize: 11 }}>🌍</span>}
      animationDelay={300}
    >
      {/* Live USD/NGN */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          padding: 12,
          borderRadius: 10,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.15)',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>USD/NGN</span>
        <span className="font-mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          ₦{usdNgn != null ? usdNgn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? 'var(--success)' : 'var(--danger)',
            animation: connected ? 'pulse-glow 2s infinite' : 'none',
          }}
          title={connected ? 'Live' : 'Offline'}
        />
        <span style={{ fontSize: 10, color: connected ? 'var(--success)' : 'var(--text-muted)' }}>
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Commentary */}
      {commentary && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
          {commentary}
        </p>
      )}

      {/* Sector outlook */}
      {brief?.macroeconomic_context?.sector_outlook && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          {brief.macroeconomic_context.sector_outlook}
        </p>
      )}

      {/* Environment indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {indicators.map((ind) => (
          <div key={ind.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>{ind.label}</span>
              <span style={{ color: LEVEL_COLOR[ind.level], fontWeight: 500 }}>{ind.level}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  width: `${LEVEL_WIDTH[ind.level]}%`,
                  background: LEVEL_COLOR[ind.level],
                  transition: 'width 0.8s ease-out',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
