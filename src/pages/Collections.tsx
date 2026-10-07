import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Banknote, CalendarClock, MessageCircle, Plus, Target, TriangleAlert, Wallet, Undo2, Download } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CollectModal } from '../components/forms/CollectModal';
import { HealthBadge } from '../components/status';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Donut, Ring, StackBar } from '../components/ui/Charts';
import { CountUp } from '../components/ui/CountUp';
import { Field, NumInput, SearchInput, Segmented, Tabs, TextInput } from '../components/ui/Fields';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { EmptyState, PageHeader, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { useActions, useRun } from '../data/useActions';
import { PAYMENT_METHOD_LABELS, type Collection, type Customer } from '../data/types';
import { AGING_BUCKETS, sumAging } from '../lib/aging';
import { customerHealth } from '../lib/credit';
import { downloadCsv } from '../lib/csv';
import { fmtAgo, fmtDate, fmtDateTime, fmtNum } from '../lib/format';
import { reminderMessage } from '../lib/messages';
import { can } from '../lib/permissions';
import { isActiveCollection, sum } from '../lib/stats';
import { DAY, startOfDay, startOfMonth } from '../lib/time';
import { openWhatsApp } from '../lib/whatsapp';

type Filter = 'all' | 'overdue' | 'promise' | 'exceeded';

function PromiseModal({ customer, onClose }: { customer: Customer | undefined; onClose: () => void }) {
  const actions = useActions();
  const { run, busy } = useRun();
  const { money } = useData();
  const [date, setDate] = useState(() => new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10));
  const [amount, setAmount] = useState(0);
  const c = customer;
  return (
    <Modal open={!!c} onClose={onClose} title="وعد بالسداد" width={440} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button>{c?.promiseDate && <Button variant="ghost" onClick={async () => { await run(() => actions.setPromise(c.id, null), 'تم حذف الوعد'); onClose(); }}>حذف الوعد</Button>}<Button variant="primary" loading={busy} onClick={async () => { if (!c) return; const d = new Date(`${date}T00:00:00`).getTime(); const r = await run(async () => { await actions.setPromise(c.id, d, amount || c.balance); return true; }, 'تم تسجيل الوعد ✓'); if (r) onClose(); }}>حفظ الوعد</Button></>}>
      {c && (
        <div className="col">
          <p className="muted">سجّل تاريخ ومبلغ سداد وعد به <b>{c.name}</b> وسنذكّرك به في التنبيهات.</p>
          <Field label="تاريخ الوعد">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" style={{ textAlign: 'start' }} />}</Field>
          <Field label="المبلغ الموعود" hint={`الرصيد الحالي ${money(c.balance)}`}>{(id) => <NumInput id={id} value={amount} onChange={setAmount} placeholder={String(c.balance)} />}</Field>
        </div>
      )}
    </Modal>
  );
}

