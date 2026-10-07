import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { fmtNum } from '../../lib/format';

/** أرقام الواجهة الكبيرة بخط متناسب (لا tabular) — الأعمدة المحاذاة وحدها تستخدم tabular */
export function CountUp({ value, format = (n: number) => fmtNum(Math.round(n)), duration = 0.9, tabular = false }: { value: number; format?: (n: number) => string; duration?: number; tabular?: boolean }) {
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
  return <span className={tabular ? 'num' : undefined}>{format(shown)}</span>;
}
