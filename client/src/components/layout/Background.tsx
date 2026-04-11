export default function Background() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />
      {/* Blue orb */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          animation: 'float 20s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      {/* Violet orb */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
          animation: 'float 25s ease-in-out infinite 5s',
          willChange: 'transform',
        }}
      />
    </div>
  );
}
