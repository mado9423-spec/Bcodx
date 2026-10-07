import { useEffect, useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, Table2 } from 'lucide-react';
import { AGING_BUCKETS, type Aging } from '../../lib/aging';
import { fmtCompact, fmtPct, type MoneyFn } from '../../lib/format';
import { useSize } from '../../lib/hooks';
import { niceScale } from '../../lib/scale';
import { rise } from './Misc';

/*
 * مواصفات الرسوم (مهارة dataviz):
 *  - علامات رفيعة: خط 2px، أشرطة ≤ 24px بنهاية مستديرة 4px، نقاط ≥ 8px بحلقة 2px بلون السطح
 *  - الشبكة والمحاور: خطوط صلبة رفيعة (hairline) وليست متقطعة
 *  - وسيلة إيضاح عند ≥ 2 سلسلة (قابلة للعزل) + تسميات حدّية انتقائية؛ النص بألوان النص لا ألوان السلسلة
 *  - لكل رسم جدول بديل، والتلميح لا يكون الطريق الوحيد للقيمة (يعمل بلوحة المفاتيح أيضًا)
 */

/* ---------- مسار منحني ناعم (Catmull-Rom → Bézier) بلا تجاوز للقيم ---------- */
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
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    // تقييد نقطتي التحكم بين القيمتين: لا قيم وهمية تحت الصفر ولا قمم زائفة
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) * t));
    const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) * t));
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${c1y} ${p2[0] - (p3[0] - p1[0]) * t},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* ---------- بطاقة الرسم: عنوان + عناصر تحكم + تبديل «مخطط / جدول» ---------- */
export interface ChartTableData {
  head: string[];
  rows: ReactNode[][];
}

