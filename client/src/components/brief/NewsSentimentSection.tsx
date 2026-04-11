import type { SentimentResult, NewsArticle } from '../../hooks/useBrief';
import GlassCard from '../shared/GlassCard';
import MetricBadge from '../shared/MetricBadge';
import SentimentGauge from './SentimentGauge';
import AnimatedNumber from '../shared/AnimatedNumber';

interface NewsSentimentSectionProps {
  sentiment: SentimentResult | null;
  news: NewsArticle[] | null;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NewsSentimentSection({ sentiment, news }: NewsSentimentSectionProps) {
  const sentimentType =
    sentiment?.overall_sentiment === 'Bullish'
      ? 'bullish'
      : sentiment?.overall_sentiment === 'Bearish'
        ? 'bearish'
        : 'neutral';

  return (
    <GlassCard
      title="News Sentiment"
      icon={<span style={{ fontSize: 11 }}>📰</span>}
      animationDelay={100}
    >
      {/* Overall sentiment badge */}
      <div style={{ marginBottom: 20 }}>
        <MetricBadge type={sentimentType} size="lg" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left column: Gauge + AI */}
        <div style={{ minWidth: 0 }}>
          <SentimentGauge score={sentiment?.sentiment_score ?? 0} />
          <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
            <AnimatedNumber
              value={sentiment?.sentiment_score}
              decimals={2}
              style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>/ 1.0</span>
          </div>

          {/* Reasoning */}
          {sentiment?.reasoning && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              {sentiment.reasoning}
            </p>
          )}

          {/* Key themes */}
          {sentiment?.key_themes && sentiment.key_themes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Key Themes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sentiment.key_themes.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: 'rgba(59,130,246,0.12)',
                      color: 'var(--accent-blue)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk flags */}
          {sentiment?.risk_flags && sentiment.risk_flags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Risk Flags</div>
              {sentiment.risk_flags.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 2 }}>⚠ {r}</div>
              ))}
            </div>
          )}

          {/* Opportunity signals */}
          {sentiment?.opportunity_signals && sentiment.opportunity_signals.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Opportunities</div>
              {sentiment.opportunity_signals.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--success)', marginBottom: 2 }}>✦ {s}</div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: News articles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {(!news || news.length === 0) && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No recent news found.</div>
          )}
          {news?.slice(0, 6).map((article, idx) => (
            <a
              key={idx}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
            >
              {article.url_to_image && (
                <img
                  src={article.url_to_image}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.4,
                    marginBottom: 4,
                  }}
                >
                  {article.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {article.source_name}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {article.published_at ? timeAgo(article.published_at) : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>↗</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
