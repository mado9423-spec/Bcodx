import { priceCart, type CartLine } from '../lib/pricing';
import { DAY, startOfDay } from '../lib/time';
import type {
  CollName, Collection, CollectionMap, Company, Customer, Offer, Order, OrderItem, OrderStatus, PaymentMethod, PriceList, Product, Rep,
  StockItem, StockMovement, Visit, VisitResult, Warehouse, Zone,
} from './types';

export type SeedData = { [K in CollName]: CollectionMap[K][] };

export interface SeedBundle {
  company: Omit<Company, 'id' | 'ownerUid'>;
  data: SeedData;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONES: [string, string][] = [
  ['الوسط', '#6d4aff'],
  ['الشمال', '#00b8a9'],
  ['الجنوب', '#ff7a59'],
  ['الشرق', '#f5b50a'],
  ['الغرب', '#3b82f6'],
  ['المنطقة الصناعية', '#ec4899'],
];

const REPS: [string, number[], number, number][] = [
  ['أحمد الخالدي', [0, 1], 120000, 90000],
  ['خالد المطيري', [2], 90000, 65000],
  ['يوسف الشهري', [3], 85000, 60000],
  ['ليلى القحطاني', [4], 95000, 70000],
  ['عمر الزهراني', [5, 0], 80000, 55000],
  ['منى السبيعي', [1, 4], 70000, 50000],
];

// [اسم، فئة، وحدة، إيموجي، تكلفة الكرتون، سعر الجملة، حد إعادة الطلب]
const PRODUCTS: [string, string, string, string, number, number, number][] = [
  ['مياه معدنية 330مل', 'مشروبات', 'كرتون', '💧', 14, 18, 60],
  ['عصير برتقال 1 لتر', 'مشروبات', 'كرتون', '🧃', 38, 48, 40],
  ['مشروب غازي 330مل', 'مشروبات', 'كرتون', '🥤', 42, 54, 50],
  ['شاي أحمر 100 كيس', 'مشروبات', 'كرتون', '🍵', 55, 70, 30],
  ['قهوة عربية 250 جم', 'مشروبات', 'كرتون', '☕', 120, 150, 20],
  ['أرز بسمتي 5 كجم', 'مواد غذائية', 'كيس', '🍚', 36, 44, 80],
  ['سكر أبيض 2 كجم', 'مواد غذائية', 'كرتون', '🍬', 48, 58, 40],
  ['زيت دوار الشمس 1.8 لتر', 'مواد غذائية', 'كرتون', '🌻', 95, 118, 35],
  ['معكرونة 400 جم', 'مواد غذائية', 'كرتون', '🍝', 30, 38, 45],
  ['طحين فاخر 10 كجم', 'مواد غذائية', 'كيس', '🌾', 24, 30, 50],
  ['تونة معلبة', 'مواد غذائية', 'كرتون', '🐟', 88, 108, 25],
  ['حليب طويل الأجل 1 لتر', 'مواد غذائية', 'كرتون', '🥛', 62, 76, 55],
  ['عدس أحمر 1 كجم', 'مواد غذائية', 'كرتون', '🫘', 52, 64, 20],
  ['شيبس بالملح', 'وجبات خفيفة', 'كرتون', '🥔', 33, 42, 40],
  ['بسكويت شاي', 'وجبات خفيفة', 'كرتون', '🍪', 27, 35, 40],
  ['شوكولاتة ألواح', 'وجبات خفيفة', 'كرتون', '🍫', 66, 84, 25],
  ['مكسرات مشكلة', 'وجبات خفيفة', 'كرتون', '🥜', 130, 160, 15],
  ['منظف أرضيات 3 لتر', 'منظفات', 'كرتون', '🧴', 58, 72, 30],
  ['سائل جلي', 'منظفات', 'كرتون', '🧽', 40, 52, 30],
  ['مسحوق غسيل 3 كجم', 'منظفات', 'كرتون', '🧺', 70, 88, 25],
  ['مناديل ورقية', 'ورقيات', 'كرتون', '🧻', 32, 41, 50],
  ['محارم مطبخ', 'ورقيات', 'كرتون', '🧾', 36, 46, 30],
];

const SHOP_TYPES = ['بقالة', 'سوبرماركت', 'مؤسسة', 'ميني ماركت', 'تموينات', 'كافتيريا', 'مخبز', 'مركز'];
const SHOP_NAMES = [
  'النور', 'الأمل', 'السلام', 'الواحة', 'الرحاب', 'البركة', 'الفجر', 'الندى', 'الخير', 'المدينة', 'الريان', 'الياسمين',
  'النخيل', 'الشروق', 'الهدى', 'الوفاء', 'الازدهار', 'السعادة', 'الأصالة', 'الرواد', 'الإخوة', 'التوفيق', 'الأفق', 'اللؤلؤة',
  'القمة', 'الجوهرة', 'الصفوة', 'الميزان', 'العروبة', 'الاتحاد', 'الغدير', 'الربيع', 'السنابل', 'الكرم', 'المنار', 'الزهور',
  'البشائر', 'الفيحاء', 'الجود', 'السحاب', 'الراية', 'النجمة', 'الحصن', 'الينابيع', 'الوادي', 'الشاطئ', 'الأصيل', 'المروج',
];
const OWNERS = [
  'عبدالله', 'فهد', 'سعد', 'ناصر', 'مشاري', 'سلمان', 'تركي', 'بندر', 'ماجد', 'عادل', 'حسن', 'إبراهيم', 'صالح', 'طارق', 'وليد',
  'رائد', 'هشام', 'زياد', 'سامي', 'جمال',
];

export function generateSeed(now = Date.now(), seed = 20260101): SeedBundle {
  const rnd = mulberry32(seed);
  const int = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const chance = (p: number) => rnd() < p;
  const r10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

  const zones: Zone[] = ZONES.map(([name, color], i) => ({ id: `z${i + 1}`, name, color }));
  const repColors = ['#6d4aff', '#00b8a9', '#ff7a59', '#f5b50a', '#3b82f6', '#ec4899'];
  const reps: Rep[] = REPS.map(([name, zi, st, ct], i) => ({
    id: `r${i + 1}`,
    name,
    phone: `05${int(10000000, 99999999)}`,
    zoneIds: zi.map((z) => `z${z + 1}`),
    salesTarget: st,
    collectionTarget: ct,
    active: true,
    color: repColors[i]!,
  }));

  const products: Product[] = PRODUCTS.map(([name, category, unit, emoji, cost, price, minStock], i) => ({
    id: `p${String(i + 1).padStart(2, '0')}`,
    name,
    sku: `BX-${1000 + i * 7}`,
    category,
    unit,
    emoji,
    cost,
    prices: { wholesale: price, semi: Math.round(price * 1.04 * 100) / 100, retail: Math.round(price * 1.09 * 100) / 100 },
    minStock,
    active: true,
  }));

  const warehouses: Warehouse[] = [
    { id: 'w-main', name: 'المخزن الرئيسي', type: 'main' },
    { id: 'w-east', name: 'مخزن الفرع الشرقي', type: 'branch' },
    { id: 'w-van1', name: 'سيارة أحمد الخالدي', type: 'van', repId: 'r1' },
    { id: 'w-van2', name: 'سيارة خالد المطيري', type: 'van', repId: 'r2' },
  ];

  // ----- العملاء -----
  const customers: Customer[] = [];
  const limits = [5000, 10000, 20000, 40000];
  const lists: PriceList[] = ['wholesale', 'wholesale', 'semi', 'semi', 'retail'];
  const badIdx = new Set([3, 11, 19, 27, 36, 44]);
  for (let i = 0; i < 48; i++) {
    const zone = zones[i % zones.length]!;
    const rep = reps.find((r) => r.zoneIds.includes(zone.id)) ?? reps[0]!;
    customers.push({
      id: `c${String(i + 1).padStart(3, '0')}`,
      name: `${SHOP_TYPES[i % SHOP_TYPES.length]} ${SHOP_NAMES[i]}`,
      contact: `${pick(OWNERS)} ${pick(OWNERS)}`,
      phone: `05${int(10000000, 99999999)}`,
      address: `${zone.name} — شارع ${int(1, 40)}، حي ${pick(SHOP_NAMES)}`,
      zoneId: zone.id,
      repId: rep.id,
      priceList: pick(lists),
      creditLimit: pick(limits),
      creditDays: pick([15, 30, 30, 45]),
      balance: 0,
      active: i !== 41 && i !== 46,
      createdAt: now - int(80, 400) * DAY,
      notes: chance(0.2) ? 'يفضّل التسليم صباحًا' : undefined,
    });
  }

  // ----- العروض (تُستخدم أيضًا لتسعير الطلبات الحديثة) -----
  const offers: Offer[] = [
    {
      id: 'of1', name: 'خصم 10% عند شراء 5 كراتين من المشروبات', type: 'percent', productIds: [], category: 'مشروبات',
      minQty: 5, percent: 10, buyQty: 0, freeQty: 0, minTotal: 0, startAt: startOfDay(now - 12 * DAY), endAt: startOfDay(now + 20 * DAY), active: true,
    },
    {
      id: 'of2', name: 'اشترِ 10 أرز بسمتي واحصل على كيس مجانًا', type: 'bxgy', productIds: ['p06'], category: '',
      minQty: 0, percent: 0, buyQty: 10, freeQty: 1, minTotal: 0, startAt: startOfDay(now - 20 * DAY), endAt: startOfDay(now + 10 * DAY), active: true,
    },
    {
      id: 'of3', name: 'خصم 5% على الفواتير فوق 5,000', type: 'order_percent', productIds: [], category: '',
      minQty: 0, percent: 5, buyQty: 0, freeQty: 0, minTotal: 5000, startAt: startOfDay(now - 30 * DAY), endAt: startOfDay(now + 45 * DAY), active: true,
    },
    {
      id: 'of4', name: 'عرض المنظفات: اشترِ 6 واحصل على 1', type: 'bxgy', productIds: [], category: 'منظفات',
      minQty: 0, percent: 0, buyQty: 6, freeQty: 1, minTotal: 0, startAt: startOfDay(now + 5 * DAY), endAt: startOfDay(now + 35 * DAY), active: true,
    },
    {
      id: 'of5', name: 'خصم افتتاح الفرع الشرقي 8%', type: 'percent', productIds: ['p14', 'p15', 'p16'], category: '',
      minQty: 3, percent: 8, buyQty: 0, freeQty: 0, minTotal: 0, startAt: startOfDay(now - 50 * DAY), endAt: startOfDay(now - 10 * DAY), active: true,
    },
  ];

  // ----- محاكاة التاريخ: طلبات وتحصيلات وأرصدة -----
  const orders: Order[] = [];
  const collections: Collection[] = [];
  const movements: StockMovement[] = [];
  const repById = new Map(reps.map((r) => [r.id, r]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const lastOrder = new Map<string, number>();
  let oSeq = 0;
  let cSeq = 0;

  const HISTORY = 75;
  for (let d = HISTORY; d >= 0; d--) {
    const dayStart = startOfDay(now - d * DAY);
    const dow = new Date(dayStart).getDay();
    if (dow === 5 && d > 0) continue; // الجمعة إجازة
    const growth = 1 + (HISTORY - d) / (HISTORY * 2.2);
    const count = Math.round((d === 0 ? 5 : int(4, 8)) * growth);
    for (let k = 0; k < count; k++) {
      const cust = customers[int(0, customers.length - 1)]!;
      if (!cust.active) continue;
      const ts = dayStart + int(8, d === 0 ? Math.max(8, new Date(now).getHours()) : 19) * 3600_000 + int(0, 59) * 60_000;
      if (ts > now) continue;
      const rep = repById.get(cust.repId)!;

      const nLines = int(2, 6);
      const chosen = new Set<string>();
      const lines: CartLine[] = [];
      while (chosen.size < nLines) {
        const p = pick(products);
        if (chosen.has(p.id)) continue;
        chosen.add(p.id);
        lines.push({ product: p, qty: chance(0.15) ? int(10, 24) : int(1, 10) });
      }
      const priced = priceCart(lines, cust.priceList, offers, ts);
      const isCash = chance(0.5);
      const paid = isCash ? priced.total : chance(0.15) ? r10(priced.total * 0.3) : 0;

      let status: OrderStatus = 'delivered';
      if (d > 3) status = chance(0.04) ? 'cancelled' : 'delivered';
      else if (d === 0) status = pick<OrderStatus>(['new', 'new', 'approved', 'preparing', 'delivered']);
      else status = pick<OrderStatus>(['approved', 'preparing', 'delivered', 'delivered', 'delivered']);

      const id = `o${String(++oSeq).padStart(4, '0')}`;
      const items: OrderItem[] = priced.lines.map((l) => {
        const p = productById.get(l.productId)!;
        return {
          productId: l.productId, name: p.name, emoji: p.emoji, unit: p.unit, qty: l.qty, freeQty: l.freeQty, price: l.price,
          discount: l.discount, lineTotal: l.lineTotal, ...(l.offerId ? { offerId: l.offerId, offerName: l.offerName } : {}),
        };
      });
      const order: Order = {
        id, no: `${new Date(ts).toISOString().slice(2, 10).replace(/-/g, '')}-${id.slice(1)}`, customerId: cust.id,
        customerName: cust.name, repId: rep.id, repName: rep.name, zoneId: cust.zoneId, warehouseId: 'w-main', items,
        subtotal: priced.subtotal, lineDiscount: priced.lineDiscount, orderDiscount: priced.orderDiscount,
        ...(priced.orderOfferName ? { orderOfferName: priced.orderOfferName } : {}), total: priced.total,
        paymentType: isCash ? 'cash' : 'credit', paidNow: paid, dueAt: isCash ? ts : ts + cust.creditDays * DAY, status,
        createdAt: ts, updatedAt: ts + 3600_000, createdByName: rep.name,
        ...(status === 'delivered' ? { deliveredAt: ts + int(2, 20) * 3600_000 } : {}),
        ...(status === 'cancelled' ? { cancelReason: 'طلب العميل الإلغاء' } : {}),
      };
      orders.push(order);
      lastOrder.set(cust.id, Math.max(lastOrder.get(cust.id) ?? 0, ts));

      if (status !== 'cancelled') {
        cust.balance += priced.total;
        if (paid > 0) {
          cust.balance -= paid;
          collections.push({
            id: `k${String(++cSeq).padStart(4, '0')}`, customerId: cust.id, customerName: cust.name, amount: paid, method: 'cash',
            repId: rep.id, repName: rep.name, zoneId: cust.zoneId, orderId: id, status: 'active', createdAt: ts, byName: rep.name,
          });
        }
        if (d <= 10) {
          for (const it of items) {
            movements.push({
              id: `m-${id}-${it.productId}`, productId: it.productId, warehouseId: 'w-main', qty: -(it.qty + it.freeQty), type: 'sale',
              refId: id, byName: rep.name, createdAt: ts,
            });
          }
        }
      }
    }

    // تحصيل عام (سندات قبض) خلال اليوم
    if (d > 0) {
      for (const c of customers) {
        if (c.balance < 200) continue;
        const bad = badIdx.has(Number(c.id.slice(1)) - 1);
        if (!chance(bad ? 0.006 : 0.075)) continue;
        const amount = Math.min(c.balance, r10(c.balance * (0.4 + rnd() * 0.6)));
        const ts = dayStart + int(9, 18) * 3600_000 + int(0, 59) * 60_000;
        const rep = repById.get(c.repId)!;
        const method = pick<PaymentMethod>(['cash', 'cash', 'transfer', 'cheque']);
        collections.push({
          id: `k${String(++cSeq).padStart(4, '0')}`, customerId: c.id, customerName: c.name, amount, method, repId: rep.id,
          repName: rep.name, zoneId: c.zoneId, status: 'active', createdAt: ts, byName: rep.name,
          ...(method === 'cheque' ? { reference: `CHQ-${int(100000, 999999)}` } : {}),
          ...(method === 'transfer' ? { reference: `TRX${int(10000000, 99999999)}` } : {}),
        });
        c.balance -= amount;
      }
    }
  }

  // تضخيم أرصدة بعض العملاء ليظهر تجاوز الحد وتأخر السداد بشكل واقعي
  for (const c of customers) {
    c.balance = Math.max(0, Math.round(c.balance * 100) / 100);
    c.lastOrderAt = lastOrder.get(c.id);
  }
  const over = customers.filter((c) => c.active && c.balance > 0).sort((a, b) => b.balance - a.balance);
  for (const c of over.slice(0, 5)) c.creditLimit = Math.max(1000, Math.round((c.balance * 0.8) / 500) * 500);

  // طلبان بانتظار موافقة الائتمان اليوم
  const heldCandidates = over.slice(0, 2);
  for (const c of heldCandidates) {
    const rep = repById.get(c.repId)!;
    const p1 = products[17]!;
    const p2 = products[0]!;
    const lines: CartLine[] = [{ product: p1, qty: 10 }, { product: p2, qty: 20 }];
    const priced = priceCart(lines, c.priceList, offers, now);
    const id = `o${String(++oSeq).padStart(4, '0')}`;
    orders.push({
      id, no: `${new Date(now).toISOString().slice(2, 10).replace(/-/g, '')}-${id.slice(1)}`, customerId: c.id, customerName: c.name,
      repId: rep.id, repName: rep.name, zoneId: c.zoneId, warehouseId: 'w-main',
      items: priced.lines.map((l) => {
        const p = productById.get(l.productId)!;
        return { productId: p.id, name: p.name, emoji: p.emoji, unit: p.unit, qty: l.qty, freeQty: l.freeQty, price: l.price, discount: l.discount, lineTotal: l.lineTotal };
      }),
      subtotal: priced.subtotal, lineDiscount: priced.lineDiscount, orderDiscount: priced.orderDiscount, total: priced.total,
      paymentType: 'credit', paidNow: 0, dueAt: now + c.creditDays * DAY, status: 'credit_hold', createdAt: now - 25 * 60_000,
      updatedAt: now - 25 * 60_000, createdByName: rep.name, note: 'العميل تجاوز الحد الائتماني — بانتظار الموافقة',
    });
    c.balance += priced.total;
  }

  // وعود بالسداد
  const withDebt = customers.filter((c) => c.balance > 500 && c.active);
  [-1, 0, 1, 3].forEach((offset, i) => {
    const c = withDebt[i * 3];
    if (!c) return;
    c.promiseDate = startOfDay(now + offset * DAY);
    c.promiseAmount = Math.round(c.balance * 0.5);
  });

  // ----- المخزون -----
  const stock: StockItem[] = [];
  const lowIdx = new Set([2, 4, 9, 13, 17, 19]);
  const outIdx = new Set([4, 19]);
  products.forEach((p, i) => {
    const main = outIdx.has(i) ? 0 : lowIdx.has(i) ? int(2, Math.max(3, p.minStock - 12)) : int(p.minStock + 25, p.minStock * 4 + 60);
    stock.push({ id: `w-main_${p.id}`, warehouseId: 'w-main', productId: p.id, qty: main });
    const scarce = lowIdx.has(i);
    stock.push({ id: `w-east_${p.id}`, warehouseId: 'w-east', productId: p.id, qty: scarce ? int(0, 3) : int(10, 90) });
    if (i % 2 === 0 && !scarce) stock.push({ id: `w-van1_${p.id}`, warehouseId: 'w-van1', productId: p.id, qty: int(0, 30) });
    if (i % 3 === 0 && !scarce) stock.push({ id: `w-van2_${p.id}`, warehouseId: 'w-van2', productId: p.id, qty: int(0, 30) });
  });
  for (let i = 0; i < 14; i++) {
    const p = pick(products);
    movements.push({
      id: `m-rcv-${i}`, productId: p.id, warehouseId: pick(['w-main', 'w-main', 'w-east']), qty: int(3, 12) * 10, type: 'receive',
      note: 'استلام من المورّد', byName: 'أمين المخزن', createdAt: now - int(1, 28) * DAY - int(0, 8) * 3600_000,
    });
  }

  // ----- الزيارات -----
  const visits: Visit[] = [];
  let vSeq = 0;
  const lastVisit = new Map<string, number>();
  for (let d = 10; d >= 0; d--) {
    const dayStart = startOfDay(now - d * DAY);
    if (new Date(dayStart).getDay() === 5) continue;
    for (const rep of reps) {
      // بعض العملاء بلا زيارات حديثة عمدًا ليظهر تنبيه «عملاء لم تتم زيارتهم»
      const pool = customers.filter((c, ci) => c.repId === rep.id && c.active && ci % 6 !== 4);
      const n = d === 0 ? int(1, 3) : int(2, 4);
      for (let k = 0; k < n; k++) {
        const c = pick(pool);
        if (!c) continue;
        const ts = dayStart + int(8, d === 0 ? Math.max(9, new Date(now).getHours()) : 18) * 3600_000 + int(0, 59) * 60_000;
        if (ts > now) continue;
        const result = pick<VisitResult>(['order', 'order', 'collected', 'no_order', 'closed']);
        visits.push({
          id: `v${String(++vSeq).padStart(4, '0')}`, customerId: c.id, customerName: c.name, repId: rep.id, repName: rep.name,
          zoneId: c.zoneId, result, createdAt: ts,
        });
        lastVisit.set(c.id, Math.max(lastVisit.get(c.id) ?? 0, ts));
      }
    }
  }
  for (const c of customers) c.lastVisitAt = lastVisit.get(c.id);

  const company: SeedBundle['company'] = {
    name: 'شركة النور للتوزيع',
    phone: '0112345678',
    currency: 'SAR',
    dialCode: '966',
    defaultCreditDays: 30,
    createdAt: now - 400 * DAY,
  };

  const data: SeedData = {
    customers, products, warehouses, stock, stockMovements: movements, orders, collections, reps, zones, offers, visits,
  };
  return { company, data };
}
