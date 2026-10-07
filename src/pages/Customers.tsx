import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookText, MapPin, MapPinned, MessageCircle, Pencil, Phone, Plus, Receipt, SearchX, ShoppingCart, UserRound, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CollectModal } from '../components/forms/CollectModal';
import { CustomerForm } from '../components/forms/CustomerForm';
import { VisitModal } from '../components/forms/VisitModal';
import { HealthBadge, OrderStatusBadge } from '../components/status';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { StackBar } from '../components/ui/Charts';
import { Segmented, SearchInput, SelectInput, Tabs } from '../components/ui/Fields';
import { Drawer } from '../components/ui/Modal';
import { EmptyState, PageHeader, Progress, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { VISIT_RESULT_LABELS, PRICE_LIST_LABELS, type Customer } from '../data/types';
import { AGING_BUCKETS } from '../lib/aging';
import { creditCheck, customerHealth, type Health } from '../lib/credit';
import { fmtAgo, fmtDate, fmtDateTime, fmtNum } from '../lib/format';
import { buildLedger } from '../lib/ledger';
import { reminderMessage, statementMessage } from '../lib/messages';
import { can } from '../lib/permissions';
import { DAY } from '../lib/time';
import { openWhatsApp } from '../lib/whatsapp';

type StatusFilter = 'all' | 'debt' | 'overdue' | 'exceeded' | 'unvisited' | 'inactive';

function usageColor(u: number): [string, string] {
  if (u >= 1) return ['#e5385f', '#ff6b5b'];
  if (u >= 0.8) return ['#f5b50a', '#ff9a3c'];
  return ['#00b8a9', '#5eead4'];
}

function CustomerCard({ c, onOpen }: { c: Customer; onOpen: () => void }) {
  const { zoneById, repById, aging, money } = useData();
  const a = aging.get(c.id);
  const health = customerHealth(c, a);
  const zone = zoneById.get(c.zoneId);
  const usage = c.creditLimit > 0 ? c.balance / c.creditLimit : 0;
  const [c1, c2] = usageColor(usage);
  return (
    <motion.article variants={rise} className="card hover cust-card" onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()} role="button" aria-label={`فتح ${c.name}`} style={{ opacity: c.active ? 1 : 0.6 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Avatar name={c.name} color={zone?.color} />
        <div className="grow">
          <b className="truncate" style={{ display: 'block', fontSize: '1rem' }}>{c.name}</b>
          <span className="muted small truncate" style={{ display: 'block' }}>{c.contact}</span>
        </div>
        <HealthBadge health={health} />
      </div>
      <div className="cust-meta">
        <span><MapPin size={14} /> {zone?.name}</span>
        <span><UserRound size={14} /> {repById.get(c.repId)?.name}</span>
      </div>
      <div className="cust-bal">
        <div>
          <div className="muted xs">الرصيد المستحق</div>
          <b className="num" style={{ fontSize: '1.2rem', color: c.balance > 0 ? 'var(--text)' : 'var(--ok)' }}>{money(c.balance)}</b>
        </div>
        {c.creditLimit > 0 && <span className="muted xs">من {money(c.creditLimit, { compact: true })}</span>}
      </div>
      {c.creditLimit > 0 && <Progress value={c.balance} max={c.creditLimit} size="thin" c1={c1} c2={c2} />}
      <div className="cust-foot">
        <span>{c.lastOrderAt ? `آخر طلب ${fmtAgo(c.lastOrderAt)}` : 'لا طلبات'}</span>
        {!c.active && <Badge>غير نشط</Badge>}
        {a && a.overdue > 0.005 && <Badge tone="orange">متأخر {fmtNum(a.oldestOverdueDays)} يوم</Badge>}
      </div>
    </motion.article>
  );
}

function CustomerDrawer({ customer, onClose }: { customer: Customer | undefined; onClose: () => void }) {
  const { orders, collections, visits, aging, zoneById, repById, company, money } = useData();
  const { profile } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<'ledger' | 'orders' | 'visits'>('ledger');
  const [editing, setEditing] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [visiting, setVisiting] = useState(false);
  const role = profile!.role;

  useEffect(() => setTab('ledger'), [customer?.id]);

  const c = customer;
  const data = useMemo(() => {
    if (!c) return null;
    const myOrders = orders.filter((o) => o.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt);
    const myCols = collections.filter((k) => k.customerId === c.id && k.status === 'active');
    const ledger = buildLedger(c.balance, myOrders, myCols);
    return { myOrders, ledger, myVisits: visits.filter((v) => v.customerId === c.id).sort((a, b) => b.createdAt - a.createdAt) };
  }, [c, orders, collections, visits]);

  const a = c ? aging.get(c.id) : undefined;
  const health = c ? customerHealth(c, a) : 'clear';
  const cc = c ? creditCheck(c, 0) : undefined;
  const [c1, c2] = c ? usageColor(c.creditLimit > 0 ? c.balance / c.creditLimit : 0) : ['#000', '#000'];

  return (
    <>
      <Drawer open={!!c} onClose={onClose} width={640} title={c?.name ?? ''} subtitle={c ? `${zoneById.get(c.zoneId)?.name} • ${repById.get(c.repId)?.name}` : ''}>
        {c && data && cc && (
          <div className="col" style={{ gap: '1.1rem' }}>
            <div className="row wrap" style={{ gap: '0.5rem' }}>
              <HealthBadge health={health} />
              <Badge tone="violet">أسعار {PRICE_LIST_LABELS[c.priceList]}</Badge>
              {!c.active && <Badge>غير نشط</Badge>}
              {c.promiseDate && c.balance > 0 && <Badge tone="blue">وعد بالسداد {fmtDate(c.promiseDate)}</Badge>}
            </div>
            <div className="row wrap" style={{ gap: '0.5rem' }}>
              {can(role, 'orders.create') && <Button variant="primary" size="sm" leading={<ShoppingCart size={16} />} onClick={() => nav(`/orders/new?customer=${c.id}`)}>طلب جديد</Button>}
              {can(role, 'collections.create') && <Button variant="success" size="sm" leading={<Wallet size={16} />} onClick={() => setCollecting(true)} disabled={c.balance <= 0}>تحصيل</Button>}
              {can(role, 'orders.create') && <Button size="sm" leading={<MapPinned size={16} />} onClick={() => setVisiting(true)}>زيارة</Button>}
              <Button variant="wa" size="sm" leading={<MessageCircle size={16} />} onClick={() => openWhatsApp(c.phone, company.dialCode, statementMessage(company, c, money, a))}>كشف حساب</Button>
              {can(role, 'customers.edit') && <Button variant="ghost" size="sm" leading={<Pencil size={16} />} onClick={() => setEditing(true)}>تعديل</Button>}
            </div>

            <div className="card pad" style={{ background: 'var(--surface-2)' }}>
              <div className="row between" style={{ alignItems: 'flex-end' }}>
                <div>
                  <div className="muted small">الرصيد المستحق</div>
                  <b className="num" style={{ fontSize: '1.8rem' }}>{money(c.balance)}</b>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <div className="muted small">المتاح من الحد</div>
                  <b className="num" style={{ fontSize: '1.2rem', color: 'var(--ok)' }}>{money(cc.available)}</b>
                </div>
              </div>
              {c.creditLimit > 0 && (
                <div style={{ marginTop: '0.8rem' }}>
                  <Progress value={c.balance} max={c.creditLimit} size="thick" c1={c1} c2={c2} />
                  <div className="row between muted xs" style={{ marginTop: 4 }}>
                    <span>استخدام الائتمان {fmtNum((c.balance / c.creditLimit) * 100)}%</span>
                    <span>الحد {money(c.creditLimit)} • {fmtNum(c.creditDays)} يوم</span>
                  </div>
                </div>
              )}
              {a && a.total > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <StackBar segments={AGING_BUCKETS.map((b) => ({ label: b.label, value: a[b.key], color: b.color }))} />
                  <div className="aging-chips">
                    {AGING_BUCKETS.filter((b) => a[b.key] > 0.005).map((b) => (
                      <span key={b.key}><i style={{ background: b.color }} /> {b.label}: <b className="num">{money(a[b.key], { compact: true })}</b></span>
                    ))}
                  </div>
                </div>
              )}
              {a && a.overdue > 0.005 && can(role, 'collections.view') && (
                <Button variant="wa" size="sm" block style={{ marginTop: '0.9rem' }} leading={<MessageCircle size={16} />} onClick={() => openWhatsApp(c.phone, company.dialCode, reminderMessage(company, c, money, a))}>
                  إرسال تذكير سداد عبر واتساب
                </Button>
              )}
            </div>

            <div className="kv">
              <div><div className="k">المسؤول</div><div className="v" style={{ fontSize: '0.95rem' }}>{c.contact || '—'}</div></div>
              <div><div className="k">الجوال</div><div className="v" style={{ fontSize: '0.95rem' }}><a href={`tel:${c.phone}`} className="ltr row" style={{ gap: 6 }}><Phone size={14} /> {c.phone}</a></div></div>
              <div><div className="k">آخر زيارة</div><div className="v" style={{ fontSize: '0.95rem' }}>{c.lastVisitAt ? fmtAgo(c.lastVisitAt) : 'لا زيارات'}</div></div>
              <div><div className="k">عميل منذ</div><div className="v" style={{ fontSize: '0.95rem' }}>{fmtDate(c.createdAt)}</div></div>
            </div>
            {c.address && <p className="muted small"><MapPin size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {c.address}</p>}
            {c.notes && <div className="callout info">{c.notes}</div>}

            <Tabs
              name="cust-tabs"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'ledger', label: 'كشف الحساب' },
                { value: 'orders', label: 'الطلبات', count: data.myOrders.length },
                { value: 'visits', label: 'الزيارات', count: data.myVisits.length },
              ]}
            />
            {tab === 'ledger' && (
              data.ledger.length === 0 ? <EmptyState icon={<BookText size={34} />} title="لا حركات بعد" /> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>البيان</th><th className="num">مدين</th><th className="num">دائن</th><th className="num">الرصيد</th></tr></thead>
                    <tbody>
                      {data.ledger.slice(0, 40).map((l) => (
                        <tr key={l.id}>
                          <td><b>{l.label}</b><div className="muted xs">{fmtDateTime(l.ts)}{l.sub ? ` • ${l.sub}` : ''}</div></td>
                          <td className="num" style={{ color: l.debit ? 'var(--bad)' : undefined }}>{l.debit ? money(l.debit) : '—'}</td>
                          <td className="num" style={{ color: l.credit ? 'var(--ok)' : undefined }}>{l.credit ? money(l.credit) : '—'}</td>
                          <td className="num bold">{money(l.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {tab === 'orders' && (
              data.myOrders.length === 0 ? <EmptyState icon={<Receipt size={34} />} title="لا طلبات" /> : (
                <div className="col" style={{ gap: '0.5rem' }}>
                  {data.myOrders.slice(0, 30).map((o) => (
                    <Link key={o.id} to={`/orders?open=${o.id}`} className="mini-row" style={{ border: '1px solid var(--border)' }}>
                      <div className="grow"><b className="ltr">#{o.no}</b><div className="muted xs">{fmtDateTime(o.createdAt)} • {o.items.length} أصناف</div></div>
                      <b className="num">{money(o.total)}</b>
                      <OrderStatusBadge status={o.status} />
                    </Link>
                  ))}
                </div>
              )
            )}
            {tab === 'visits' && (
              data.myVisits.length === 0 ? <EmptyState icon={<MapPin size={34} />} title="لا زيارات مسجلة" /> : (
                <ul className="timeline">
                  {data.myVisits.slice(0, 30).map((v) => (
                    <li key={v.id}>
                      <span className="tl-dot blue"><MapPinned size={16} /></span>
                      <div className="grow">
                        <b style={{ fontSize: '0.875rem' }}>{VISIT_RESULT_LABELS[v.result]}</b>
                        <div className="muted xs">{v.repName} • {fmtDateTime(v.createdAt)}{v.lat ? ' • مع الموقع' : ''}</div>
                        {v.note && <div className="small">{v.note}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        )}
      </Drawer>
      <CustomerForm open={editing} onClose={() => setEditing(false)} customer={c} />
      {c && <CollectModal open={collecting} onClose={() => setCollecting(false)} customer={c} />}
      <VisitModal open={visiting} onClose={() => setVisiting(false)} customer={c} />
    </>
  );
}

export default function Customers() {
  const { customers, zones, reps, aging, money, customerById } = useData();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [zone, setZone] = useState('all');
  const [rep, setRep] = useState('all');
  const [sort, setSort] = useState<'name' | 'debt' | 'recent'>('name');
  const [creating, setCreating] = useState(false);
  const role = profile!.role;
  const filterParam = params.get('filter');
  const [status, setStatus] = useState<StatusFilter>(['debt', 'overdue', 'exceeded', 'unvisited', 'inactive'].includes(filterParam ?? '') ? (filterParam as StatusFilter) : 'all');
  const openId = params.get('open');
  const opened = openId ? customerById.get(openId) : undefined;

  // ‎?new=1 من لوحة الأوامر يفتح نموذج العميل الجديد
  useEffect(() => {
    if (params.get('new') && can(role, 'customers.edit')) {
      setCreating(true);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const now = Date.now();
    const base = customers.filter((c) => c.active);
    return {
      all: customers.length,
      debt: base.filter((c) => c.balance > 0.005).length,
      overdue: base.filter((c) => (aging.get(c.id)?.overdue ?? 0) > 0.005).length,
      exceeded: base.filter((c) => customerHealth(c, aging.get(c.id)) === 'exceeded').length,
      unvisited: base.filter((c) => (c.lastVisitAt ?? 0) < now - 14 * DAY).length,
      inactive: customers.filter((c) => !c.active).length,
    };
  }, [customers, aging]);

  const list = useMemo(() => {
    const now = Date.now();
    const t = q.trim().toLowerCase();
    const out = customers.filter((c) => {
      if (t && !(c.name.toLowerCase().includes(t) || c.contact.toLowerCase().includes(t) || c.phone.includes(t))) return false;
      if (zone !== 'all' && c.zoneId !== zone) return false;
      if (rep !== 'all' && c.repId !== rep) return false;
      const h: Health = customerHealth(c, aging.get(c.id));
      switch (status) {
        case 'debt': return c.active && c.balance > 0.005;
        case 'overdue': return c.active && (aging.get(c.id)?.overdue ?? 0) > 0.005;
        case 'exceeded': return c.active && h === 'exceeded';
        case 'unvisited': return c.active && (c.lastVisitAt ?? 0) < now - 14 * DAY;
        case 'inactive': return !c.active;
        default: return true;
      }
    });
    out.sort((a, b) => (sort === 'debt' ? b.balance - a.balance : sort === 'recent' ? (b.lastOrderAt ?? 0) - (a.lastOrderAt ?? 0) : a.name.localeCompare(b.name, 'ar')));
    return out;
  }, [customers, q, zone, rep, status, sort, aging]);

  const totalDebt = list.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle={`${fmtNum(list.length)} عميل • إجمالي الديون ${money(totalDebt)}`}
        actions={can(role, 'customers.edit') && <Button variant="primary" leading={<Plus size={18} />} onClick={() => setCreating(true)}>عميل جديد</Button>}
      />
      <div className="toolbar">
        <SearchInput className="grow" value={q} onChange={setQ} placeholder="ابحث بالاسم أو المسؤول أو الجوال…" />
        <SelectInput value={zone} onChange={(e) => setZone(e.target.value)} style={{ width: 170 }} aria-label="المنطقة">
          <option value="all">كل المناطق</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </SelectInput>
        {role !== 'rep' && (
          <SelectInput value={rep} onChange={(e) => setRep(e.target.value)} style={{ width: 170 }} aria-label="المندوب">
            <option value="all">كل المندوبين</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectInput>
        )}
        <SelectInput value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: 150 }} aria-label="الترتيب">
          <option value="name">الاسم</option>
          <option value="debt">الدين الأعلى</option>
          <option value="recent">الأحدث طلبًا</option>
        </SelectInput>
      </div>
      <div style={{ marginBottom: '1.1rem' }}>
        <Segmented
          name="cust-status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'الكل', count: counts.all },
            { value: 'debt', label: 'عليهم دين', count: counts.debt },
            { value: 'overdue', label: 'متأخرون', count: counts.overdue },
            { value: 'exceeded', label: 'تجاوزوا الحد', count: counts.exceeded },
            { value: 'unvisited', label: 'بلا زيارة', count: counts.unvisited },
            { value: 'inactive', label: 'غير نشطين', count: counts.inactive },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <div className="card"><EmptyState icon={<SearchX size={34} />} title="لا عملاء مطابقون" text="جرّب تغيير الفلاتر أو البحث." /></div>
      ) : (
        <motion.div className="cust-grid" variants={stagger} initial="hidden" animate="show" key={`${status}-${zone}-${rep}-${sort}-${q}`}>
          {list.slice(0, 120).map((c) => <CustomerCard key={c.id} c={c} onOpen={() => setOpen(c.id)} />)}
        </motion.div>
      )}
      <CustomerDrawer customer={opened} onClose={() => setOpen(null)} />
      <CustomerForm open={creating} onClose={() => setCreating(false)} onSaved={(c) => setOpen(c.id)} />
    </>
  );
}