export function ChartTable({ head, rows }: ChartTableData) {
  return (
    <div className="chart-table table-wrap">
      <table className="table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i > 0 ? 'num' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j > 0 ? 'num' : ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartCard({
  title, icon, controls, table, children, className = '',
}: {
  title: ReactNode;
  icon?: ReactNode;
  controls?: ReactNode;
  table?: ChartTableData;
  children: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <motion.section variants={rise} className={`card chart-card ${className}`}>
      <div className="card-head">
        <h3>
          {icon && <span className="ico">{icon}</span>}
          {title}
        </h3>
        <div className="row" style={{ gap: 8 }}>
          {controls}
          {table && (
            <div className="view-toggle" role="group" aria-label="طريقة العرض">
              <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')} title="مخطط">
                <BarChart3 size={15} />
                <span className="sr-only">مخطط</span>
              </button>
              <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} title="جدول">
                <Table2 size={15} />
                <span className="sr-only">جدول</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="card-body">{view === 'table' && table ? <ChartTable {...table} /> : children}</div>
    </motion.section>
  );
}

/* ---------- مخطط مساحي متحرك ---------- */
export interface Series {
  key: string;
  label: string;
  /** لون السلسلة (متغير CSS مُدقَّق) — يتبع الكيان لا ترتيبه */
  color: string;
  values: number[];
  /** ملخص يظهر بجانب اسم السلسلة في وسيلة الإيضاح (مثل الإجمالي) */
  summary?: string;
}

interface AreaProps {
  labels: string[];
  series: Series[];
  height?: number;
  format?: (n: number) => string;
  animKey?: string | number;
  ariaLabel?: string;
}

export function AreaChart({ labels, series, height = 264, format = fmtCompact, animKey, ariaLabel = 'رسم بياني' }: AreaProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = series.filter((s) => !hidden.has(s.key));
  const n = labels.length;
  const padL = 46;
  const padR = 16;
  const padT = 24;
  const padB = 28;
  const W = Math.max(width, 240);
  const H = height;
  const { max, ticks } = niceScale(Math.max(1, ...visible.flatMap((s) => s.values)));
  const x = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  // تسميات المحور تُثبَّت من النهاية فيظهر آخر تاريخ دائمًا دون تصادم
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - padL - padR) / 66))));

  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else if (visible.length > 1) next.add(key); // لا نسمح بإخفاء الأخيرة
      return next;
    });

  const idxFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - padL) / (W - padL - padR)) * (n - 1));
    return Math.min(n - 1, Math.max(0, i));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? n - 2) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? 1) - 1));
    else if (e.key === 'Home') setHover(0);
    else if (e.key === 'End') setHover(n - 1);
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  // تسميات الطرف: القيمة الأخيرة لكل سلسلة، مع إزاحة إن تقاربت
  const endLabels = (() => {
    const items = visible.map((s) => ({ s, y: y(s.values[n - 1] ?? 0) - 11 })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i]!.y - items[i - 1]!.y < 16) items[i]!.y = items[i - 1]!.y + 16;
    return items;
  })();

  return (
    <div className="viz">
      {series.length >= 2 && (
        <div className="viz-legend" role="group" aria-label="وسيلة الإيضاح — اضغط لعزل سلسلة">
          {series.map((s) => (
            <button key={s.key} type="button" aria-pressed={!hidden.has(s.key)} onClick={() => toggle(s.key)}>
              <i className="key-rect" style={{ background: s.color }} />
              <span>{s.label}</span>
              {s.summary && <b className="num">{s.summary}</b>}
            </button>
          ))}
        </div>
      )}
      <div
        ref={ref}
        className="chart"
        style={{ height, direction: 'ltr' }}
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel} — استخدم الأسهم لاستعراض القيم`}
        onPointerMove={(e) => setHover(idxFromPointer(e))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onFocus={() => setHover((h) => h ?? n - 1)}
        onBlur={() => setHover(null)}
      >
        {width > 0 && (
          <svg width={W} height={H} aria-hidden>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth={1} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--chart-label)">
                  {format(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              (n - 1 - i) % step === 0 ? (
                <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--chart-label)">
                  {l}
                </text>
              ) : null,
            )}
            {visible.map((s, si) => {
              const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
              const line = smooth(pts);
              const area = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;
              return (
                <g key={`${animKey}-${s.key}`}>
                  <motion.path d={area} fill={s.color} fillOpacity={0.1} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.7 }} />
                  <motion.path
                    className={`s-line s-line-${series.indexOf(s)}`}
                    d={line}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: si * 0.1 }}
                  />
                  <motion.circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.95 + si * 0.1, type: 'spring', stiffness: 400, damping: 16 }} style={{ transformOrigin: `${x(n - 1)}px ${y(s.values[n - 1] ?? 0)}px` }} />
                </g>
              );
            })}
            {hover === null &&
              endLabels.map(({ s, y: ly }) => (
                <text key={s.key} x={x(n - 1)} y={Math.max(12, ly)} textAnchor="end" fontSize="12" fontWeight={800} fill="var(--text)">
                  {format(s.values[n - 1] ?? 0)}
                </text>
              ))}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={padT - 4} y2={H - padB} stroke="var(--chart-axis)" strokeWidth={1} />
                {visible.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div className="chart-tip" style={{ left: Math.min(Math.max(x(hover), 84), W - 84), direction: 'rtl' }} id={`${uid}-tip`}>
            <div className="chart-tip-title">{labels[hover]}</div>
            {visible.map((s) => (
              <div key={s.key} className="chart-tip-row">
                <i className="key-line" style={{ background: s.color }} />
                <span>{s.label}</span>
                <b className="num">{format(s.values[hover] ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite">
        {hover !== null && `${labels[hover]}: ${visible.map((s) => `${s.label} ${format(s.values[hover] ?? 0)}`).join('، ')}`}
      </div>
    </div>
  );
}

/* ---------- شرائط أفقية رفيعة: القيمة عند طرف الشريط ---------- */
export interface BarItem {
  label: ReactNode;
  value: number;
  display?: string;
  /** لون الكيان إن كان له هوية ثابتة؛ الافتراضي لون السلسلة الأولى (سلسلة واحدة = لون واحد) */
  color?: string;
  sub?: ReactNode;
}

export function BarList({ items, max, format = fmtCompact }: { items: BarItem[]; max?: number; format?: (n: number) => string }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value));
  const [mounted, setMounted] = useState(false);
  // تشغيل انتقال النمو من خط الأساس بعد أول رسم
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="bl">
      {items.map((it, i) => {
        const p = mounted ? Math.max(0.015, it.value / m) : 0;
        return (
          <div key={i} className="bl-row">
            <div className="bl-label">
              {it.label}
              {it.sub && <span className="muted xs">{it.sub}</span>}
            </div>
            <div className="bl-track">
              <i className="bl-bar" style={{ ['--p' as string]: p, ['--d' as string]: `${i * 60}ms`, background: it.color ?? 'var(--chart-1)' }} />
              <b className="bl-val num">{it.display ?? format(it.value)}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- أعمار الديون: شريط مجزّأ رتبي (لون واحد، الأقدم أبرز) + جدول قيم ---------- */
export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function StackBar({ segments, height = 10 }: { segments: Segment[]; height?: number }) {
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

export function AgingBreakdown({ aging, money }: { aging: Aging; money: MoneyFn }) {
  const [active, setActive] = useState<string | null>(null);
  const rows = AGING_BUCKETS.map((b) => ({ ...b, value: aging[b.key] }));
  const total = aging.total;
  const overduePct = total > 0 ? (aging.overdue / total) * 100 : 0;
  return (
    <div className="aging">
      <div className="aging-head">
        <div>
          <div className="muted small">إجمالي الديون القائمة</div>
          <div className="aging-total">{money(Math.round(total))}</div>
        </div>
        <div className={`aging-chip ${aging.overdue > 0.005 ? 'bad' : 'ok'}`}>
          {aging.overdue > 0.005 ? `متأخر ${fmtPct(overduePct)} • ${money(Math.round(aging.overdue), { compact: true })}` : 'لا متأخرات'}
        </div>
      </div>
      <div className="aging-bar" role="img" aria-label="توزيع الديون حسب العمر">
        {rows
          .filter((r) => r.value > 0.005)
          .map((r, i) => (
            <motion.button
              key={r.key}
              type="button"
              className={`aging-seg ${active === r.key ? 'on' : ''}`}
              style={{ background: r.color }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: r.value / total }}
              transition={{ duration: 0.8, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              onPointerEnter={() => setActive(r.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(r.key)}
              onBlur={() => setActive(null)}
              aria-label={`${r.label}: ${money(Math.round(r.value))}`}
            />
          ))}
      </div>
      <ul className="aging-list">
        {rows.map((r) => (
          <li key={r.key} className={active === r.key ? 'on' : ''} onPointerEnter={() => setActive(r.key)} onPointerLeave={() => setActive(null)}>
            <i className="key-rect" style={{ background: r.color }} />
            <span>{r.label}</span>
            <b className="num">{money(Math.round(r.value), { compact: true })}</b>
            <span className="muted num">{total > 0 ? fmtPct((r.value / total) * 100) : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- حلقة تقدّم (عدّاد): المسار درجة أفتح من اللون نفسه ---------- */
export function Ring({ value, max, size = 92, stroke = 10, color = 'var(--chart-1)', color2, children }: { value: number; max: number; size?: number; stroke?: number; color?: string; color2?: string; children?: ReactNode }) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        {color2 && (
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
        )}
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`color-mix(in srgb, ${color} 16%, var(--surface))`} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color2 ? `url(#${uid})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={reduce ? false : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/* ---------- خط مصغّر: 12 نقطة بلون خافت، والفترة الحالية بلون التمييز ---------- */
export function Sparkline({ values, color = 'var(--chart-1)', width = 96, height = 36 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const v = values.slice(-12);
  if (v.length < 2) return null;
  const max = Math.max(1, ...v);
  const min = Math.min(...v);
  const span = Math.max(1, max - min);
  const pts = v.map((val, i) => [(i / (v.length - 1)) * (width - 8) + 4, height - 6 - ((val - min) / span) * (height - 12)] as [number, number]);
  const last = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ direction: 'ltr' }}>
      <motion.path d={smooth(pts)} fill="none" stroke="var(--chart-axis)" strokeWidth={2} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
      <path d={`M${prev[0]},${prev[1]} L${last[0]},${last[1]}`} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
