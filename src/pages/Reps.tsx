import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, MessageCircle, Pencil, Phone, Plus, Truck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Ring } from '../components/ui/Charts';
import { CountUp } from '../components/ui/CountUp';
import { Field, NumInput, Switch, TextInput } from '../components/ui/Fields';
import { Modal } from '../components/ui/Modal';
import { EmptyState, PageHeader, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { useActions, useRun } from '../data/useActions';
import type { Rep } from '../data/types';
import { PALETTE } from '../lib/colors';
import { fmtNum, fmtPct } from '../lib/format';
import { newId } from '../lib/ids';
import { can } from '../lib/permissions';
import { groupSum, isActiveCollection, isSale } from '../lib/stats';
import { DAY, startOfMonth } from '../lib/time';
import { openWhatsApp } from '../lib/whatsapp';

function RepForm({ open, onClose, rep }: { open: boolean; onClose: () => void; rep?: Rep }) {
  const { zones, currencySymbol } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const blank = (): Rep => ({ id: newId(), name: '', phone: '', zoneIds: [], salesTarget: 80000, collectionTarget: 55000, active: true, color: PALETTE[Math.floor(Math.random() * PALETTE.length)]! });
  const [r, setR] = useState<Rep>(blank);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setR(rep ? { ...rep, zoneIds: [...rep.zoneIds] } : blank());
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rep]);
  const sym = currencySymbol;
  const toggleZone = (id: string) => setR((s) => ({ ...s, zoneIds: s.zoneIds.includes(id) ? s.zoneIds.filter((z) => z !== id) : [...s.zoneIds, id] }));
  return (
    <Modal open={open} onClose={onClose} title={rep ? 'تعديل مندوب' : 'مندوب جديد'} width={580} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" loading={busy} onClick={async () => { setTouched(true); if (!r.name.trim()) return; const ok = await run(async () => { await actions.saveRep({ ...r, name: r.name.trim() }); return true; }, rep ? 'تم التحديث' : 'تمت إضافة المندوب ✓'); if (ok) onClose(); }}>{rep ? 'حفظ' : 'إضافة'}</Button></>}>
      <div className="form-grid">
        <Field label="اسم المندوب" error={touched && !r.name.trim() ? 'مطلوب' : undefined}>{(id) => <TextInput id={id} value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} invalid={touched && !r.name.trim()} data-autofocus />}</Field>
        <Field label="الجوال">{(id) => <TextInput id={id} value={r.phone} onChange={(e) => setR({ ...r, phone: e.target.value })} dir="ltr" style={{ textAlign: 'start' }} inputMode="tel" />}</Field>
        <Field label="هدف المبيعات الشهري">{(id) => <NumInput id={id} value={r.salesTarget} onChange={(v) => setR({ ...r, salesTarget: v })} suffix={sym} />}</Field>
        <Field label="هدف التحصيل الشهري">{(id) => <NumInput id={id} value={r.collectionTarget} onChange={(v) => setR({ ...r, collectionTarget: v })} suffix={sym} />}</Field>
        <Field label="مناطق التغطية" className="full">
          {() => (
            <div className="chips">
              {zones.map((z) => <button key={z.id} type="button" className="chip" aria-pressed={r.zoneIds.includes(z.id)} onClick={() => toggleZone(z.id)}>{z.name}</button>)}
            </div>
          )}
        </Field>
        <Field label="لون التمييز" className="full">
          {() => <div className="emoji-pick">{PALETTE.map((c) => <button key={c} type="button" aria-pressed={r.color === c} onClick={() => setR({ ...r, color: c })} aria-label={c} style={{ background: c, width: 34, height: 34, borderRadius: 10 }} />)}</div>}
        </Field>
        {rep && <div className="row between full"><b className="small">المندوب نشط</b><Switch checked={r.active} onChange={(v) => setR({ ...r, active: v })} label="نشط" /></div>}
      </div>
    </Modal>
  );
}

