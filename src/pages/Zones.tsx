import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Map, MapPin, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Fields';
import { Drawer, Modal } from '../components/ui/Modal';
import { EmptyState, PageHeader, Progress, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { useActions, useRun } from '../data/useActions';
import type { Zone } from '../data/types';
import { PALETTE } from '../lib/colors';
import { fmtAgo, fmtNum, fmtPct } from '../lib/format';
import { newId } from '../lib/ids';
import { can } from '../lib/permissions';
import { groupSum, isSale } from '../lib/stats';
import { DAY, startOfMonth } from '../lib/time';

function ZoneForm({ open, onClose, zone }: { open: boolean; onClose: () => void; zone?: Zone }) {
  const actions = useActions();
  const { run, busy } = useRun();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]!);
  useEffect(() => {
    if (open) {
      setName(zone?.name ?? '');
      setColor(zone?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]!);
    }
  }, [open, zone]);
  return (
    <Modal open={open} onClose={onClose} title={zone ? 'تعديل منطقة' : 'منطقة جديدة'} width={440} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={async () => { const ok = await run(async () => { await actions.saveZone({ id: zone?.id ?? newId(), name: name.trim(), color }); return true; }, 'تم الحفظ ✓'); if (ok) onClose(); }}>حفظ</Button></>}>
      <div className="col">
        <Field label="اسم المنطقة">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} data-autofocus />}</Field>
        <Field label="اللون">{() => <div className="emoji-pick">{PALETTE.map((c) => <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)} aria-label={c} style={{ background: c, width: 34, height: 34, borderRadius: 10 }} />)}</div>}</Field>
      </div>
    </Modal>
  );
}

