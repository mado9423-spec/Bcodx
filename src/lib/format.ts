import { CURRENCIES, type CurrencyCode } from '../data/types';

const LOCALE = 'ar-EG-u-nu-latn';

export function fmtNum(n: number, digits = 0): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return fmtNum(Math.round(n));
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtPct(n: number, digits = 0): string {
  return `${fmtNum(n, digits)}%`;
}

export type MoneyFn = (n: number, opts?: { compact?: boolean; symbol?: boolean }) => string;

export function makeMoney(code: CurrencyCode): MoneyFn {
  const c = CURRENCIES[code];
  return (n, opts) => {
    const v = Math.abs(n) < 0.005 ? 0 : n;
    const body = opts?.compact ? fmtCompact(v) : fmtNum(v, Number.isInteger(v) ? 0 : Math.min(c.decimals, 2));
    return opts?.symbol === false ? body : `${body} ${c.symbol}`;
  };
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' });
const dateYearFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });

export const fmtDate = (ts: number) => dateFmt.format(ts);
export const fmtDateYear = (ts: number) => dateYearFmt.format(ts);
export const fmtTime = (ts: number) => timeFmt.format(ts);
export const fmtDateTime = (ts: number) => `${dateFmt.format(ts)} • ${timeFmt.format(ts)}`;
export const fmtWeekday = (ts: number) => weekdayFmt.format(ts);
export const fmtShortDate = (ts: number) => shortFmt.format(ts);

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

export function fmtAgo(ts: number, now = Date.now()): string {
  const diff = ts - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'الآن';
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), 'day');
  return rtf.format(Math.round(diff / (30 * 86_400_000)), 'month');
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'ليلة سعيدة';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'طاب يومك';
  if (h < 21) return 'مساء الخير';
  return 'مساء النور';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0]}${parts[1]![0]}`;
}

/** تحويل الأرقام الهندية/الفارسية إلى لاتينية (للإدخال) */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function parseNum(s: string): number {
  const n = Number(toLatinDigits(s).replace(/[,٬\s]/g, '').replace('٫', '.'));
  return Number.isFinite(n) ? n : 0;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
