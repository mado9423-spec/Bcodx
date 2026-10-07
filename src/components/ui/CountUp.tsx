import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { fmtNum } from '../../lib/format';

export function CountUp({ value, format = (n: number) => fmtNum(Math.round(n)), duration = 0.9 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const prev = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      prev.current = value;
      return;
    }
    const c = animate(prev.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        prev.current = v;
        setShown(v);
      },
    });
    return () => c.stop();
  }, [value, duration, reduce]);
  return <span className="num">{format(shown)}</span>;
}
