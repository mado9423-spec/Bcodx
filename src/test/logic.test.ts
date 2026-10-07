import { describe, expect, it } from 'vitest';
import { computeAging } from '../lib/aging';
import { creditCheck, customerHealth } from '../lib/credit';
import { priceCart, type CartLine } from '../lib/pricing';
import { normalizePhone, waLink } from '../lib/whatsapp';
import { toCsv } from '../lib/csv';
import { parseNum } from '../lib/format';
import { DAY } from '../lib/time';
import type { Collection, Offer, Order, Product } from '../data/types';

const NOW = Date.UTC(2026, 9, 7, 12);

const product = (id: string, category: string, wholesale: number): Product => ({
  id, name: id, sku: id, category, unit: 'كرتون', emoji: '📦', cost: wholesale * 0.7, minStock: 10, active: true,
  prices: { wholesale, semi: wholesale * 1.05, retail: wholesale * 1.1 },
});

const offer = (o: Partial<Offer>): Offer => ({
  id: 'o', name: 'عرض', type: 'percent', productIds: [], category: '', minQty: 1, percent: 0, buyQty: 0, freeQty: 0, minTotal: 0,
  startAt: NOW - DAY, endAt: NOW + DAY, active: true, ...o,
});

describe('priceCart — محرك العروض', () => {
  const water = product('water', 'مشروبات', 20);
  const rice = product('rice', 'غذاء', 50);
  const lines = (...l: [Product, number][]): CartLine[] => l.map(([product, qty]) => ({ product, qty }));

  it('يحسب بدون عروض', () => {
    const c = priceCart(lines([water, 3]), 'wholesale', [], NOW);
    expect(c.subtotal).toBe(60);
    expect(c.total).toBe(60);
    expect(c.lines[0]!.offerId).toBeUndefined();
  });

  it('خصم النسبة على الفئة يتطلب الحد الأدنى للكمية', () => {
    const o = offer({ type: 'percent', category: 'مشروبات', minQty: 5, percent: 10 });
    expect(priceCart(lines([water, 4]), 'wholesale', [o], NOW).lineDiscount).toBe(0);
    const c = priceCart(lines([water, 5]), 'wholesale', [o], NOW);
    expect(c.lineDiscount).toBe(10);
    expect(c.total).toBe(90);
  });

  it('اشترِ X واحصل على Y مجانًا (مضاعفات)', () => {
    const o = offer({ type: 'bxgy', productIds: ['rice'], buyQty: 10, freeQty: 1 });
    expect(priceCart(lines([rice, 9]), 'wholesale', [o], NOW).lines[0]!.freeQty).toBe(0);
    expect(priceCart(lines([rice, 10]), 'wholesale', [o], NOW).lines[0]!.freeQty).toBe(1);
    const c = priceCart(lines([rice, 25]), 'wholesale', [o], NOW);
    expect(c.lines[0]!.freeQty).toBe(2);
    expect(c.total).toBe(1250); // المجاني لا يُحتسب في السعر
  });

  it('يختار الأفضل للعميل ولا يجمع عرضين على نفس السطر', () => {
    const a = offer({ id: 'a', type: 'percent', productIds: ['rice'], minQty: 1, percent: 5 });
    const b = offer({ id: 'b', type: 'percent', productIds: ['rice'], minQty: 1, percent: 12 });
    const c = priceCart(lines([rice, 10]), 'wholesale', [a, b], NOW);
    expect(c.lines[0]!.offerId).toBe('b');
    expect(c.lineDiscount).toBe(60);
  });

  it('خصم الفاتورة بعد خصومات الأصناف وبحد أدنى', () => {
    const item = offer({ id: 'i', type: 'percent', productIds: ['rice'], minQty: 1, percent: 10 });
    const inv = offer({ id: 'v', type: 'order_percent', percent: 5, minTotal: 400 });
    // 10 × 50 = 500 − 50 = 450 → فوق 400 → خصم 5% = 22.5
    const c = priceCart(lines([rice, 10]), 'wholesale', [item, inv], NOW);
    expect(c.orderDiscount).toBe(22.5);
    expect(c.total).toBe(427.5);
    expect(priceCart(lines([rice, 5]), 'wholesale', [item, inv], NOW).orderDiscount).toBe(0);
  });

  it('يتجاهل العروض المنتهية والمجدولة والموقوفة', () => {
    const base = { type: 'percent' as const, category: 'مشروبات', minQty: 1, percent: 50 };
    const expired = offer({ ...base, endAt: NOW - 1 });
    const future = offer({ ...base, startAt: NOW + 1 });
    const paused = offer({ ...base, active: false });
    expect(priceCart(lines([water, 2]), 'wholesale', [expired, future, paused], NOW).total).toBe(40);
  });

  it('يستخدم قائمة أسعار العميل', () => {
    expect(priceCart(lines([water, 10]), 'retail', [], NOW).subtotal).toBe(220);
  });
});

