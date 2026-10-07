import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Banknote, Clock, Gift, Lightbulb, Send, ShieldAlert, ShoppingCart, Sparkles, Target, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CustomerPicker } from '../components/forms/CustomerPicker';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, NumInput, QtyStepper, SearchInput, Segmented, SelectInput, TextInput } from '../components/ui/Fields';
import { Progress } from '../components/ui/Misc';
import { fireConfetti } from '../components/ui/confetti';
import { useData } from '../data/DataContext';
import { useActions, useRun } from '../data/useActions';
import { PRICE_LIST_LABELS, type Customer, type Offer, type Product } from '../data/types';
import { colorFor } from '../lib/colors';
import { creditCheck } from '../lib/credit';
import { fmtNum } from '../lib/format';
import { can } from '../lib/permissions';
import { isOfferLive, priceCart, priceFor } from '../lib/pricing';

const DRAFT_KEY = 'bhub:draft:order';

interface Draft {
  customerId?: string;
  warehouseId?: string;
  qtys: Record<string, number>;
  paymentType: 'cash' | 'credit';
  paidNow: number;
  note: string;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function offerAppliesTo(o: Offer, p: Product): boolean {
  if (o.type === 'order_percent') return false;
  if (o.productIds.length) return o.productIds.includes(p.id);
  return !!o.category && o.category === p.category;
}

function offerTag(o: Offer): string {
  if (o.type === 'percent') return `خصم ${o.percent}% من ${o.minQty > 1 ? o.minQty : 1}+`;
  return `اشترِ ${o.buyQty} +${o.freeQty} مجانًا`;
}

export default function NewOrder() {
  const { products, warehouses, reps, offers, stockQty, customerById, repById, zoneById, money, currencySymbol } = useData();
  const { profile } = useAuth();
  const actions = useActions();
  const { run, busy } = useRun();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const role = profile!.role;
  const canApprove = can(role, 'orders.approve_credit');

  const draft = useMemo(() => loadDraft(), []);
  const presetCustomer = params.get('customer');

  const defaultWarehouse = useMemo(() => {
    if (role === 'rep' && profile!.repId) {
      const van = warehouses.find((w) => w.type === 'van' && w.repId === profile!.repId);
      if (van) return van.id;
    }
    return warehouses.find((w) => w.type === 'main')?.id ?? warehouses[0]?.id ?? '';
  }, [warehouses, role, profile]);

  const [customerId, setCustomerId] = useState<string | undefined>(presetCustomer ?? draft?.customerId);
  const [warehouseId, setWarehouseId] = useState<string>(draft?.warehouseId && warehouses.some((w) => w.id === draft.warehouseId) ? draft.warehouseId : defaultWarehouse);
  const [repId, setRepId] = useState<string>('');
  const [qtys, setQtys] = useState<Record<string, number>>(draft?.qtys ?? {});
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>(draft?.paymentType ?? 'credit');
  const [paidNow, setPaidNow] = useState(draft?.paidNow ?? 0);
  const [note, setNote] = useState(draft?.note ?? '');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');

  const customer: Customer | undefined = customerId ? customerById.get(customerId) : undefined;
  const effRepId = role === 'rep' ? profile!.repId ?? '' : repId || customer?.repId || '';
  const rep = repById.get(effRepId);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ customerId, warehouseId, qtys, paymentType, paidNow, note } satisfies Draft));
    } catch {
      /* ignore */
    }
  }, [customerId, warehouseId, qtys, paymentType, paidNow, note]);

  const categories = useMemo(() => [...new Set(products.filter((p) => p.active).map((p) => p.category))], [products]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => p.active && (cat === 'all' || p.category === cat) && (!t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t))).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [products, cat, q]);

  const now = Date.now();
  const liveOffers = useMemo(() => offers.filter((o) => isOfferLive(o, now)), [offers, now]);
  const priceList = customer?.priceList ?? 'wholesale';
  const lines = useMemo(() => products.filter((p) => (qtys[p.id] ?? 0) > 0).map((p) => ({ product: p, qty: qtys[p.id]! })), [products, qtys]);
  const priced = useMemo(() => priceCart(lines, priceList, offers, now), [lines, priceList, offers, now]);
  const pricedById = new Map(priced.lines.map((l) => [l.productId, l]));

  const stockIssues = lines.filter((l) => l.qty + (pricedById.get(l.product.id)?.freeQty ?? 0) > stockQty(warehouseId, l.product.id));
  const paid = paymentType === 'cash' ? priced.total : Math.min(paidNow, priced.total);
  const newDebt = priced.total - paid;
  const cc = customer ? creditCheck(customer, newDebt) : undefined;
  const exceeds = !!cc?.exceeds && newDebt > 0;
  const creditHold = exceeds && !canApprove;
  const afterLines = priced.subtotal - priced.lineDiscount;
  const hintOrder = liveOffers
    .filter((o) => o.type === 'order_percent' && o.minTotal > afterLines && afterLines > 0)
    .sort((a, b) => a.minTotal - b.minTotal)[0];

  const setQty = (id: string, n: number) => setQtys((m) => {
    const next = { ...m };
    if (n <= 0) delete next[id];
    else next[id] = n;
    return next;
  });

  const lineHint = (p: Product, qty: number): string | null => {
    for (const o of liveOffers) {
      if (!offerAppliesTo(o, p)) continue;
      if (o.type === 'bxgy' && o.buyQty > 0) {
        const rem = o.buyQty - (qty % o.buyQty || o.buyQty);
        if (qty < o.buyQty) return `أضف ${o.buyQty - qty} لتحصل على ${o.freeQty} مجانًا`;
        if (rem > 0 && rem <= Math.ceil(o.buyQty / 2)) return `أضف ${rem} للحصول على ${o.freeQty} إضافية مجانًا`;
      }
      if (o.type === 'percent' && qty < o.minQty) return `أضف ${o.minQty - qty} للحصول على خصم ${o.percent}%`;
    }
    return null;
  };

  const canSubmit = !!customer && !!rep && lines.length > 0 && stockIssues.length === 0 && !busy && !!warehouseId;

  const submit = async () => {
    if (!customer || !canSubmit) return;
    const order = await run(
      () => actions.createOrder({ customer, rep, warehouseId, lines, priced, paymentType, paidNow: paid, note: note.trim() || undefined, creditHold }),
      (o) => (creditHold ? `أُرسل الطلب #${o.no} لموافقة الائتمان` : `تم إنشاء الطلب #${o.no} ✓`),
    );
    if (order) {
      fireConfetti();
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      nav(`/orders?open=${order.id}`);
    }
  };

  const clearAll = () => {
    setQtys({});
    setNote('');
    setPaidNow(0);
  };


  return (
    <>
      <div className="page-head">
        <div className="grow">
          <Link to="/orders" className="back-link"><ArrowRight size={16} /> الطلبات</Link>
          <h1>طلب جديد</h1>
          <p className="muted">اختر العميل ثم أضف الأصناف — العروض والأسعار والائتمان تُحسب تلقائيًا.</p>
        </div>
      </div>

      <div className="neworder">
        <section className="no-products">
          <div className="toolbar" style={{ marginBottom: '0.8rem' }}>
            <SearchInput className="grow" value={q} onChange={setQ} placeholder="ابحث عن صنف أو رمز…" />
          </div>
          <div className="chips" style={{ marginBottom: '1rem' }}>
            <button className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>الكل</button>
            {categories.map((c) => (
              <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="ptile-grid">
            {list.map((p) => {
              const avail = stockQty(warehouseId, p.id);
              const qty = qtys[p.id] ?? 0;
              const color = colorFor(p.category);
              const offer = liveOffers.find((o) => offerAppliesTo(o, p));
              const out = avail <= 0;
              return (
                <motion.div key={p.id} layout className={`ptile ${qty > 0 ? 'in-cart' : ''} ${out ? 'out' : ''}`} style={{ ['--pc' as string]: color }} whileHover={out ? undefined : { y: -3 }}>
                  {offer && <span className="ribbon"><Gift size={12} /> {offerTag(offer)}</span>}
                  <div className="ptile-emoji">{p.emoji}</div>
                  <b className="ptile-name">{p.name}</b>
                  <div className="row between" style={{ marginTop: 'auto' }}>
                    <div>
                      <div className="num bold">{money(priceFor(p, priceList))}</div>
                      <div className="muted xs">للـ{p.unit}</div>
                    </div>
                    <span className={`stock-pill ${out ? 'out' : avail <= p.minStock ? 'low' : ''}`}>{out ? 'نافد' : `${fmtNum(avail)} متاح`}</span>
                  </div>
                  {qty === 0 ? (
                    <Button size="sm" variant="soft" block disabled={out} onClick={() => setQty(p.id, 1)} leading={<ShoppingCart size={15} />}>أضف</Button>
                  ) : (
                    <QtyStepper value={qty} onChange={(n) => setQty(p.id, n)} max={avail} ariaLabel={`كمية ${p.name}`} />
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

        <aside className="cart card" aria-label="سلة الطلب">
          <div className="cart-head">
            <h3><ShoppingCart size={18} /> الطلب {lines.length > 0 && <Badge tone="violet">{lines.length} صنف</Badge>}</h3>
            {lines.length > 0 && <Button variant="ghost" size="sm" onClick={clearAll} leading={<Trash2 size={14} />}>تفريغ</Button>}
          </div>
          <div className="cart-body">
            <Field label="العميل">{() => <CustomerPicker value={customer} onChange={(c) => setCustomerId(c?.id)} />}</Field>
            {customer && (
              <div className="cust-snap">
                <div className="row between small">
                  <span className="muted">قائمة الأسعار</span>
                  <b>{PRICE_LIST_LABELS[customer.priceList]}</b>
                </div>
                {customer.creditLimit > 0 && (
                  <>
                    <Progress value={customer.balance + Math.max(0, newDebt)} max={customer.creditLimit} size="thin" c1={exceeds ? '#e5385f' : '#00b8a9'} c2={exceeds ? '#ff6b5b' : '#5eead4'} />
                    <div className="row between xs muted">
                      <span>رصيد {money(customer.balance)} → {money(customer.balance + Math.max(0, newDebt))}</span>
                      <span>الحد {money(customer.creditLimit, { compact: true })}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="form-grid" style={{ gap: '0.75rem' }}>
              <Field label="المخزن">
                {(id) => (
                  <SelectInput id={id} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </SelectInput>
                )}
              </Field>
              {role !== 'rep' ? (
                <Field label="المندوب">
                  {(id) => (
                    <SelectInput id={id} value={effRepId} onChange={(e) => setRepId(e.target.value)}>
                      {reps.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </SelectInput>
                  )}
                </Field>
              ) : (
                <Field label="المنطقة">{() => <div className="input" style={{ display: 'flex', alignItems: 'center' }}>{customer ? zoneById.get(customer.zoneId)?.name : '—'}</div>}</Field>
              )}
            </div>

            <div className="cart-lines">
              <AnimatePresence initial={false}>
                {lines.length === 0 && (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="empty" style={{ padding: '1.4rem 0.5rem' }}>
                    <ShoppingCart size={34} color="var(--brand)" />
                    <b>السلة فارغة</b>
                    <span className="small">اضغط «أضف» على أي صنف.</span>
                  </motion.div>
                )}
                {lines.map((l) => {
                  const pl = pricedById.get(l.product.id);
                  const bad = stockIssues.some((s) => s.product.id === l.product.id);
                  const hint = lineHint(l.product, l.qty);
                  return (
                    <motion.div key={l.product.id} layout initial={{ opacity: 0, x: 30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className={`cart-line ${bad ? 'bad' : ''}`}>
                      <span className="cl-emoji">{l.product.emoji}</span>
                      <div className="grow">
                        <b className="truncate" style={{ display: 'block', fontSize: '0.875rem' }}>{l.product.name}</b>
                        <span className="muted xs">{money(pl?.price ?? 0)} × {l.qty}</span>
                        {pl?.offerName && <div className="xs offer-line"><Sparkles size={11} /> {pl.freeQty > 0 ? `+${pl.freeQty} مجانًا` : `وفّرت ${money(pl.discount)}`}</div>}
                        {!pl?.offerName && hint && <div className="xs hint-line row" style={{ gap: 4 }}><Lightbulb size={12} /> {hint}</div>}
                        {bad && <div className="xs" style={{ color: 'var(--bad)', fontWeight: 700 }}>المتاح {fmtNum(stockQty(warehouseId, l.product.id))} فقط</div>}
                      </div>
                      <div className="cl-end">
                        <b className="num">{money(pl?.lineTotal ?? 0)}</b>
                        <QtyStepper value={l.qty} onChange={(n) => setQty(l.product.id, n)} max={stockQty(warehouseId, l.product.id)} ariaLabel={`كمية ${l.product.name}`} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {hintOrder && (
              <div className="upsell">
                <div className="small row" style={{ gap: 6 }}><Target size={15} /><span><b>أضف {money(hintOrder.minTotal - afterLines)}</b> للحصول على خصم {hintOrder.percent}% على الفاتورة</span></div>
                <Progress value={afterLines} max={hintOrder.minTotal} size="thin" c1="#f5b50a" c2="#ff9a3c" />
              </div>
            )}

            {lines.length > 0 && (
              <div className="totals compact">
                <div><span>المجموع</span><b className="num">{money(priced.subtotal)}</b></div>
                {priced.lineDiscount > 0 && <div className="disc"><span>خصم الأصناف</span><b className="num">-{money(priced.lineDiscount)}</b></div>}
                {priced.orderDiscount > 0 && <div className="disc"><span>{priced.orderOfferName}</span><b className="num">-{money(priced.orderDiscount)}</b></div>}
                <div className="grand"><span>الإجمالي</span><b className="num">{money(priced.total)}</b></div>
              </div>
            )}

            <Field label="طريقة الدفع">
              {() => (
                <Segmented
                  name="paytype"
                  value={paymentType}
                  onChange={setPaymentType}
                  options={[
                    { value: 'credit', label: <><Clock size={15} /> آجل</> },
                    { value: 'cash', label: <><Banknote size={15} /> نقدي</> },
                  ]}
                />
              )}
            </Field>
            {paymentType === 'credit' && (
              <Field label="دفعة مقدّمة الآن (اختياري)">{(id) => <NumInput id={id} value={paidNow} onChange={setPaidNow} suffix={currencySymbol} />}</Field>
            )}

            {exceeds && cc && (
              <div className={`callout ${creditHold ? 'bad' : 'warn'}`}>
                <ShieldAlert size={18} />
                <span>
                  سيتجاوز العميل حده الائتماني بمقدار <b>{money(cc.projected - cc.limit)}</b>.{' '}
                  {creditHold ? 'سيُرسل الطلب إلى المدير لموافقة الائتمان قبل الاعتماد.' : 'سيُعتمد مباشرة بصلاحيتك.'}
                </span>
              </div>
            )}
            {stockIssues.length > 0 && <div className="callout bad"><ShieldAlert size={18} /> الكمية المطلوبة أكبر من المتاح في المخزن لبعض الأصناف.</div>}

            <Field label="ملاحظة">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="تعليمات التسليم…" />}</Field>
          </div>
          <div className="cart-foot">
            <Button variant={creditHold ? 'danger' : 'primary'} size="lg" block loading={busy} disabled={!canSubmit} onClick={submit} leading={<Send size={18} />}>
              {creditHold ? 'إرسال لموافقة الائتمان' : 'تأكيد الطلب'} {lines.length > 0 && `• ${money(priced.total)}`}
            </Button>
            {!customer && lines.length > 0 && <p className="muted xs center">اختر العميل لإتمام الطلب</p>}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {lines.length > 0 && (
          <motion.div className="cart-bar" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}>
            <div>
              <div className="muted xs">{lines.length} صنف</div>
              <b className="num">{money(priced.total)}</b>
            </div>
            <Button variant="primary" onClick={() => document.querySelector('.cart')?.scrollIntoView({ behavior: 'smooth' })}>مراجعة وإرسال</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
