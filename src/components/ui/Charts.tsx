import { useId, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fmtCompact } from '../../lib/format';
import { useSize } from '../../lib/hooks';

/* ---------- مسار منحني ناعم (Catmull-Rom → Bézier) ---------- */
function smooth(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]![0]},${pts[0]![1]}`;
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    // تقييد نقطتي التحكم بين القيمتين لمنع تجاوز المنحنى (لا قيم سالبة وهمية)
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) * t));
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) * t));
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export interface Series {
  label: string;
  color: string;
  values: number[];
}

interface AreaProps {
  labels: string[];
  series: Series[];
  height?: number;
  format?: (n: number) => string;
  animKey?: string | number;
}

/** رسم بياني مساحي متحرك مع تلميح تفاعلي. الزمن من اليسار لليمين لقراءة الأرقام بسهولة. */
export function AreaChart({ labels, series, height = 260, format = fmtCompact, animKey }: AreaProps) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const W = Math.max(width, 200);
  const H = height;
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.08;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - padL) / 62))));

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="chart" style={{ height, direction: 'ltr' }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={W} height={H} role="img" aria-label="رسم بياني">
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.38" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={i === 0 ? '0' : '4 6'} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % step === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {l}
              </text>
            ) : null,
          )}
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = smooth(pts);
            const area = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
            return (
              <g key={`${animKey}-${si}`}>
                <motion.path d={area} fill={`url(#${uid}-g${si})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }} />
                <motion.path
                  d={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: si * 0.12 }}
                />
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--border-strong)" strokeDasharray="3 4" />
              {series.map((s, si) => (
                <circle key={si} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={5.5} fill="var(--surface)" stroke={s.color} strokeWidth={3} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover), 70), W - 70), direction: 'rtl' }}>
          <div className="chart-tip-title">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.label} className="chart-tip-row">
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <b className="num">{format(s.values[hover] ?? 0)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- شرائط أفقية ---------- */
export interface BarItem {
  label: ReactNode;
  value: number;
  color?: string;
  sub?: ReactNode;
  display?: string;
}

export function BarList({ items, max, format = fmtCompact }: { items: BarItem[]; max?: number; format?: (n: number) => string }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="barlist">
      {items.map((it, i) => (
        <div key={i} className="barlist-row">
          <div className="barlist-top">
            <span className="barlist-label">{it.label}</span>
            <b className="num">{it.display ?? format(it.value)}</b>
          </div>
          <div className="progress thick">
            <motion.i
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, (it.value / m) * 100)}%` }}
              transition={{ duration: 0.9, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              style={it.color ? { background: `linear-gradient(90deg, ${it.color}, color-mix(in srgb, ${it.color} 65%, #fff))` } : undefined}
            />
          </div>
          {it.sub && <div className="muted xs">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ---------- دونات ---------- */
export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function Donut({ segments, size = 180, stroke = 22, children }: { segments: Segment[]; size?: number; stroke?: number; children?: ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * C;
            const gap = segments.filter((x) => x.value > 0).length > 1 ? 3 : 0;
            const dash = Math.max(0, len - gap);
            const off = -acc;
            acc += len;
            return (
              <motion.circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDashoffset={off}
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${dash} ${C - dash}` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  );
}

/* ---------- حلقة تقدّم ---------- */
export function Ring({ value, max, size = 92, stroke = 10, color = 'var(--brand)', color2, children }: { value: number; max: number; size?: number; stroke?: number; color?: string; color2?: string; children?: ReactNode }) {
  const uid = useId().replace(/:/g, '');
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color2 ?? color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${uid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/* ---------- خط مصغّر ---------- */
export function Sparkline({ values, color = 'var(--brand)', width = 96, height = 36 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const uid = useId().replace(/:/g, '');
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 4 - ((v - min) / span) * (height - 8)] as [number, number]);
  const line = smooth(pts);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ direction: 'ltr' }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${uid})`} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
    </svg>
  );
}

/* ---------- شريط مجزّأ (أعمار الديون) ---------- */
export function StackBar({ segments, height = 12 }: { segments: Segment[]; height?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="stackbar" style={{ height }} role="img" aria-label="توزيع الديون حسب العمر">
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <motion.i
              key={s.label}
              title={s.label}
              style={{ background: s.color }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: s.value / total }}
              transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
    </div>
  );
}
