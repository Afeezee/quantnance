import type { CompanyOverview, BriefContent } from '../../hooks/useBrief';
import GlassCard from '../shared/GlassCard';
import AnimatedNumber from '../shared/AnimatedNumber';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface FinancialMetricsPanelProps {
  overview: CompanyOverview | null;
  brief: BriefContent | null;
}

const SECTOR_AVG_PE: Record<string, number> = {
  Technology: 30,
  'Consumer Cyclical': 22,
  Healthcare: 25,
  Financials: 14,
  Energy: 12,
  'Consumer Defensive': 24,
  Industrials: 20,
  'Communication Services': 18,
  Utilities: 17,
  'Real Estate': 35,
  'Basic Materials': 15,
};

function getMetricIndicator(value: number | null | undefined, benchmarkLow: number, benchmarkHigh: number) {
  if (value == null || value === 0) return null;
  if (value < benchmarkLow) return { color: 'var(--danger)', label: 'Below avg' };
  if (value > benchmarkHigh) return { color: 'var(--success)', label: 'Above avg' };
  return { color: 'var(--warning)', label: 'Average' };
}

export default function FinancialMetricsPanel({ overview, brief }: FinancialMetricsPanelProps) {
  const metrics = [
    { label: 'P/E Ratio', value: overview?.pe_ratio, decimals: 2 },
    { label: 'EPS', value: overview?.eps, decimals: 2, prefix: '$' },
    { label: 'Dividend Yield', value: overview?.dividend_yield ? overview.dividend_yield * 100 : null, decimals: 2, suffix: '%' },
    { label: 'Revenue Growth', value: overview?.revenue_growth ? overview.revenue_growth * 100 : null, decimals: 2, suffix: '%' },
    { label: 'Profit Margin', value: overview?.profit_margin ? overview.profit_margin * 100 : null, decimals: 2, suffix: '%' },
    { label: 'Beta', value: overview?.beta, decimals: 2 },
    { label: '50-Day MA', value: overview?.['50_day_ma'], decimals: 2, prefix: '$' },
    { label: '200-Day MA', value: overview?.['200_day_ma'], decimals: 2, prefix: '$' },
  ];

  const sectorAvg = SECTOR_AVG_PE[overview?.sector || ''] || 20;
  const peerData = [
    { name: overview?.name?.split(' ')[0] || 'Asset', pe: overview?.pe_ratio || 0 },
    { name: 'Sector Avg', pe: sectorAvg },
  ];

  return (
    <GlassCard
      title="Financial Metrics"
      icon={<span style={{ fontSize: 11 }}>📊</span>}
      animationDelay={200}
    >
      {/* Metrics grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {metrics.map((m) => {
          const indicator = m.label === 'P/E Ratio'
            ? getMetricIndicator(m.value, 12, 30)
            : m.label === 'Beta'
              ? getMetricIndicator(m.value, 0.8, 1.5)
              : null;

          return (
            <div
              key={m.label}
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                {m.label}
                {indicator && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: indicator.color, display: 'inline-block' }} title={indicator.label} />
                )}
              </div>
              <AnimatedNumber
                value={m.value}
                decimals={m.decimals}
                prefix={m.prefix}
                suffix={m.suffix}
                style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
              />
            </div>
          );
        })}
      </div>

      {/* AI commentary */}
      {brief?.asset_overview?.key_metrics_commentary && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
          {brief.asset_overview.key_metrics_commentary}
        </p>
      )}

      {/* Peer comparison bar chart */}
      {overview?.pe_ratio != null && overview.pe_ratio > 0 && (
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
            P/E Ratio vs Sector Average
          </h4>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={peerData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(13,22,40,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="pe" fill="#3b82f6" radius={[0, 6, 6, 0]} isAnimationActive={true} animationDuration={1500} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </GlassCard>
  );
}
