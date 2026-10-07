import type { CSSProperties, ReactNode } from 'react';
import { initials } from '../../lib/format';

export type Tone = 'green' | 'blue' | 'amber' | 'orange' | 'red' | 'violet' | 'gray';

export function Badge({ tone = 'gray', dot, pulse, children, title }: { tone?: Tone; dot?: boolean; pulse?: boolean; children: ReactNode; title?: string }) {
  return (
    <span className={`badge ${tone === 'gray' ? '' : tone} ${pulse ? 'pulse' : ''}`} title={title}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function Avatar({ name, color, size, round, children }: { name: string; color?: string; size?: 'sm' | 'lg' | 'xl'; round?: boolean; children?: ReactNode }) {
  return (
    <span className={`avatar ${size ?? ''} ${round ? 'round' : ''}`} style={color ? ({ '--_c': color } as CSSProperties) : undefined} aria-hidden>
      {children ?? initials(name)}
    </span>
  );
}