export default function Reps() {
  const { reps, orders, collections, customers, visits, money } = useData();
  const { profile } = useAuth();
  const role = profile!.role;
  const canEdit = can(role, 'reps.edit');
  const [editing, setEditing] = useState<Rep | undefined>();
  const [creating, setCreating] = useState(false);
  const { zoneById } = useData();

  const stats = useMemo(() => {
    const now = Date.now();
    const ms = startOfMonth(now);
    const sales = orders.filter((o) => isSale(o) && o.createdAt >= ms);
    const cols = collections.filter((c) => isActiveCollection(c) && c.createdAt >= ms);
    const sBy = groupSum(sales, (o) => o.repId, (o) => o.total);
    const cBy = groupSum(cols, (c) => c.repId, (c) => c.amount);
    const nBy = groupSum(sales, (o) => o.repId, () => 1);
    const vBy = groupSum(visits.filter((v) => v.createdAt >= now - 7 * DAY), (v) => v.repId, () => 1);
    const custBy = groupSum(customers.filter((c) => c.active), (c) => c.repId, () => 1);
    const covBy = groupSum(customers.filter((c) => c.active && (c.lastVisitAt ?? 0) >= now - 14 * DAY), (c) => c.repId, () => 1);
    return reps.map((r) => {
      const s = sBy.get(r.id) ?? 0;
      const n = nBy.get(r.id) ?? 0;
      const cu = custBy.get(r.id) ?? 0;
      return { rep: r, sales: s, cols: cBy.get(r.id) ?? 0, orders: n, visits: vBy.get(r.id) ?? 0, customers: cu, coverage: cu ? ((covBy.get(r.id) ?? 0) / cu) * 100 : 0, avg: n ? s / n : 0 };
    });
  }, [reps, orders, collections, customers, visits]);

  const ranked = [...stats].filter((s) => s.rep.active).sort((a, b) => b.sales - a.sales);
  const top3 = ranked.slice(0, 3);

  return (
    <>
      <PageHeader title="المندوبون" subtitle={`${fmtNum(reps.filter((r) => r.active).length)} مندوب نشط • أداء الشهر الحالي`} actions={canEdit && <Button variant="primary" leading={<Plus size={18} />} onClick={() => setCreating(true)}>مندوب جديد</Button>} />
      {top3.length >= 2 && role !== 'rep' && (
        <motion.div className="podium card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {[top3[1], top3[0], top3[2]].filter(Boolean).map((s) => {
            const place = ranked.indexOf(s!) + 1;
            return (
              <motion.div key={s!.rep.id} className={`podium-col p${place}`} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: place === 1 ? 0.25 : place === 2 ? 0.1 : 0.4, type: 'spring', stiffness: 200, damping: 18 }}>
                {place === 1 && <Crown className="crown" size={26} />}
                <Avatar name={s!.rep.name} color={s!.rep.color} size={place === 1 ? 'xl' : 'lg'} round />
                <b>{s!.rep.name}</b>
                <span className="num muted small">{money(s!.sales, { compact: true })}</span>
                <div className="podium-bar" style={{ height: place === 1 ? 84 : place === 2 ? 60 : 44 }}>{place}</div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
      {reps.length === 0 ? <div className="card"><EmptyState icon={<Truck size={34} />} title="لا مندوبين بعد" text="أضف مندوبيك لتتبع أدائهم وأهدافهم." action={canEdit ? { label: 'مندوب جديد', onClick: () => setCreating(true) } : undefined} /></div> : (
        <motion.div className="rep-grid" variants={stagger} initial="hidden" animate="show">
          {stats.map((s) => (
            <motion.article key={s.rep.id} variants={rise} className="card rep-card" style={{ opacity: s.rep.active ? 1 : 0.55, ['--rc' as string]: s.rep.color }}>
              <div className="rep-banner" />
              <div className="rep-head">
                <Avatar name={s.rep.name} color={s.rep.color} size="lg" round />
                <div className="grow">
                  <b style={{ fontSize: '1.05rem' }}>{s.rep.name}</b>
                  <div className="row wrap" style={{ gap: 4, marginTop: 4 }}>
                    {s.rep.zoneIds.map((z) => <Badge key={z} tone="violet">{zoneById.get(z)?.name}</Badge>)}
                    {!s.rep.active && <Badge>غير نشط</Badge>}
                  </div>
                </div>
                {canEdit && <Button variant="ghost" icon size="sm" aria-label="تعديل" onClick={() => setEditing(s.rep)}><Pencil size={16} /></Button>}
              </div>
              <div className="rep-rings">
                <div className="rep-ring">
                  <Ring value={s.sales} max={s.rep.salesTarget} size={96} stroke={9} color="var(--chart-1)">
                    <b style={{ fontSize: '1rem' }}><CountUp value={(s.sales / Math.max(s.rep.salesTarget, 1)) * 100} format={(n) => `${fmtNum(Math.round(n))}%`} /></b>
                  </Ring>
                  <span className="small bold">المبيعات</span>
                  <span className="muted xs">{money(s.sales, { compact: true })} / {money(s.rep.salesTarget, { compact: true })}</span>
                </div>
                <div className="rep-ring">
                  <Ring value={s.cols} max={s.rep.collectionTarget} size={96} stroke={9} color="var(--chart-2)">
                    <b style={{ fontSize: '1rem' }}><CountUp value={(s.cols / Math.max(s.rep.collectionTarget, 1)) * 100} format={(n) => `${fmtNum(Math.round(n))}%`} /></b>
                  </Ring>
                  <span className="small bold">التحصيل</span>
                  <span className="muted xs">{money(s.cols, { compact: true })} / {money(s.rep.collectionTarget, { compact: true })}</span>
                </div>
              </div>
              <div className="rep-stats">
                <div><b className="num">{fmtNum(s.orders)}</b><span>طلب</span></div>
                <div><b className="num">{fmtNum(s.customers)}</b><span>عميل</span></div>
                <div><b className="num">{fmtNum(s.visits)}</b><span>زيارة / أسبوع</span></div>
                <div><b className="num">{fmtPct(s.coverage)}</b><span>تغطية 14 يوم</span></div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <Button size="sm" className="grow" leading={<Phone size={15} />} onClick={() => (window.location.href = `tel:${s.rep.phone}`)}>اتصال</Button>
                <Button variant="wa" size="sm" className="grow" leading={<MessageCircle size={15} />} onClick={() => openWhatsApp(s.rep.phone, '966', `مرحبًا ${s.rep.name}`)}>واتساب</Button>
              </div>
            </motion.article>
          ))}
        </motion.div>
      )}
      <RepForm open={creating || !!editing} onClose={() => { setCreating(false); setEditing(undefined); }} rep={editing} />
    </>
  );
}
