import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgePercent, Gift, Pencil, Percent, Plus, Receipt, Target, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, NumInput, Segmented, Switch, TextInput } from '../components/ui/Fields';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { EmptyState, PageHeader, Progress, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { useActions, useRun } from '../data/useActions';
import { OFFER_TYPE_LABELS, type Offer, type OfferType } from '../data/types';
import { fmtDate, fmtNum } from '../lib/format';
import { newId } from '../lib/ids';
import { can } from '../lib/permissions';
import { describeOffer, offerStatus } from '../lib/pricing';
import { DAY, startOfDay } from '../lib/time';

const TYPE_ICON = { percent: Percent, bxgy: Gift, order_percent: Receipt };
const TYPE_COLOR: Record<OfferType, string> = { percent: '#6d4aff', bxgy: '#00b8a9', order_percent: '#f5b50a' };
const STATUS_META = { active: { label: 'فعّال', tone: 'green' }, scheduled: { label: 'مجدول', tone: 'blue' }, expired: { label: 'منتهٍ', tone: 'gray' }, paused: { label: 'موقوف', tone: 'amber' } } as const;

const toInput = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fromInput = (s: string, end = false) => new Date(`${s}T${end ? '23:59:59' : '00:00:00'}`).getTime();

function OfferForm({ open, onClose, offer }: { open: boolean; onClose: () => void; offer?: Offer }) {
  const { products, money, currencySymbol } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const blank = (): Offer => ({ id: newId(), name: '', type: 'percent', productIds: [], category: '', minQty: 5, percent: 10, buyQty: 10, freeQty: 1, minTotal: 5000, startAt: startOfDay(Date.now()), endAt: startOfDay(Date.now() + 30 * DAY) + DAY - 1, active: true });
  const [o, setO] = useState<Offer>(blank);
  const [scope, setScope] = useState<'category' | 'products'>('category');
  const [touched, setTouched] = useState(false);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  useEffect(() => {
    if (open) {
      const base = offer ? { ...offer, productIds: [...offer.productIds] } : { ...blank(), category: categories[0] ?? '' };
      setO(base);
      setScope(base.productIds.length ? 'products' : 'category');
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, offer]);
  const set = <K extends keyof Offer>(k: K, v: Offer[K]) => setO((s) => ({ ...s, [k]: v }));
  const itemOffer = o.type !== 'order_percent';
  const scopeOk = !itemOffer || (scope === 'category' ? !!o.category : o.productIds.length > 0);
  const valid = o.name.trim() && scopeOk && o.endAt >= o.startAt && (o.type === 'bxgy' ? o.buyQty > 0 && o.freeQty > 0 : o.percent > 0 && o.percent <= 100);
  const sym = currencySymbol;
  const toggleProduct = (id: string) => set('productIds', o.productIds.includes(id) ? o.productIds.filter((x) => x !== id) : [...o.productIds, id]);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    const payload: Offer = { ...o, name: o.name.trim(), productIds: itemOffer && scope === 'products' ? o.productIds : [], category: itemOffer && scope === 'category' ? o.category : '' };
    const ok = await run(async () => { await actions.saveOffer(payload); return true; }, offer ? 'تم تحديث العرض' : 'تم إنشاء العرض');
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={offer ? 'تعديل عرض' : 'عرض جديد'} width={640} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" loading={busy} onClick={save}>{offer ? 'حفظ' : 'إنشاء العرض'}</Button></>}>
      <div className="form-grid">
        <Field label="نوع العرض" className="full">
          {() => (
            <div className="type-grid">
              {(Object.keys(OFFER_TYPE_LABELS) as OfferType[]).map((t) => {
                const I = TYPE_ICON[t];
                return (
                  <button key={t} type="button" className="type-card" aria-pressed={o.type === t} onClick={() => set('type', t)} style={{ ['--tc' as string]: TYPE_COLOR[t] }}>
                    <I size={22} />
                    <b>{OFFER_TYPE_LABELS[t]}</b>
                  </button>
                );
              })}
            </div>
          )}
        </Field>
        <Field label="اسم العرض" className="full" error={touched && !o.name.trim() ? 'مطلوب' : undefined}>{(id) => <TextInput id={id} value={o.name} onChange={(e) => set('name', e.target.value)} invalid={touched && !o.name.trim()} placeholder="مثال: خصم 10% على المشروبات" />}</Field>
        {itemOffer && (
          <>
            <Field label="ينطبق على" className="full">{() => <Segmented name="offer-scope" value={scope} onChange={setScope} options={[{ value: 'category', label: 'فئة كاملة' }, { value: 'products', label: 'أصناف محددة' }]} />}</Field>
            {scope === 'category' ? (
              <Field label="الفئة" className="full">
                {() => <div className="chips">{categories.map((c) => <button key={c} type="button" className="chip" aria-pressed={o.category === c} onClick={() => set('category', c)}>{c}</button>)}</div>}
              </Field>
            ) : (
              <Field label={`الأصناف (${o.productIds.length})`} className="full" error={touched && o.productIds.length === 0 ? 'اختر صنفًا واحدًا على الأقل' : undefined}>
                {() => <div className="chips" style={{ maxHeight: 150, overflowY: 'auto' }}>{products.filter((p) => p.active).map((p) => <button key={p.id} type="button" className="chip" aria-pressed={o.productIds.includes(p.id)} onClick={() => toggleProduct(p.id)}>{p.emoji} {p.name}</button>)}</div>}
              </Field>
            )}
          </>
        )}
        {o.type === 'percent' && (
          <>
            <Field label="نسبة الخصم">{(id) => <NumInput id={id} value={o.percent} onChange={(v) => set('percent', Math.min(100, v))} suffix="%" />}</Field>
            <Field label="الحد الأدنى للكمية" hint="كمية الصنف الواحد">{(id) => <NumInput id={id} value={o.minQty} onChange={(v) => set('minQty', Math.round(v))} decimals={0} />}</Field>
          </>
        )}
        {o.type === 'bxgy' && (
          <>
            <Field label="اشترِ (كمية)">{(id) => <NumInput id={id} value={o.buyQty} onChange={(v) => set('buyQty', Math.round(v))} decimals={0} />}</Field>
            <Field label="واحصل على مجانًا">{(id) => <NumInput id={id} value={o.freeQty} onChange={(v) => set('freeQty', Math.round(v))} decimals={0} />}</Field>
          </>
        )}
        {o.type === 'order_percent' && (
          <>
            <Field label="نسبة الخصم">{(id) => <NumInput id={id} value={o.percent} onChange={(v) => set('percent', Math.min(100, v))} suffix="%" />}</Field>
            <Field label="عند إجمالي فاتورة من">{(id) => <NumInput id={id} value={o.minTotal} onChange={(v) => set('minTotal', v)} suffix={sym} />}</Field>
          </>
        )}
        <Field label="يبدأ في">{(id) => <TextInput id={id} type="date" value={toInput(o.startAt)} onChange={(e) => e.target.value && set('startAt', fromInput(e.target.value))} dir="ltr" style={{ textAlign: 'start' }} />}</Field>
        <Field label="ينتهي في" error={o.endAt < o.startAt ? 'يجب أن يكون بعد البداية' : undefined}>{(id) => <TextInput id={id} type="date" value={toInput(o.endAt)} onChange={(e) => e.target.value && set('endAt', fromInput(e.target.value, true))} dir="ltr" style={{ textAlign: 'start' }} />}</Field>
        <div className="callout info full"><Gift size={18} /> <span>{valid ? describeOffer(o, money) : 'أكمل بيانات العرض لمعاينته'} — يُطبَّق تلقائيًا عند إنشاء الطلب ويُختار الأفضل للعميل.</span></div>
      </div>
    </Modal>
  );
}

export default function Offers() {
  const { offers, orders, products, money } = useData();
  const { profile } = useAuth();
  const actions = useActions();
  const { run, busy } = useRun();
  const canEdit = can(profile!.role, 'offers.edit');
  const [editing, setEditing] = useState<Offer | undefined>();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Offer | undefined>();
  const now = Date.now();

  const usage = useMemo(() => {
    const m = new Map<string, { orders: number; saved: number }>();
    for (const ord of orders) {
      if (ord.status === 'cancelled') continue;
      const hit = new Set<string>();
      for (const it of ord.items) {
        if (!it.offerId) continue;
        const cur = m.get(it.offerId) ?? { orders: 0, saved: 0 };
        cur.saved += it.discount + it.freeQty * it.price;
        if (!hit.has(it.offerId)) {
          cur.orders += 1;
          hit.add(it.offerId);
        }
        m.set(it.offerId, cur);
      }
      if (ord.orderOfferName) {
        const o = offers.find((x) => x.name === ord.orderOfferName);
        if (o) {
          const cur = m.get(o.id) ?? { orders: 0, saved: 0 };
          cur.orders += 1;
          cur.saved += ord.orderDiscount;
          m.set(o.id, cur);
        }
      }
    }
    return m;
  }, [orders, offers]);

  const sorted = [...offers].sort((a, b) => {
    const rank = { active: 0, scheduled: 1, paused: 2, expired: 3 } as const;
    return rank[offerStatus(a, now)] - rank[offerStatus(b, now)] || b.startAt - a.startAt;
  });
  const activeCount = offers.filter((o) => offerStatus(o, now) === 'active').length;

  return (
    <>
      <PageHeader title="العروض والخصومات" subtitle={`${fmtNum(activeCount)} عرض فعّال الآن — تُطبَّق تلقائيًا في الطلبات`} actions={canEdit && <Button variant="primary" leading={<Plus size={18} />} onClick={() => setCreating(true)}>عرض جديد</Button>} />
      {offers.length === 0 ? <div className="card"><EmptyState icon={<Gift size={34} />} title="لا عروض بعد" text="أنشئ عرضًا لزيادة المبيعات وتحفيز العملاء على الشراء بكميات أكبر." action={canEdit ? { label: 'عرض جديد', onClick: () => setCreating(true) } : undefined} /></div> : (
        <motion.div className="offer-grid" variants={stagger} initial="hidden" animate="show">
          {sorted.map((o) => {
            const st = offerStatus(o, now);
            const meta = STATUS_META[st];
            const I = TYPE_ICON[o.type] ?? BadgePercent;
            const total = Math.max(o.endAt - o.startAt, 1);
            const elapsed = Math.min(Math.max(now - o.startAt, 0), total);
            const left = Math.ceil((o.endAt - now) / DAY);
            const u = usage.get(o.id);
            const scopeLabel = o.type === 'order_percent' ? 'كل الأصناف' : o.productIds.length ? o.productIds.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean).join('، ') : `فئة: ${o.category}`;
            return (
              <motion.article key={o.id} variants={rise} className="card offer-card" style={{ ['--tc' as string]: TYPE_COLOR[o.type], opacity: st === 'expired' ? 0.6 : 1 }}>
                <div className="offer-top">
                  <span className="offer-ico"><I size={24} /></span>
                  <div className="grow">
                    <b style={{ fontSize: '1.02rem', display: 'block', lineHeight: 1.4 }}>{o.name}</b>
                    <span className="muted small">{OFFER_TYPE_LABELS[o.type]}</span>
                  </div>
                  <Badge tone={meta.tone} dot pulse={st === 'active'}>{meta.label}</Badge>
                </div>
                <div className="offer-desc">{describeOffer(o, money)}</div>
                <div className="muted xs row" style={{ gap: 6 }} title={scopeLabel}><Target size={13} /><span className="truncate">{scopeLabel}</span></div>
                <div>
                  <div className="row between xs"><span className="muted">{fmtDate(o.startAt)} ← {fmtDate(o.endAt)}</span><b>{st === 'active' ? `باقي ${fmtNum(Math.max(left, 0))} يوم` : st === 'scheduled' ? `يبدأ بعد ${fmtNum(Math.ceil((o.startAt - now) / DAY))} يوم` : ''}</b></div>
                  <Progress value={elapsed} max={total} size="thin" c1={TYPE_COLOR[o.type]} c2={TYPE_COLOR[o.type]} />
                </div>
                <div className="offer-foot">
                  <div className="row" style={{ gap: '1rem' }}>
                    <span className="small"><b className="num">{fmtNum(u?.orders ?? 0)}</b> <span className="muted">طلب</span></span>
                    <span className="small"><b className="num">{money(u?.saved ?? 0, { compact: true })}</b> <span className="muted">خصم ممنوح</span></span>
                  </div>
                  {canEdit && (
                    <div className="row" style={{ gap: 4 }}>
                      <Switch checked={o.active} onChange={() => void run(() => actions.toggleOffer(o), o.active ? 'تم إيقاف العرض' : 'تم تفعيل العرض')} label="تفعيل العرض" />
                      <Button variant="ghost" icon size="sm" aria-label="تعديل" onClick={() => setEditing(o)}><Pencil size={15} /></Button>
                      <Button variant="ghost" icon size="sm" aria-label="حذف" onClick={() => setDeleting(o)}><Trash2 size={15} /></Button>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      )}
      <OfferForm open={creating || !!editing} onClose={() => { setCreating(false); setEditing(undefined); }} offer={editing} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(undefined)} danger loading={busy} title="حذف العرض" confirmLabel="حذف" text={`سيُحذف «${deleting?.name}» نهائيًا. الطلبات السابقة لن تتأثر.`} onConfirm={async () => { if (!deleting) return; const ok = await run(async () => { await actions.deleteOffer(deleting.id); return true; }, 'تم حذف العرض'); if (ok) setDeleting(undefined); }} />
    </>
  );
}
