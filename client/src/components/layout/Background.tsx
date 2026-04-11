export default function Background() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
        transition: 'background 0.4s ease',
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />
      {/* Primary orb */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, var(--orb-1) 0%, transparent 70%)`,
          animation: 'float 20s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      {/* Secondary orb */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, var(--orb-2) 0%, transparent 70%)`,
          animation: 'float 25s ease-in-out infinite 5s',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
