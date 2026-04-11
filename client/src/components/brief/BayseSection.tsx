import type { BayseSentiment, BriefContent } from '../../hooks/useBrief';
import GlassCard from '../shared/GlassCard';
import BayseProbabilityBar from './BayseProbabilityBar';

interface BayseSectionProps {
  bayse: BayseSentiment | null;
  brief: BriefContent | null;
}

export default function BayseSection({ bayse, brief }: BayseSectionProps) {
  return (
    <GlassCard
      title="Crowd Intelligence"
      subtitle="Powered by Bayse"
      icon={<span style={{ fontSize: 11 }}>🔮</span>}
      animationDelay={200}
    >
      {/* Bayse badge link */}
      <div style={{ marginBottom: 16 }}>
        <a
          href="https://bayse.markets"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            color: 'var(--accent-blue)',
            textDecoration: 'none',
            background: 'rgba(59,130,246,0.1)',
            padding: '3px 10px',
            borderRadius: 12,
          }}
        >
          bayse.markets ↗
        </a>
      </div>

      {bayse?.available ? (
        <>
          {bayse.event_title && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                {bayse.event_title}
              </h4>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                {bayse.category && (
                  <span
                    style={{
                      background: 'var(--glow-blue)',
                      color: 'var(--accent-violet)',
                      padding: '2px 8px',
                      borderRadius: 8,
                    }}
                  >
                    {bayse.category}
                  </span>
                )}
                {bayse.closing_date && <span>Closes: {new Date(bayse.closing_date).toLocaleDateString()}</span>}
              </div>
            </div>
          )}

          <BayseProbabilityBar
            yesLabel={bayse.outcome1_label || 'Yes'}
            yesPercent={bayse.outcome1_price || 50}
            noLabel={bayse.outcome2_label || 'No'}
            noPercent={bayse.outcome2_price || 50}
            confidence={bayse.crowd_confidence || 'Low'}
          />

          {bayse.event_slug && (
            <a
              href={`https://bayse.markets/events/${bayse.event_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginTop: 12,
                padding: '8px 0',
                textAlign: 'center',
                borderRadius: 8,
                background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-blue))',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Vote on Bayse ↗
            </a>
          )}
        </>
      ) : (
        <div
          style={{
            padding: 28,
            textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
            No active prediction market found for this asset.
          </p>
          <a
            href="https://bayse.markets/create"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-blue))',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Create a market on Bayse ↗
          </a>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
            Be the first to get crowd wisdom on this stock
          </p>
        </div>
      )}

      {/* AI commentary */}
      {brief?.crowd_intelligence?.commentary && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {brief.crowd_intelligence.commentary}
          </p>
          {brief.crowd_intelligence.reliability_note && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
              {brief.crowd_intelligence.reliability_note}
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
