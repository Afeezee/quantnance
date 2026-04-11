export default function SkeletonLoader() {
  const shimmerBlock = (w: string, h: number, mb: number = 16) => (
    <div className="shimmer" style={{ width: w, height: h, marginBottom: mb }} />
  );

  return (
    <div className="brief-layout" style={{ paddingTop: 24 }}>
      {/* Asset overview skeleton */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          {shimmerBlock('200px', 28, 0)}
          {shimmerBlock('80px', 20, 0)}
        </div>
        {shimmerBlock('160px', 40)}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ flex: 1 }}>
              {shimmerBlock('100%', 14, 8)}
              {shimmerBlock('70%', 20, 0)}
            </div>
          ))}
        </div>
        {shimmerBlock('100%', 300)}
      </div>

      {/* Two column skeleton */}
      <div className="two-col-grid">
        <div className="glass-card" style={{ padding: 24 }}>
          {shimmerBlock('140px', 22)}
          {shimmerBlock('100%', 120)}
          {shimmerBlock('100%', 60)}
        </div>
        <div className="glass-card" style={{ padding: 24 }}>
          {shimmerBlock('160px', 22)}
          {shimmerBlock('100%', 80)}
          {shimmerBlock('100%', 80)}
        </div>
      </div>

      {/* Metrics skeleton */}
      <div className="glass-card" style={{ padding: 24 }}>
        {shimmerBlock('180px', 22)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i}>
              {shimmerBlock('80%', 14, 8)}
              {shimmerBlock('60%', 24, 0)}
            </div>
          ))}
        </div>
      </div>

      {/* Two column skeleton */}
      <div className="two-col-grid">
        <div className="glass-card" style={{ padding: 24 }}>
          {shimmerBlock('120px', 22)}
          {shimmerBlock('100%', 100)}
        </div>
        <div className="glass-card" style={{ padding: 24 }}>
          {shimmerBlock('120px', 22)}
          {shimmerBlock('100%', 100)}
        </div>
      </div>

      {/* Verdict skeleton */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-violet))',
            marginBottom: 24,
            borderRadius: 2,
          }}
        />
        {shimmerBlock('100px', 18)}
        {shimmerBlock('100%', 60)}
        {shimmerBlock('100%', 80)}
      </div>
    </div>
  );
}
