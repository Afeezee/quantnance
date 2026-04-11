import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PricePoint } from '../../hooks/useBrief';

interface PriceChartProps {
  data: PricePoint[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(13,22,40,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 13,
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{p.dataKey === 'close' ? 'Price' : 'Volume'}</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {p.dataKey === 'close'
              ? `$${p.value?.toFixed(2)}`
              : p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PriceChart({ data }: PriceChartProps) {
  if (!data.length) {
    return (
      <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No price data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: '#475569', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          tick={{ fill: '#475569', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => `$${v}`}
        />
        <YAxis yAxisId="volume" orientation="left" hide />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          yAxisId="volume"
          dataKey="volume"
          fill="rgba(139,92,246,0.25)"
          isAnimationActive={true}
          animationDuration={1500}
        />
        <Area
          yAxisId="price"
          type="monotone"
          dataKey="close"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={true}
          animationDuration={1500}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
