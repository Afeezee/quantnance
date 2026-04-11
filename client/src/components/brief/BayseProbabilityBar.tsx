import { useEffect, useState } from 'react';

interface BayseProbabilityBarProps {
  yesLabel: string;
  yesPercent: number;
  noLabel: string;
  noPercent: number;
  confidence: string;
}

export default function BayseProbabilityBar({
  yesLabel,
  yesPercent,
  noLabel,
  noPercent,
  confidence,
}: BayseProbabilityBarProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const barStyle = (color: string, percent: number): React.CSSProperties => ({
    height: 32,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 500,
    color: '#fff',
    background: color,
    width: animated ? `${Math.max(percent, 8)}%` : '0%',
    transition: 'width 800ms ease-out',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 6 }}>
        <div style={barStyle('#10b981', yesPercent)}>
          <span>{yesLabel}</span>
          <span className="font-mono">{yesPercent.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={barStyle('#ef4444', noPercent)}>
          <span>{noLabel}</span>
          <span className="font-mono">{noPercent.toFixed(1)}%</span>
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 12,
          background: confidence === 'High' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
          color: confidence === 'High' ? 'var(--accent-blue)' : 'var(--text-muted)',
          fontWeight: 500,
        }}
      >
        {confidence} Confidence
      </span>
    </div>
  );
}
