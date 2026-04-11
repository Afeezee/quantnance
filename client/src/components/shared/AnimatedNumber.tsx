import { useCountUp } from '../../hooks/useCountUp';

interface AnimatedNumberProps {
  value: number | null | undefined;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function AnimatedNumber({
  value,
  duration = 1000,
  decimals = 2,
  prefix = '',
  suffix = '',
  className = '',
  style,
}: AnimatedNumberProps) {
  const animated = useCountUp(value, duration, decimals);

  if (value == null || isNaN(value)) {
    return (
      <span className={`font-mono ${className}`} style={style}>
        --
      </span>
    );
  }

  return (
    <span className={`font-mono ${className}`} style={style}>
      {prefix}
      {animated != null ? animated.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) : '--'}
      {suffix}
    </span>
  );
}
