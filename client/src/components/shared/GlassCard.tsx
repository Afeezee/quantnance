import type { ReactNode, MouseEvent } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  animationDelay?: number;
  style?: React.CSSProperties;
}

export default function GlassCard({
  children,
  className = '',
  title,
  subtitle,
  icon,
  animationDelay,
  style,
}: GlassCardProps) {
  const delayClass = animationDelay != null ? `delay-${animationDelay}` : '';

  const handleRipple = (e: MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    ripple.className = 'ripple-effect';
    card.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  };

  return (
    <div
      className={`glass-card animate-fade-in-up btn-ripple ${delayClass} ${className}`}
      style={{ padding: 24, ...style }}
      onClick={handleRipple}
    >
      {(title || icon) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: subtitle ? 4 : 16,
          }}
        >
          {icon && (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          )}
          {title && (
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </span>
          )}
        </div>
      )}
      {subtitle && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            marginBottom: 16,
            marginTop: 0,
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
