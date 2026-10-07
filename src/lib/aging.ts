import type { Collection, Customer, Order } from '../data/types';
import { DAY } from './time';

export interface Aging {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90p: number;
  total: number;
  overdue: number;
  oldestOverdueDays: number;
}

export const AGING_BUCKETS: { key: keyof Pick<Aging, 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90p'>; label: string; color: string }[] = [
  { key: 'current', label: 'غير مستحق', color: 'var(--age-0)' },
  { key: 'd1_30', label: 'متأخر 1–30 يومًا', color: 'var(--age-1)' },
  { key: 'd31_60', label: 'متأخر 31–60 يومًا', color: 'var(--age-2)' },
  { key: 'd61_90', label: 'متأخر 61–90 يومًا', color: 'var(--age-3)' },
  { key: 'd90p', label: 'متأخر أكثر من 90', color: 'var(--age-4)' },
];

export const emptyAging = (): Aging => ({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, total: 0, overdue: 0, oldestOverdueDays: 0 });

/**
 * أعمار الديون لعميل واحد.
 * 1) الدفعات المرتبطة بطلب تُخصم من ذلك الطلب نفسه (حتى لا يخفي بيع نقدي حديث فاتورة آجلة قديمة).
 * 2) سندات القبض العامة تُسدَّد بها أقدم الفواتير أولًا (FIFO).
 * 3) إن كان الرصيد المسجَّل أكبر من مجموع المتبقي (طلبات أقدم من النافذة المحمّلة) يُضاف الفرق لأقدم شريحة.
 */
export function computeAging(orders: Order[], collections: Collection[], now: number, balance?: number): Aging {
  const a = emptyAging();
  const invoices = orders
    .filter((o) => o.status !== 'cancelled')
    .sort((x, y) => x.createdAt - y.createdAt)
    .map((o) => {
      const linked = collections.filter((c) => c.status === 'active' && c.orderId === o.id).reduce((s, c) => s + c.amount, 0);
      return { dueAt: o.dueAt, remaining: Math.max(0, o.total - linked) };
    });

  let general = collections.filter((c) => c.status === 'active' && !c.orderId).reduce((s, c) => s + c.amount, 0);
  for (const inv of invoices) {
    if (general <= 0) break;
    const used = Math.min(general, inv.remaining);
    inv.remaining -= used;
    general -= used;
  }

  for (const inv of invoices) {
    if (inv.remaining <= 0.005) continue;
    const late = Math.floor((now - inv.dueAt) / DAY);
    if (late <= 0) a.current += inv.remaining;
    else if (late <= 30) a.d1_30 += inv.remaining;
    else if (late <= 60) a.d31_60 += inv.remaining;
    else if (late <= 90) a.d61_90 += inv.remaining;
    else a.d90p += inv.remaining;
    if (late > a.oldestOverdueDays) a.oldestOverdueDays = late;
  }

  const sum = a.current + a.d1_30 + a.d31_60 + a.d61_90 + a.d90p;
  if (balance !== undefined && balance - sum > 0.01) {
    a.d90p += balance - sum;
    a.oldestOverdueDays = Math.max(a.oldestOverdueDays, 91);
  }
  a.total = a.current + a.d1_30 + a.d31_60 + a.d61_90 + a.d90p;
  a.overdue = a.total - a.current;
  return a;
}

export function agingByCustomer(customers: Customer[], orders: Order[], collections: Collection[], now: number): Map<string, Aging> {
  const ordersBy = new Map<string, Order[]>();
  for (const o of orders) {
    const list = ordersBy.get(o.customerId);
    if (list) list.push(o);
    else ordersBy.set(o.customerId, [o]);
  }
  const colsBy = new Map<string, Collection[]>();
  for (const c of collections) {
    const list = colsBy.get(c.customerId);
    if (list) list.push(c);
    else colsBy.set(c.customerId, [c]);
  }
  const out = new Map<string, Aging>();
  for (const c of customers) {
    if (c.balance <= 0.005) {
      out.set(c.id, emptyAging());
      continue;
    }
    out.set(c.id, computeAging(ordersBy.get(c.id) ?? [], colsBy.get(c.id) ?? [], now, c.balance));
  }
  return out;
}

export function sumAging(list: Aging[]): Aging {
  const t = emptyAging();
  for (const a of list) {
    t.current += a.current;
    t.d1_30 += a.d1_30;
    t.d31_60 += a.d31_60;
    t.d61_90 += a.d61_90;
    t.d90p += a.d90p;
    t.total += a.total;
    t.overdue += a.overdue;
    t.oldestOverdueDays = Math.max(t.oldestOverdueDays, a.oldestOverdueDays);
  }
  return t;
}
