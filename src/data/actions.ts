import { newId, newOrderNo } from '../lib/ids';
import type { CartLine, PricedCart } from '../lib/pricing';
import { DAY } from '../lib/time';
import { del, inc, type Store } from './store';
import type {
  Collection, Customer, MovementType, Offer, Order, OrderItem, OrderStatus, PaymentMethod, Product, Rep, StockMovement, VisitResult,
  Warehouse, Zone,
} from './types';

export interface Actor {
  name: string;
  repId?: string;
}

export interface CreateOrderInput {
  customer: Customer;
  rep: Rep | undefined;
  warehouseId: string;
  lines: CartLine[];
  priced: PricedCart;
  paymentType: 'cash' | 'credit';
  paidNow: number;
  note?: string;
  creditHold: boolean;
}

export const stockId = (warehouseId: string, productId: string) => `${warehouseId}_${productId}`;

function movement(
  productId: string, warehouseId: string, qty: number, type: MovementType, actor: Actor, extra: { refId?: string; note?: string } = {},
): StockMovement {
  return { id: newId(), productId, warehouseId, qty, type, byName: actor.name, createdAt: Date.now(), ...extra };
}

export function createActions(store: Store, actor: Actor) {
  return {
    /** إنشاء طلب: يخصم المخزون ويقيّد الدين على العميل ويسجّل الدفعة (إن وجدت) في عملية ذرّية واحدة */
    async createOrder(input: CreateOrderInput): Promise<Order> {
      const { customer, rep, warehouseId, lines, priced, paymentType, note, creditHold } = input;
      const now = Date.now();
      const id = newId();
      const byProduct = new Map<string, Product>(lines.map((l) => [l.product.id, l.product]));
      const items: OrderItem[] = priced.lines.map((l) => {
        const p = byProduct.get(l.productId)!;
        return {
          productId: p.id, name: p.name, emoji: p.emoji, unit: p.unit, qty: l.qty, freeQty: l.freeQty, price: l.price,
          discount: l.discount, lineTotal: l.lineTotal, ...(l.offerId ? { offerId: l.offerId, offerName: l.offerName } : {}),
        };
      });
      const paid = paymentType === 'cash' ? priced.total : Math.min(Math.max(0, input.paidNow), priced.total);
      const repId = rep?.id ?? customer.repId;
      const repName = rep?.name ?? actor.name;
      const order: Order = {
        id, no: newOrderNo(now), customerId: customer.id, customerName: customer.name, repId, repName, zoneId: customer.zoneId,
        warehouseId, items, subtotal: priced.subtotal, lineDiscount: priced.lineDiscount, orderDiscount: priced.orderDiscount,
        ...(priced.orderOfferName ? { orderOfferName: priced.orderOfferName } : {}), total: priced.total, paymentType, paidNow: paid,
        dueAt: paymentType === 'cash' ? now : now + customer.creditDays * DAY, status: creditHold ? 'credit_hold' : 'new',
        ...(note ? { note } : {}), createdAt: now, updatedAt: now, createdByName: actor.name,
      };
      const b = store.batch();
      b.set('orders', id, order);
      for (const it of items) {
        const qty = it.qty + it.freeQty;
        b.merge('stock', stockId(warehouseId, it.productId), { warehouseId, productId: it.productId, qty: inc(-qty) });
        const m = movement(it.productId, warehouseId, -qty, 'sale', actor, { refId: id });
        b.set('stockMovements', m.id, m);
      }
      b.update('customers', customer.id, { balance: inc(priced.total - paid), lastOrderAt: now });
      if (paid > 0) {
        const col: Collection = {
          id: newId(), customerId: customer.id, customerName: customer.name, amount: paid, method: 'cash', repId, repName,
          zoneId: customer.zoneId, orderId: id, status: 'active', createdAt: now, byName: actor.name,
        };
        b.set('collections', col.id, col);
      }
      await b.commit();
      return order;
    },

    async setOrderStatus(order: Order, status: OrderStatus) {
      const b = store.batch();
      const now = Date.now();
      b.update('orders', order.id, { status, updatedAt: now, ...(status === 'delivered' ? { deliveredAt: now } : {}) });
      await b.commit();
    },

    /** إلغاء طلب: إرجاع المخزون وعكس القيد المحاسبي وإبطال الدفعات المرتبطة */
    async cancelOrder(order: Order, reason: string, linked: Collection[]) {
      const b = store.batch();
      const now = Date.now();
      b.update('orders', order.id, { status: 'cancelled', cancelReason: reason, updatedAt: now });
      for (const it of order.items) {
        const qty = it.qty + it.freeQty;
        b.merge('stock', stockId(order.warehouseId, it.productId), { warehouseId: order.warehouseId, productId: it.productId, qty: inc(qty) });
        const m = movement(it.productId, order.warehouseId, qty, 'cancel', actor, { refId: order.id, note: reason });
        b.set('stockMovements', m.id, m);
      }
      const active = linked.filter((c) => c.status === 'active' && c.orderId === order.id);
      const paid = active.reduce((s, c) => s + c.amount, 0);
      for (const c of active) b.update('collections', c.id, { status: 'void' });
      // عكس قيد الفاتورة (−الإجمالي) وإبطال الدفعات (+المدفوع): الصافي = ما كان مسجَّلًا ديناً فعلًا
      b.update('customers', order.customerId, { balance: inc(-order.total + paid) });
      await b.commit();
      return { refund: paid };
    },

    async recordCollection(input: {
      customer: Customer; amount: number; method: PaymentMethod; reference?: string; note?: string; rep?: Rep;
    }): Promise<Collection> {
      const { customer, amount, method, reference, note, rep } = input;
      const now = Date.now();
      const repId = actor.repId ?? rep?.id ?? customer.repId;
      const col: Collection = {
        id: newId(), customerId: customer.id, customerName: customer.name, amount, method, repId,
        repName: rep?.name ?? actor.name, zoneId: customer.zoneId, status: 'active', createdAt: now, byName: actor.name,
        ...(reference ? { reference } : {}), ...(note ? { note } : {}),
      };
      const b = store.batch();
      b.set('collections', col.id, col);
      b.update('customers', customer.id, { balance: inc(-amount), promiseDate: del(), promiseAmount: del() });
      await b.commit();
      return col;
    },

    async voidCollection(c: Collection) {
      const b = store.batch();
      b.update('collections', c.id, { status: 'void' });
      b.update('customers', c.customerId, { balance: inc(c.amount) });
      await b.commit();
    },

    async setPromise(customerId: string, date: number | null, amount?: number) {
      const b = store.batch();
      b.update('customers', customerId, date === null ? { promiseDate: del(), promiseAmount: del() } : { promiseDate: date, promiseAmount: amount ?? 0 });
      await b.commit();
    },

    async logVisit(input: { customer: Customer; result: VisitResult; note?: string; rep?: Rep; coords?: { lat: number; lng: number } }) {
      const { customer, result, note, rep, coords } = input;
      const now = Date.now();
      const id = newId();
      const b = store.batch();
      b.set('visits', id, {
        id, customerId: customer.id, customerName: customer.name, repId: actor.repId ?? rep?.id ?? customer.repId,
        repName: rep?.name ?? actor.name, zoneId: customer.zoneId, result, createdAt: now,
        ...(note ? { note } : {}), ...(coords ?? {}),
      });
      b.update('customers', customer.id, { lastVisitAt: now });
      await b.commit();
    },

    async saveCustomer(c: Customer) {
      const b = store.batch();
      const { balance: _bal, ...rest } = c;
      void _bal;
      // الرصيد لا يُحرَّر يدويًا: يتغير فقط عبر الطلبات والتحصيل
      b.merge('customers', c.id, { ...rest });
      await b.commit();
    },
    async createCustomer(c: Customer) {
      const b = store.batch();
      b.set('customers', c.id, c);
      await b.commit();
    },
    async saveProduct(p: Product) {
      const b = store.batch();
      b.set('products', p.id, p);
      await b.commit();
    },
    async saveRep(r: Rep) {
      const b = store.batch();
      b.set('reps', r.id, r);
      await b.commit();
    },
    async saveZone(z: Zone) {
      const b = store.batch();
      b.set('zones', z.id, z);
      await b.commit();
    },
    async saveWarehouse(w: Warehouse) {
      const b = store.batch();
      b.set('warehouses', w.id, w);
      await b.commit();
    },
    async saveOffer(o: Offer) {
      const b = store.batch();
      b.set('offers', o.id, o);
      await b.commit();
    },
    async toggleOffer(o: Offer) {
      const b = store.batch();
      b.update('offers', o.id, { active: !o.active });
      await b.commit();
    },
    async deleteOffer(id: string) {
      const b = store.batch();
      b.remove('offers', id);
      await b.commit();
    },

    async receiveStock(warehouseId: string, lines: { productId: string; qty: number }[], note?: string) {
      const b = store.batch();
      for (const l of lines) {
        b.merge('stock', stockId(warehouseId, l.productId), { warehouseId, productId: l.productId, qty: inc(l.qty) });
        const m = movement(l.productId, warehouseId, l.qty, 'receive', actor, { note });
        b.set('stockMovements', m.id, m);
      }
      await b.commit();
    },

    async transferStock(fromId: string, toId: string, lines: { productId: string; qty: number }[]) {
      const b = store.batch();
      for (const l of lines) {
        b.merge('stock', stockId(fromId, l.productId), { warehouseId: fromId, productId: l.productId, qty: inc(-l.qty) });
        b.merge('stock', stockId(toId, l.productId), { warehouseId: toId, productId: l.productId, qty: inc(l.qty) });
        const out = movement(l.productId, fromId, -l.qty, 'transfer_out', actor, { note: 'تحويل بين المخازن' });
        const inn = movement(l.productId, toId, l.qty, 'transfer_in', actor, { note: 'تحويل بين المخازن' });
        b.set('stockMovements', out.id, out);
        b.set('stockMovements', inn.id, inn);
      }
      await b.commit();
    },

    async adjustStock(warehouseId: string, productId: string, current: number, counted: number, note?: string) {
      const delta = counted - current;
      if (delta === 0) return;
      const b = store.batch();
      b.merge('stock', stockId(warehouseId, productId), { warehouseId, productId, qty: inc(delta) });
      const m = movement(productId, warehouseId, delta, 'adjust', actor, { note: note ?? 'تسوية جرد' });
      b.set('stockMovements', m.id, m);
      await b.commit();
    },

    async updateCompany(patch: Record<string, unknown>) {
      const b = store.batch();
      b.updateCompany(patch);
      await b.commit();
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
