import type { Collection, Order } from '../data/types';
import { DAY, startOfDay } from './time';

/** طلب محتسب كمبيعات: ليس ملغيًا ولا بانتظار موافقة الائتمان */
export const isSale = (o: Order) => o.status !== 'cancelled' && o.status !== 'credit_hold';
export const isActiveCollection = (c: Collection) => c.status === 'active';

export const sum = <T,>(items: T[], f: (x: T) => number) => items.reduce((s, x) => s + f(x), 0);

export function between<T>(items: T[], ts: (x: T) => number, from: number, to: number): T[] {
  return items.filter((x) => ts(x) >= from && ts(x) < to);
}

/** مجموع قيمة لكل يوم لآخر `days` يومًا (الأقدم أولًا) */
export function dailyTotals<T>(items: T[], ts: (x: T) => number, val: (x: T) => number, days: number, now = Date.now()): { starts: number[]; values: number[] } {
  const today = startOfDay(now);
  const starts = Array.from({ length: days }, (_, i) => today - (days - 1 - i) * DAY);
  const values = new Array<number>(days).fill(0);
  for (const it of items) {
    const idx = Math.floor((startOfDay(ts(it)) - starts[0]!) / DAY);
    if (idx >= 0 && idx < days) values[idx]! += val(it);
  }
  return { starts, values };
}

export function pctChange(now: number, prev: number): number | null {
  if (prev <= 0) return now > 0 ? null : 0;
  return ((now - prev) / prev) * 100;
}

export function groupSum<T>(items: T[], key: (x: T) => string, val: (x: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + val(it));
  return m;
}
