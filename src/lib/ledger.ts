import type { Collection, Order } from '../data/types';

export interface LedgerRow {
  id: string;
  ts: number;
  kind: 'invoice' | 'payment';
  label: string;
  sub: string;
  debit: number;
  credit: number;
  /** الرصيد بعد هذه الحركة */
  after: number;
}

/**
 * كشف حساب العميل (الأحدث أولًا) مع الرصيد الجاري المحسوب رجوعًا من الرصيد الحالي.
 * عند تساوي الوقت (طلب نقدي ودفعته المسجّلة في اللحظة نفسها) تُعدّ الدفعة أحدث من الفاتورة،
 * وإلا ظهر رصيد سالب وهمي في منتصف الكشف.
 */
export function buildLedger(balance: number, orders: Order[], collections: Collection[]): LedgerRow[] {
  const rows: Omit<LedgerRow, 'after'>[] = [
    ...orders
      .filter((o) => o.status !== 'cancelled')
      .map((o) => ({ id: `o${o.id}`, ts: o.createdAt, kind: 'invoice' as const, label: `فاتورة #${o.no}`, sub: o.paymentType === 'cash' ? 'نقدي' : 'آجل', debit: o.total, credit: 0 })),
    ...collections
      .filter((k) => k.status === 'active')
      .map((k) => ({ id: `k${k.id}`, ts: k.createdAt, kind: 'payment' as const, label: k.orderId ? 'دفعة مع الطلب' : 'سند قبض', sub: k.reference ?? '', debit: 0, credit: k.amount })),
  ].sort((a, b) => b.ts - a.ts || (a.kind === 'payment' ? -1 : 1) - (b.kind === 'payment' ? -1 : 1));

  let running = balance;
  return rows.map((r) => {
    const row = { ...r, after: running };
    running -= r.debit - r.credit;
    return row;
  });
}
