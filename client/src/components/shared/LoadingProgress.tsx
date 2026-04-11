import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Fetching market data', detail: 'Quote, chart history & company overview', duration: 4000 },
  { label: 'Loading news & predictions', detail: 'NewsAPI & Bayse prediction markets', duration: 3000 },
  { label: 'Analysing sentiment', detail: 'Running Llama 3.3-70B on latest headlines', duration: 5000 },
  { label: 'Generating investment brief', detail: 'AI writing full qualitative analysis', duration: 8000 },
];

interface LoadingProgressProps {
  symbol?: string;
}

export default function LoadingProgress({ symbol }: LoadingProgressProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setActiveStep(0);
    setProgress(0);
  }, [symbol]);

  // Advance through steps based on cumulative durations
  useEffect(() => {
    if (activeStep >= STEPS.length - 1) return;
    const t = setTimeout(() => {
      setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, STEPS[activeStep].duration);
    return () => clearTimeout(t);
  }, [activeStep]);

  // Animate progress bar within current step
  useEffect(() => {
    setProgress(0);
    const duration = STEPS[activeStep]?.duration ?? 5000;
    const interval = 50;
    const steps = duration / interval;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      // Ease-out: fill to 92% max within step (leaves room for "waiting" feel)
      const raw = tick / steps;
      const eased = 1 - Math.pow(1 - raw, 2);
      setProgress(Math.min(eased * 92, 92));
      if (tick >= steps) clearInterval(id);
    }, interval);
    return () => clearInterval(id);
  }, [activeStep]);

  // Overall progress across all steps
  const totalDuration = STEPS.reduce((a, s) => a + s.duration, 0);
  const completedDuration = STEPS.slice(0, activeStep).reduce((a, s) => a + s.duration, 0);
  const stepFraction = (progress / 100) * STEPS[activeStep].duration;
  const overallPct = Math.round(((completedDuration + stepFraction) / totalDuration) * 100);

  return (
    <div
      className="animate-fade-in-up"
      style={{
        maxWidth: 560,
        margin: '80px auto 0',
        padding: '0 16px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 24,
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        >
          ⚡
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
          Analysing{symbol ? <span className="text-gradient"> {symbol}</span> : ' asset'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Gathering data from multiple sources
        </p>
      </div>

      {/* Step list */}
      <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 24 }}>
        {STEPS.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;
          const isPending = i > activeStep;

          return (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                marginBottom: i < STEPS.length - 1 ? 20 : 0,
                opacity: isPending ? 0.35 : 1,
                transition: 'opacity 0.4s ease',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  flexShrink: 0,
                  marginTop: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  background: isDone
                    ? 'rgba(34,197,94,0.15)'
                    : isActive
                    ? 'rgba(59,130,246,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: isDone
                    ? '1px solid rgba(34,197,94,0.4)'
                    : isActive
                    ? '1px solid rgba(59,130,246,0.4)'
                    : '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.4s ease',
                }}
              >
                {isDone ? (
                  '✓'
                ) : isActive ? (
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                ) : (
                  `${i + 1}`
                )}
              </div>

              {/* Labels */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: isDone
                      ? 'rgba(34,197,94,0.9)'
                      : isActive
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                    marginBottom: 2,
                    transition: 'color 0.3s',
                  }}
                >
                  {step.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{step.detail}</div>

                {/* Per-step progress bar */}
                {isActive && (
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      background: 'rgba(255,255,255,0.07)',
                      marginTop: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 2,
                        background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-violet))',
                        width: `${progress}%`,
                        transition: 'width 0.05s linear',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall progress */}
      <div style={{ padding: '0 4px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          <span>Overall progress</span>
          <span>{overallPct}%</span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 2,
              background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-violet))',
              width: `${overallPct}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
          First load may take 20–30s · Subsequent searches are cached
        </p>
      </div>
    </div>
  );
}
