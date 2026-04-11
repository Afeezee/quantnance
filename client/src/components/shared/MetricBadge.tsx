interface MetricBadgeProps {
  type: 'bullish' | 'bearish' | 'neutral' | 'risk-low' | 'risk-medium' | 'risk-high' | 'risk-very-high';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  bullish: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Bullish' },
  bearish: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Bearish' },
  neutral: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Neutral' },
  'risk-low': { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Low Risk' },
  'risk-medium': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Medium Risk' },
  'risk-high': { bg: 'rgba(249,115,22,0.15)', color: '#f97316', label: 'High Risk' },
  'risk-very-high': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Very High Risk' },
};

const SIZES = {
  sm: { fontSize: 11, padding: '2px 8px' },
  md: { fontSize: 13, padding: '4px 12px' },
  lg: { fontSize: 15, padding: '6px 16px' },
};

export default function MetricBadge({ type, label, size = 'md' }: MetricBadgeProps) {
  const style = BADGE_STYLES[type] || BADGE_STYLES.neutral;
  const sizeStyle = SIZES[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: style.bg,
        color: style.color,
        borderRadius: 20,
        fontWeight: 600,
        fontSize: sizeStyle.fontSize,
        padding: sizeStyle.padding,
        lineHeight: 1.4,
      }}
    >
      {label || style.label}
    </span>
  );
}