export default function Zones() {
  const { zones, customers, orders, reps, money, repById } = useData();
  const { profile } = useAuth();
  const canEdit = can(profile!.role, 'zones.edit');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Zone | undefined>();
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    const now = Date.now();
    const ms = startOfMonth(now);
    const sBy = groupSum(orders.filter((o) => isSale(o) && o.createdAt >= ms), (o) => o.zoneId, (o) => o.total);
    return zones.map((z) => {
      const cs = customers.filter((c) => c.zoneId === z.id);
      const active = cs.filter((c) => c.active);
      const visited = active.filter((c) => (c.lastVisitAt ?? 0) >= now - 14 * DAY).length;
      return {
        zone: z, customers: cs, active: active.length, sales: sBy.get(z.id) ?? 0, debt: cs.reduce((s, c) => s + Math.max(0, c.balance), 0),
        coverage: active.length ? (visited / active.length) * 100 : 0, reps: reps.filter((r) => r.zoneIds.includes(z.id)),
      };
    });
  }, [zones, customers, orders, reps]);

  const maxSales = Math.max(1, ...stats.map((s) => s.sales));
  const totalSales = stats.reduce((s, x) => s + x.sales, 0);
  const sel = stats.find((s) => s.zone.id === open);

  return (
    <>
      <PageHeader title="مناطق التوزيع" subtitle="أداء كل منطقة: المبيعات، الديون، وتغطية الزيارات" actions={canEdit && <Button variant="primary" leading={<Plus size={18} />} onClick={() => setCreating(true)}>منطقة جديدة</Button>} />
      {zones.length === 0 ? <div className="card"><EmptyState icon={<Map size={34} />} title="لا مناطق بعد" action={canEdit ? { label: 'منطقة جديدة', onClick: () => setCreating(true) } : undefined} /></div> : (
        <>
          <div className="card pad bubbles-card">
            <div className="muted small bold" style={{ marginBottom: 8 }}>خريطة حجم المبيعات (الشهر الحالي)</div>
            <div className="bubbles">
              {[...stats].sort((a, b) => b.sales - a.sales).map((s, i) => {
                const size = 78 + Math.sqrt(s.sales / maxSales) * 120;
                return (
                  <motion.button key={s.zone.id} className="bubble" style={{ width: size, height: size, background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${s.zone.color} 70%, #fff), ${s.zone.color})` }} initial={{ scale: 0 }} animate={{ scale: 1, y: [0, -6, 0] }} transition={{ scale: { type: 'spring', delay: i * 0.08, stiffness: 200, damping: 14 }, y: { repeat: Infinity, duration: 3 + i * 0.4, ease: 'easeInOut', delay: i * 0.2 } }} whileHover={{ scale: 1.08 }} onClick={() => setOpen(s.zone.id)}>
                    <b>{s.zone.name}</b>
                    <span className="num">{money(s.sales, { compact: true })}</span>
                    <span className="xs">{fmtPct(totalSales ? (s.sales / totalSales) * 100 : 0)}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
          <motion.div className="zone-grid" variants={stagger} initial="hidden" animate="show">
            {stats.map((s) => (
              <motion.article key={s.zone.id} variants={rise} className="card hover zone-card" style={{ ['--zc' as string]: s.zone.color }} onClick={() => setOpen(s.zone.id)}>
                <div className="row between">
                  <span className="row" style={{ gap: 10 }}><span className="zone-pin"><MapPin size={18} /></span><b style={{ fontSize: '1.05rem' }}>{s.zone.name}</b></span>
                  {canEdit && <Button variant="ghost" icon size="sm" aria-label="تعديل" onClick={(e) => { e.stopPropagation(); setEditing(s.zone); }}><Pencil size={15} /></Button>}
                </div>
                <div className="zone-nums">
                  <div><b className="num">{fmtNum(s.active)}</b><span>عميل نشط</span></div>
                  <div><b className="num">{money(s.sales, { compact: true })}</b><span>مبيعات الشهر</span></div>
                  <div><b className="num" style={{ color: s.debt > 0 ? 'var(--bad)' : undefined }}>{money(s.debt, { compact: true })}</b><span>ديون</span></div>
                </div>
                <div>
                  <div className="row between xs"><span className="muted">تغطية الزيارات (14 يوم)</span><b>{fmtPct(s.coverage)}</b></div>
                  <Progress value={s.coverage} max={100} size="thin" c1={s.zone.color} c2={s.zone.color} />
                </div>
                <div className="row" style={{ gap: -6 }}>
                  {s.reps.map((r) => <Avatar key={r.id} name={r.name} color={r.color} size="sm" round />)}
                  {s.reps.length === 0 && <Badge tone="amber">بلا مندوب</Badge>}
                </div>
              </motion.article>
            ))}
          </motion.div>
        </>
      )}
      <Drawer open={!!sel} onClose={() => setOpen(null)} width={540} title={sel?.zone.name ?? ''} subtitle={sel ? `${fmtNum(sel.customers.length)} عميل • ${sel.reps.map((r) => r.name).join('، ') || 'بلا مندوب'}` : ''}>
        {sel && (
          <div className="col" style={{ gap: '0.5rem' }}>
            <div className="kv" style={{ marginBottom: '0.6rem' }}>
              <div><div className="k">مبيعات الشهر</div><div className="v">{money(sel.sales)}</div></div>
              <div><div className="k">الديون</div><div className="v">{money(sel.debt)}</div></div>
              <div><div className="k">التغطية</div><div className="v">{fmtPct(sel.coverage)}</div></div>
            </div>
            {[...sel.customers].sort((a, b) => b.balance - a.balance).map((c) => (
              <Link key={c.id} to={`/customers?open=${c.id}`} className="mini-row" style={{ border: '1px solid var(--border)' }}>
                <Avatar name={c.name} size="sm" color={sel.zone.color} />
                <div className="grow"><b className="truncate" style={{ display: 'block' }}>{c.name}</b><span className="muted xs">{repById.get(c.repId)?.name} • {c.lastVisitAt ? `زيارة ${fmtAgo(c.lastVisitAt)}` : 'بلا زيارة'}</span></div>
                {c.balance > 0 && <Badge tone="amber">{money(c.balance, { compact: true })}</Badge>}
              </Link>
            ))}
          </div>
        )}
      </Drawer>
      <ZoneForm open={creating || !!editing} onClose={() => { setCreating(false); setEditing(undefined); }} zone={editing} />
    </>
  );
}