describe('computeAging — أعمار الديون', () => {
  const order = (id: string, daysAgo: number, total: number, creditDays = 30): Order =>
    ({ id, createdAt: NOW - daysAgo * DAY, dueAt: NOW - daysAgo * DAY + creditDays * DAY, total, status: 'delivered' }) as Order;
  const col = (amount: number, orderId?: string, status: 'active' | 'void' = 'active'): Collection => ({ id: Math.random().toString(), amount, orderId, status }) as Collection;

  it('الدفعة النقدية الحديثة لا تُخفي فاتورة آجلة قديمة', () => {
    const old = order('old', 100, 1000);
    const cash = order('cash', 1, 400, 0);
    const a = computeAging([old, cash], [col(400, 'cash')], NOW, 1000);
    expect(a.total).toBe(1000);
    expect(a.d61_90 + a.d90p + a.d31_60).toBeGreaterThan(0); // الفاتورة القديمة ما زالت متأخرة
    expect(a.oldestOverdueDays).toBeGreaterThan(60);
  });

  it('سندات القبض العامة تُسدَّد بأقدم فاتورة أولًا (FIFO)', () => {
    const a = computeAging([order('a', 80, 500), order('b', 10, 500)], [col(500)], NOW, 500);
    expect(a.total).toBe(500);
    expect(a.current).toBe(500); // بقيت الفاتورة الحديثة (غير مستحقة)
    expect(a.overdue).toBe(0);
  });

  it('يتجاهل السندات الملغاة', () => {
    const a = computeAging([order('a', 5, 300)], [col(300, undefined, 'void')], NOW, 300);
    expect(a.total).toBe(300);
  });

  it('يضيف الفرق عن الرصيد (طلبات أقدم من النافذة) لأقدم شريحة', () => {
    const a = computeAging([order('a', 5, 300)], [], NOW, 1000);
    expect(a.total).toBe(1000);
    expect(a.d90p).toBe(700);
  });

  it('الشرائح حسب أيام التأخر', () => {
    const a = computeAging([order('1', 40, 100), order('2', 70, 100), order('3', 100, 100), order('4', 130, 100)], [], NOW);
    expect(a.d1_30).toBe(100); // متأخر 10 أيام
    expect(a.d31_60).toBe(100); // 40 يومًا
    expect(a.d61_90).toBe(100); // 70 يومًا
    expect(a.d90p).toBe(100); // 100 يوم
    expect(a.overdue).toBe(400);
  });
});

describe('الائتمان', () => {
  it('يكشف تجاوز الحد بعد إضافة الدين الجديد', () => {
    expect(creditCheck({ balance: 800, creditLimit: 1000 }, 150).exceeds).toBe(false);
    expect(creditCheck({ balance: 800, creditLimit: 1000 }, 250).exceeds).toBe(true);
    expect(creditCheck({ balance: 0, creditLimit: 0 }, 1).exceeds).toBe(true);
  });
  it('حالة العميل', () => {
    expect(customerHealth({ balance: 0, creditLimit: 100 })).toBe('clear');
    expect(customerHealth({ balance: 850, creditLimit: 1000 })).toBe('near');
    expect(customerHealth({ balance: 1200, creditLimit: 1000 })).toBe('exceeded');
  });
});

describe('الواتساب والأدوات', () => {
  it('تطبيع أرقام الجوال', () => {
    expect(normalizePhone('0512345678', '966')).toBe('966512345678');
    expect(normalizePhone('+966 51 234 5678', '966')).toBe('966512345678');
    expect(normalizePhone('00966512345678', '966')).toBe('966512345678');
    expect(normalizePhone('٠٥١٢٣٤٥٦٧٨', '966')).toBe('966512345678');
    expect(normalizePhone('01012345678', '20')).toBe('201012345678');
    expect(normalizePhone('', '966')).toBe('');
  });
  it('رابط واتساب يرمّز النص', () => {
    expect(waLink('0512345678', '966', 'مرحبا بك')).toBe(`https://wa.me/966512345678?text=${encodeURIComponent('مرحبا بك')}`);
  });
  it('CSV يهرّب الفواصل والاقتباسات', () => {
    expect(toCsv([['a,b', 'say "hi"', 1]])).toBe('"a,b","say ""hi""",1');
  });
  it('parseNum يقبل الأرقام العربية', () => {
    expect(parseNum('١٢٣٫٥')).toBe(123.5);
    expect(parseNum('1,250')).toBe(1250);
    expect(parseNum('abc')).toBe(0);
  });
});

import { buildLedger } from '../lib/ledger';

describe('كشف الحساب', () => {
  const order = (id: string, ts: number, total: number, cash = false): Order => ({ id, no: id, createdAt: ts, total, paymentType: cash ? 'cash' : 'credit', status: 'delivered' }) as Order;
  const pay = (id: string, ts: number, amount: number, orderId?: string): Collection => ({ id, createdAt: ts, amount, orderId, status: 'active' }) as Collection;

  it('الدفعة النقدية بنفس وقت الفاتورة لا تُنتج رصيدًا سالبًا ولا تغيّر الصافي', () => {
    // رصيد حالي 100: فاتورة آجلة قديمة 100 ثم بيع نقدي 500 مدفوع فورًا
    const rows = buildLedger(100, [order('a', 1000, 100), order('b', 2000, 500, true)], [pay('p', 2000, 500, 'b')]);
    expect(rows.map((r) => r.kind)).toEqual(['payment', 'invoice', 'invoice']); // الدفعة أولًا (الأحدث)
    expect(rows.map((r) => r.after)).toEqual([100, 600, 100]);
    expect(Math.min(...rows.map((r) => r.after))).toBeGreaterThanOrEqual(0);
  });

  it('يتجاهل الطلبات الملغاة والسندات الملغاة', () => {
    const cancelled = { ...order('x', 3000, 999), status: 'cancelled' } as Order;
    const voided = { ...pay('v', 3000, 999), status: 'void' } as Collection;
    expect(buildLedger(0, [cancelled], [voided])).toEqual([]);
  });
});
