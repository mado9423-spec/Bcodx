import { beforeEach, describe, expect, it } from 'vitest';
import { createActions } from '../data/actions';
import { LocalStore } from '../data/localStore';
import { generateSeed } from '../data/seed';
import type { Collection, Customer, Order, StockItem } from '../data/types';
import { priceCart } from '../lib/pricing';
import { DAY } from '../lib/time';

const NOW = Date.UTC(2026, 9, 7, 12);

function setup() {
  const { company, data } = generateSeed(NOW);
  const store = new LocalStore('t', { company: { ...company, id: 't', ownerUid: 'u' }, tables: data as never });
  const read = <T,>(coll: Parameters<LocalStore['subscribe']>[0]): T[] => {
    let rows: T[] = [];
    store.subscribe(coll as never, undefined, ((r: T[]) => (rows = r)) as never)();
    return rows;
  };
  // الاشتراك يطلق الحدث بشكل غير متزامن في microtask؛ نقرأ مباشرة من الجدول عبر مستمع متزامن
  return { store, data, company, read };
}

async function snapshot<T>(store: LocalStore, coll: Parameters<LocalStore['subscribe']>[0]): Promise<T[]> {
  return new Promise((resolve) => {
    const off = store.subscribe(coll as never, undefined, ((rows: T[]) => {
      off();
      resolve(rows);
    }) as never);
  });
}

