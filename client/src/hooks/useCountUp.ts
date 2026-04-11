import { useEffect, useRef, useState } from 'react';

export function useCountUp(
  target: number | null | undefined,
  duration: number = 1000,
  decimals: number = 2
): number | null {
  const rafId = useRef<number>(0);
  const [value, setValue] = useState<number | null>(
    () => (target == null || isNaN(target)) ? null : target
  );

  useEffect(() => {
    if (target == null || isNaN(target)) {
      setValue(null);
      return;
    }

    const startVal = value ?? 0;
    const end = target;

    // If no meaningful difference, just set directly
    if (Math.abs(end - startVal) < 0.001) {
      setValue(end);
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (end - startVal) * eased;
      setValue(parseFloat(current.toFixed(decimals)));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals]);

  return value;
}
