interface SentimentGaugeProps {
  score: number;
}

export default function SentimentGauge({ score }: SentimentGaugeProps) {
  // score: -1 (bearish) to +1 (bullish)
  // needle angle: -90° (left, -1) to +90° (right, +1)
  const angle = score * 90;

  return (
    <div style={{ width: 200, height: 110, margin: '0 auto', position: 'relative' }}>
      <svg viewBox="0 0 200 110" width={200} height={110}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        {/* Arc */}
        <path
          d="M 15 100 A 85 85 0 0 1 185 100"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={100}
          y1={100}
          x2={100}
          y2={25}
          stroke="#f1f5f9"
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            transformOrigin: '100px 100px',
            transform: `rotate(${angle}deg)`,
            transition: 'transform 1s ease-out',
          }}
        />
        {/* Center dot */}
        <circle cx={100} cy={100} r={5} fill="#f1f5f9" />
      </svg>
      {/* Labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        <span>Bearish</span>
        <span>Neutral</span>
        <span>Bullish</span>
      </div>
    </div>
  );
}
