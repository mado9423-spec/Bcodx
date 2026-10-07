import type { Offer, PriceList, Product } from '../data/types';
import { round2 } from './format';

export interface CartLine {
  product: Product;
  qty: number;
}

export interface PricedLine {
  productId: string;
  qty: number;
  freeQty: number;
  price: number;
  discount: number;
  lineTotal: number;
  offerId?: string;
  offerName?: string;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
  lineDiscount: number;
  orderDiscount: number;
  orderOfferId?: string;
  orderOfferName?: string;
  total: number;
}

export const priceFor = (p: Product, list: PriceList) => p.prices[list] ?? p.prices.wholesale;

export function isOfferLive(o: Offer, now: number): boolean {
  return o.active && o.startAt <= now && now <= o.endAt;
}

export function offerStatus(o: Offer, now: number): 'active' | 'scheduled' | 'expired' | 'paused' {
  if (!o.active) return 'paused';
  if (now < o.startAt) return 'scheduled';
  if (now > o.endAt) return 'expired';
  return 'active';
}

function inScope(o: Offer, p: Product): boolean {
  if (o.productIds.length > 0) return o.productIds.includes(p.id);
  if (o.category) return o.category === p.category;
  return false;
}

interface LineBenefit {
  offer: Offer;
  discount: number;
  freeQty: number;
  value: number;
}

function lineBenefit(o: Offer, p: Product, qty: number, price: number): LineBenefit | null {
  if (!inScope(o, p)) return null;
  if (o.type === 'percent') {
    if (qty < Math.max(1, o.minQty)) return null;
    const discount = round2((qty * price * o.percent) / 100);
    return discount > 0 ? { offer: o, discount, freeQty: 0, value: discount } : null;
  }
  if (o.type === 'bxgy') {
    if (o.buyQty < 1 || o.freeQty < 1 || qty < o.buyQty) return null;
    const freeQty = Math.floor(qty / o.buyQty) * o.freeQty;
    return freeQty > 0 ? { offer: o, discount: 0, freeQty, value: freeQty * price } : null;
  }
  return null;
}

/**
 * يحسب سلة الطلب: أفضل عرض واحد لكل سطر (بدون تراكم عروض الأصناف)، ثم أفضل عرض على إجمالي الفاتورة.
 * يتم اختيار العرض الأكبر قيمةً للعميل تلقائيًا ليكون السلوك متوقعًا وشفافًا.
 */
export function priceCart(lines: CartLine[], list: PriceList, offers: Offer[], now: number): PricedCart {
  const live = offers.filter((o) => isOfferLive(o, now));
  const priced: PricedLine[] = lines
    .filter((l) => l.qty > 0)
    .map((l) => {
      const price = priceFor(l.product, list);
      const gross = round2(l.qty * price);
      let best: LineBenefit | null = null;
      for (const o of live) {
        const b = lineBenefit(o, l.product, l.qty, price);
        if (b && (!best || b.value > best.value)) best = b;
      }
      const discount = best?.discount ?? 0;
      return {
        productId: l.product.id,
        qty: l.qty,
        freeQty: best?.freeQty ?? 0,
        price,
        discount,
        lineTotal: round2(gross - discount),
        offerId: best?.offer.id,
        offerName: best?.offer.name,
      };
    });

  const subtotal = round2(priced.reduce((s, l) => s + l.qty * l.price, 0));
  const lineDiscount = round2(priced.reduce((s, l) => s + l.discount, 0));
  const afterLines = round2(subtotal - lineDiscount);

  let orderOffer: Offer | undefined;
  for (const o of live) {
    if (o.type !== 'order_percent' || afterLines < o.minTotal) continue;
    if (!orderOffer || o.percent > orderOffer.percent) orderOffer = o;
  }
  const orderDiscount = orderOffer ? round2((afterLines * orderOffer.percent) / 100) : 0;

  return {
    lines: priced,
    subtotal,
    lineDiscount,
    orderDiscount,
    orderOfferId: orderOffer?.id,
    orderOfferName: orderOffer?.name,
    total: round2(afterLines - orderDiscount),
  };
}

export function describeOffer(o: Offer, money: (n: number) => string): string {
  if (o.type === 'percent') return `خصم ${o.percent}% عند شراء ${o.minQty > 1 ? o.minQty + ' وحدات أو أكثر' : 'أي كمية'}`;
  if (o.type === 'bxgy') return `اشترِ ${o.buyQty} واحصل على ${o.freeQty} مجانًا`;
  return `خصم ${o.percent}% على الفاتورة عند ${money(o.minTotal)} فأكثر`;
}