describe('بيانات البذرة', () => {
  it('الأرصدة متسقة مع الطلبات والتحصيلات', () => {
    const { data } = generateSeed(NOW);
    for (const c of data.customers) {
      const invoices = data.orders.filter((o) => o.customerId === c.id && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
      const paid = data.collections.filter((k) => k.customerId === c.id && k.status === 'active').reduce((s, k) => s + k.amount, 0);
      expect(Math.abs(c.balance - (invoices - paid))).toBeLessThan(0.05);
    }
  });
  it('لا مخزون سالب ولا أرقام طلبات مكررة', () => {
    const { data } = generateSeed(NOW);
    expect(data.stock.every((s) => s.qty >= 0)).toBe(true);
    const nos = data.orders.map((o) => o.no);
    expect(new Set(nos).size).toBe(nos.length);
  });
  it('تتضمن حالات واقعية: طلب ائتمان معلّق وأصناف منخفضة ونافدة', () => {
    const { data } = generateSeed(NOW);
    expect(data.orders.some((o) => o.status === 'credit_hold')).toBe(true);
    const total = (pid: string) => data.stock.filter((s) => s.productId === pid).reduce((a, s) => a + s.qty, 0);
    expect(data.products.filter((p) => total(p.id) <= p.minStock).length).toBeGreaterThan(2);
    expect(data.products.some((p) => total(p.id) === 0)).toBe(true);
  });
});

describe('العمليات المحاسبية', () => {
  let ctx: ReturnType<typeof setup>;
  let actions: ReturnType<typeof createActions>;
  beforeEach(() => {
    ctx = setup();
    actions = createActions(ctx.store, { name: 'اختبار' });
  });

  const pick = () => {
    const customer = ctx.data.customers.find((c) => c.active && c.balance < c.creditLimit * 0.3)!;
    const rep = ctx.data.reps.find((r) => r.id === customer.repId)!;
    const p1 = ctx.data.products[1]!; // عصير
    const p2 = ctx.data.products[8]!; // معكرونة
    const lines = [{ product: p1, qty: 4 }, { product: p2, qty: 3 }];
    const priced = priceCart(lines, customer.priceList, [], NOW);
    return { customer, rep, lines, priced };
  };
  const qty = async (wh: string, pid: string) => (await snapshot<StockItem>(ctx.store, 'stock')).find((s) => s.id === `${wh}_${pid}`)?.qty ?? 0;
  const cust = async (id: string) => (await snapshot<Customer>(ctx.store, 'customers')).find((c) => c.id === id)!;

  it('طلب آجل: يخصم المخزون ويزيد الدين', async () => {
    const { customer, rep, lines, priced } = pick();
    const before = { stock: await qty('w-main', lines[0]!.product.id), bal: customer.balance };
    const order = await actions.createOrder({ customer, rep, warehouseId: 'w-main', lines, priced, paymentType: 'credit', paidNow: 0, creditHold: false });
    expect(await qty('w-main', lines[0]!.product.id)).toBe(before.stock - 4);
    expect((await cust(customer.id)).balance).toBeCloseTo(before.bal + priced.total, 2);
    expect(order.status).toBe('new');
    expect(order.dueAt).toBe(order.createdAt + customer.creditDays * DAY);
  });

  it('طلب نقدي: يسجّل تحصيلًا مرتبطًا ولا يغيّر الرصيد', async () => {
    const { customer, rep, lines, priced } = pick();
    const order = await actions.createOrder({ customer, rep, warehouseId: 'w-main', lines, priced, paymentType: 'cash', paidNow: 0, creditHold: false });
    expect((await cust(customer.id)).balance).toBeCloseTo(customer.balance, 2);
    const col = (await snapshot<Collection>(ctx.store, 'collections')).find((c) => c.orderId === order.id)!;
    expect(col.amount).toBeCloseTo(priced.total, 2);
    expect(order.paidNow).toBeCloseTo(priced.total, 2);
  });

  it('الإلغاء يعكس كل شيء ويبطل الدفعة المرتبطة', async () => {
    const { customer, rep, lines, priced } = pick();
    const stock0 = await qty('w-main', lines[0]!.product.id);
    const order = await actions.createOrder({ customer, rep, warehouseId: 'w-main', lines, priced, paymentType: 'credit', paidNow: 100, creditHold: false });
    const cols = await snapshot<Collection>(ctx.store, 'collections');
    const res = await actions.cancelOrder(order, 'اختبار', cols);
    expect(res.refund).toBe(100);
    expect(await qty('w-main', lines[0]!.product.id)).toBe(stock0);
    expect((await cust(customer.id)).balance).toBeCloseTo(customer.balance, 2);
    const orders = await snapshot<Order>(ctx.store, 'orders');
    expect(orders.find((o) => o.id === order.id)!.status).toBe('cancelled');
    expect((await snapshot<Collection>(ctx.store, 'collections')).filter((c) => c.orderId === order.id).every((c) => c.status === 'void')).toBe(true);
  });

  it('مخزون غير كافٍ: العملية كلها تُرفض ولا يتغير شيء (ذرّية)', async () => {
    const { customer, rep, priced } = pick();
    const p = ctx.data.products[2]!;
    const lines = [{ product: p, qty: 1 }, { product: ctx.data.products[0]!, qty: 999999 }];
    const stock0 = await qty('w-main', p.id);
    const ordersBefore = (await snapshot<Order>(ctx.store, 'orders')).length;
    await expect(actions.createOrder({ customer, rep, warehouseId: 'w-main', lines, priced: { ...priced, lines: lines.map((l) => ({ productId: l.product.id, qty: l.qty, freeQty: 0, price: 1, discount: 0, lineTotal: l.qty })) }, paymentType: 'credit', paidNow: 0, creditHold: false })).rejects.toThrow();
    expect(await qty('w-main', p.id)).toBe(stock0);
    expect((await cust(customer.id)).balance).toBeCloseTo(customer.balance, 2);
    expect((await snapshot<Order>(ctx.store, 'orders')).length).toBe(ordersBefore);
  });

  it('التحصيل يخفض الرصيد ويمسح الوعد، والإلغاء يعيده', async () => {
    const customer = (await snapshot<Customer>(ctx.store, 'customers')).find((c) => c.balance > 1000)!;
    const col = await actions.recordCollection({ customer, amount: 500, method: 'transfer', reference: 'TRX1' });
    expect((await cust(customer.id)).balance).toBeCloseTo(customer.balance - 500, 2);
    expect((await cust(customer.id)).promiseDate).toBeUndefined();
    await actions.voidCollection(col);
    expect((await cust(customer.id)).balance).toBeCloseTo(customer.balance, 2);
  });

  it('التحويل بين المخازن يحفظ الإجمالي ويرفض الزيادة', async () => {
    const pid = ctx.data.products[5]!.id;
    const a = await qty('w-main', pid);
    const b = await qty('w-east', pid);
    await actions.transferStock('w-main', 'w-east', [{ productId: pid, qty: 10 }]);
    expect(await qty('w-main', pid)).toBe(a - 10);
    expect(await qty('w-east', pid)).toBe(b + 10);
    await expect(actions.transferStock('w-main', 'w-east', [{ productId: pid, qty: 10_000_000 }])).rejects.toThrow();
    expect(await qty('w-main', pid)).toBe(a - 10);
  });

  it('تسوية الجرد تُنشئ حركة بالفرق', async () => {
    const pid = ctx.data.products[3]!.id;
    const cur = await qty('w-main', pid);
    await actions.adjustStock('w-main', pid, cur, cur + 7, 'عدّ');
    expect(await qty('w-main', pid)).toBe(cur + 7);
  });
});