export default function Collections() {
  const { customers, collections, orders, aging, zoneById, repById, company, money, reps } = useData();
  const { profile } = useAuth();
  const actions = useActions();
  const { run, busy } = useRun();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const role = profile!.role;
  const canCollect = can(role, 'collections.create');
  const [tab, setTab] = useState<'due' | 'log'>('due');
  const [filter, setFilter] = useState<Filter>(['overdue', 'promise', 'exceeded'].includes(params.get('filter') ?? '') ? (params.get('filter') as Filter) : 'all');
  const [q, setQ] = useState('');
  const [collect, setCollect] = useState<{ customer?: Customer } | null>(null);
  const [promise, setPromise] = useState<Customer | undefined>();
  const [voiding, setVoiding] = useState<Collection | undefined>();

  const data = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const debtors = customers.filter((c) => c.balance > 0.005);
    const ag = sumAging(debtors.map((c) => aging.get(c.id)).filter((a): a is NonNullable<typeof a> => !!a));
    const cols = collections.filter(isActiveCollection);
    const monthCollected = sum(cols.filter((c) => c.createdAt >= monthStart), (c) => c.amount);
    const todayCollected = sum(cols.filter((c) => c.createdAt >= today), (c) => c.amount);
    const target = role === 'rep' ? (profile!.repId ? repById.get(profile!.repId)?.collectionTarget ?? 0 : 0) : sum(reps.filter((r) => r.active), (r) => r.collectionTarget);
    const promisesDue = debtors.filter((c) => c.promiseDate !== undefined && c.promiseDate < today + DAY);
    const byMethod = (['cash', 'transfer', 'cheque'] as const).map((m) => ({ m, v: sum(cols.filter((c) => c.createdAt >= monthStart && c.method === m), (c) => c.amount) }));
    return { debtors, ag, monthCollected, todayCollected, target, promisesDue, byMethod, orders: orders.length };
  }, [customers, aging, collections, reps, repById, role, profile, orders.length]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const today = startOfDay(Date.now());
    return data.debtors
      .filter((c) => c.active || c.balance > 0)
      .filter((c) => !t || c.name.toLowerCase().includes(t) || c.contact.toLowerCase().includes(t))
      .filter((c) => {
        const a = aging.get(c.id);
        if (filter === 'overdue') return (a?.overdue ?? 0) > 0.005;
        if (filter === 'promise') return c.promiseDate !== undefined && c.promiseDate < today + DAY;
        if (filter === 'exceeded') return customerHealth(c, a) === 'exceeded';
        return true;
      })
      .sort((a, b) => (aging.get(b.id)?.oldestOverdueDays ?? 0) - (aging.get(a.id)?.oldestOverdueDays ?? 0) || b.balance - a.balance);
  }, [data.debtors, q, filter, aging]);

  const log = useMemo(() => [...collections].sort((a, b) => b.createdAt - a.createdAt), [collections]);
  const agSeg = AGING_BUCKETS.map((b) => ({ label: b.label, value: data.ag[b.key], color: b.color }));
  const collectPct = data.target > 0 ? (data.monthCollected / data.target) * 100 : 0;

  const exportCsv = () =>
    downloadCsv('receivables', [
      ['العميل', 'المنطقة', 'المندوب', 'الرصيد', 'الحد الائتماني', 'المتأخر', 'أيام التأخر', ...AGING_BUCKETS.map((b) => b.label)],
      ...list.map((c) => {
        const a = aging.get(c.id);
        return [c.name, zoneById.get(c.zoneId)?.name, repById.get(c.repId)?.name, c.balance, c.creditLimit, a?.overdue ?? 0, a?.oldestOverdueDays ?? 0, ...AGING_BUCKETS.map((b) => a?.[b.key] ?? 0)];
      }),
    ]);

  return (
    <>
      <PageHeader
        title="التحصيل والديون"
        subtitle="تابع المستحقات، أعمار الديون، ووعود السداد — وذكّر العملاء عبر واتساب"
        actions={
          <>
            <Button leading={<Download size={16} />} onClick={exportCsv}>تصدير</Button>
            {canCollect && <Button variant="success" leading={<Plus size={18} />} onClick={() => setCollect({})}>تسجيل تحصيل</Button>}
          </>
        }
      />

      <motion.div className="coll-top" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={rise} className="card pad coll-hero">
          <div className="row" style={{ gap: '1.4rem', flexWrap: 'wrap' }}>
            <Donut segments={agSeg} size={150} stroke={20}>
              <div className="muted xs">إجمالي الديون</div>
              <b style={{ fontSize: '1.05rem' }}><CountUp value={data.ag.total} format={(n) => money(n, { compact: true })} /></b>
            </Donut>
            <div className="grow" style={{ minWidth: 220 }}>
              <div className="legend">
                {agSeg.map((s) => <div key={s.label} className="legend-row"><i style={{ background: s.color }} />{s.label}<b className="num">{money(s.value, { compact: true })}</b></div>)}
              </div>
              <div style={{ marginTop: '0.8rem' }}><StackBar segments={agSeg} /></div>
            </div>
          </div>
        </motion.div>
        <motion.div variants={rise} className="card pad coll-target">
          <Ring value={data.monthCollected} max={Math.max(data.target, 1)} size={120} stroke={12} color="#12b76a" color2="#6ee7b7">
            <b style={{ fontSize: '1.4rem' }}><CountUp value={collectPct} format={(n) => `${fmtNum(Math.round(n))}%`} /></b>
          </Ring>
          <div>
            <div className="muted small row" style={{ gap: 6 }}><Target size={14} /> هدف التحصيل الشهري</div>
            <b className="num" style={{ fontSize: '1.3rem' }}>{money(data.monthCollected, { compact: true })}</b>
            <div className="muted xs">من {money(data.target, { compact: true })} • اليوم {money(data.todayCollected, { compact: true })}</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
              {data.byMethod.map((x) => <Badge key={x.m} tone="gray">{PAYMENT_METHOD_LABELS[x.m]} {money(x.v, { compact: true })}</Badge>)}
            </div>
          </div>
        </motion.div>
        <motion.div variants={rise} className="card pad coll-alerts">
          <div className="coll-stat"><span className="ico bad"><TriangleAlert size={18} /></span><div><div className="muted xs">إجمالي المتأخر</div><b className="num">{money(data.ag.overdue, { compact: true })}</b></div></div>
          <div className="coll-stat"><span className="ico violet"><CalendarClock size={18} /></span><div><div className="muted xs">وعود مستحقة اليوم</div><b className="num">{fmtNum(data.promisesDue.length)}</b></div></div>
          <div className="coll-stat"><span className="ico blue"><Wallet size={18} /></span><div><div className="muted xs">عملاء عليهم أرصدة</div><b className="num">{fmtNum(data.debtors.length)}</b></div></div>
        </motion.div>
      </motion.div>

      <div style={{ height: '1.2rem' }} />
      <Tabs name="coll-tab" value={tab} onChange={setTab} options={[{ value: 'due', label: 'المستحقات', count: data.debtors.length }, { value: 'log', label: 'سجل التحصيل', count: collections.filter((c) => c.status === 'active').length }]} />
      <div style={{ height: '1rem' }} />

      {tab === 'due' ? (
        <>
          <div className="toolbar">
            <SearchInput className="grow" value={q} onChange={setQ} placeholder="ابحث عن عميل…" />
            <Segmented
              name="coll-filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'الكل' },
                { value: 'overdue', label: 'متأخرون' },
                { value: 'promise', label: 'وعود اليوم', count: data.promisesDue.length },
                { value: 'exceeded', label: 'تجاوزوا الحد' },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <div className="card"><EmptyState icon="🎉" title="لا مستحقات ضمن هذا الفلتر" text="كل العملاء مسدِّدون." /></div>
          ) : (
            <motion.div className="due-list" variants={stagger} initial="hidden" animate="show" key={filter + q}>
              {list.slice(0, 80).map((c) => {
                const a = aging.get(c.id);
                const health = customerHealth(c, a);
                const hasPromise = c.promiseDate !== undefined;
                const promiseLate = hasPromise && c.promiseDate! < startOfDay(Date.now());
                return (
                  <motion.div key={c.id} variants={rise} className="card due-row">
                    <div className="row grow" style={{ gap: '0.8rem', minWidth: 0, cursor: 'pointer' }} onClick={() => nav(`/customers?open=${c.id}`)}>
                      <Avatar name={c.name} color={zoneById.get(c.zoneId)?.color} />
                      <div className="grow">
                        <b className="truncate" style={{ display: 'block' }}>{c.name}</b>
                        <span className="muted xs">{zoneById.get(c.zoneId)?.name} • {repById.get(c.repId)?.name}</span>
                        <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                          <HealthBadge health={health} />
                          {a && a.oldestOverdueDays > 0 && <Badge tone="orange">أقدم تأخير {fmtNum(a.oldestOverdueDays)} يوم</Badge>}
                          {hasPromise && <Badge tone={promiseLate ? 'red' : 'blue'}>وعد {fmtDate(c.promiseDate!)}{c.promiseAmount ? ` • ${money(c.promiseAmount, { compact: true })}` : ''}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="due-mid">
                      <b className="num" style={{ fontSize: '1.15rem' }}>{money(c.balance)}</b>
                      {a && a.total > 0 && <div style={{ width: 150, marginTop: 6 }}><StackBar height={8} segments={AGING_BUCKETS.map((b) => ({ label: b.label, value: a[b.key], color: b.color }))} /></div>}
                      <span className="muted xs">متأخر {money(a?.overdue ?? 0, { compact: true })}</span>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {canCollect && <Button variant="success" size="sm" leading={<Banknote size={15} />} onClick={() => setCollect({ customer: c })}>تحصيل</Button>}
                      <Button variant="wa" size="sm" icon aria-label="تذكير واتساب" onClick={() => openWhatsApp(c.phone, company.dialCode, reminderMessage(company, c, money, a))}><MessageCircle size={16} /></Button>
                      {canCollect && <Button size="sm" icon aria-label="وعد بالسداد" onClick={() => setPromise(c)}><CalendarClock size={16} /></Button>}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </>
      ) : (
        <div className="card">
          {log.length === 0 ? <EmptyState icon="💰" title="لا سندات قبض" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>العميل</th><th className="hide-mobile">المندوب</th><th>الطريقة</th><th className="num">المبلغ</th><th>التاريخ</th>{can(role, 'collections.void') && <th />}</tr></thead>
                <tbody>
                  {log.slice(0, 150).map((c) => (
                    <tr key={c.id} style={{ opacity: c.status === 'void' ? 0.5 : 1 }}>
                      <td><b>{c.customerName}</b>{c.orderId && <div className="muted xs">دفعة مع طلب</div>}{c.reference && <div className="muted xs ltr">{c.reference}</div>}</td>
                      <td className="hide-mobile">{c.repName}</td>
                      <td><Badge tone={c.method === 'cash' ? 'green' : c.method === 'transfer' ? 'blue' : 'violet'}>{PAYMENT_METHOD_LABELS[c.method]}</Badge></td>
                      <td className="num bold" style={{ textDecoration: c.status === 'void' ? 'line-through' : undefined }}>{money(c.amount)}</td>
                      <td><div className="small">{fmtDateTime(c.createdAt)}</div><div className="muted xs">{fmtAgo(c.createdAt)}</div></td>
                      {can(role, 'collections.void') && <td>{c.status === 'void' ? <Badge tone="red">ملغى</Badge> : <Button size="sm" variant="ghost" leading={<Undo2 size={14} />} onClick={() => setVoiding(c)}>إلغاء</Button>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <CollectModal open={!!collect} onClose={() => setCollect(null)} customer={collect?.customer} />
      <PromiseModal customer={promise} onClose={() => setPromise(undefined)} />
      <ConfirmDialog open={!!voiding} onClose={() => setVoiding(undefined)} danger loading={busy} title="إلغاء سند القبض" confirmLabel="إلغاء السند" text={voiding ? `سيُعاد مبلغ ${money(voiding.amount)} إلى رصيد ${voiding.customerName} كدين مستحق.` : ''} onConfirm={async () => { if (!voiding) return; const r = await run(async () => { await actions.voidCollection(voiding); return true; }, 'تم إلغاء السند وإعادة الرصيد'); if (r) setVoiding(undefined); }} />
    </>
  );
}
