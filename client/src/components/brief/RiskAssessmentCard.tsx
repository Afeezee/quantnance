import type { BriefContent } from '../../hooks/useBrief';
import GlassCard from '../shared/GlassCard';

interface RiskAssessmentCardProps {
  brief: BriefContent | null;
  volatility: number;
}

const RISK_COLORS: Record<string, string> = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#f97316',
  'Very High': '#ef4444',
};

export default function RiskAssessmentCard({ brief, volatility }: RiskAssessmentCardProps) {
  const risk = brief?.risk_assessment;
  const level = risk?.overall_risk_level || 'Medium';
  const color = RISK_COLORS[level] || RISK_COLORS.Medium;

  return (
    <GlassCard
      title="Risk Assessment"
      icon={<span style={{ fontSize: 11 }}>⚠</span>}
      animationDelay={300}
    >
      {/* Risk level badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 20px',
          borderRadius: 24,
          background: `${color}20`,
          color: color,
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 20,
          boxShadow: `0 0 20px ${color}30`,
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        {level} Risk
      </div>

      {/* Volatility */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>30-Day Volatility</div>
        <span className="font-mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
          {(volatility * 100).toFixed(2)}%
        </span>
      </div>

      {/* Volatility commentary */}
      {risk?.volatility_commentary && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
          {risk.volatility_commentary}
        </p>
      )}

      {/* Key risks */}
      {risk?.key_risks && risk.key_risks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Key Risk Factors</div>
          {risk.key_risks.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginBottom: 6,
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ color: 'var(--warning)', flexShrink: 0 }}>⚠</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Nigerian investor context */}
      {risk?.nigerian_investor_context && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            🇳🇬 Nigerian Investor Context
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            {risk.nigerian_investor_context}
          </p>
        </div>
      )}
    </GlassCard>
  );
}
