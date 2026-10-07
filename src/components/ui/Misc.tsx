import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './Button';

export function EmptyState({ icon = <Inbox size={34} />, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="empty">
      <motion.div className="ill" initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
        {icon}
      </motion.div>
      <h3>{title}</h3>
      {text && <p style={{ maxWidth: 380 }}>{text}</p>}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="grow">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Progress({ value, max = 100, c1, c2, size }: { value: number; max?: number; c1?: string; c2?: string; size?: 'thin' | 'thick' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`progress ${size ?? ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.i
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{ ['--_c1' as string]: c1, ['--_c2' as string]: c2 }}
      />
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

/** تحريك دخول متتابع لعناصر القوائم */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
export const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } },
};
