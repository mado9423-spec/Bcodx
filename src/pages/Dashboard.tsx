import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, ClipboardList, Coins, MapPinned, PackageX, Plus, Target, TrendingUp, Trophy, Wallet,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { AreaChart, BarList, Donut, Ring, Sparkline, StackBar } from '../components/ui/Charts';
import { CountUp } from '../components/ui/CountUp';
import { Segmented } from '../components/ui/Fields';
import { EmptyState, Progress, rise, stagger } from '../components/ui/Misc';
import { OrderStatusBadge } from '../components/status';
import { useData } from '../data/DataContext';
import { useAlerts } from '../layout/useAlerts';
import { AGING_BUCKETS, sumAging } from '../lib/aging';
import { fmtAgo, fmtCompact, fmtNum, fmtPct, fmtShortDate, fmtWeekday, greeting } from '../lib/format';
import { can } from '../lib/permissions';
import { dailyTotals, groupSum, isActiveCollection, isSale, pctChange, sum } from '../lib/stats';
import { DAY, startOfDay, startOfMonth } from '../lib/time';

interface KpiProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: React.ReactNode;
  color: string;
  spark?: number[];
  delta?: number | null;
  foot?: React.ReactNode;
  to?: string;
}

function Kpi({ label, value, format, icon, color, spark, delta, foot, to }: KpiProps) {
  const body = (
    <motion.div variants={rise} className={`card kpi ${to ? 'hover' : ''}`} style={{ ['--k' as string]: color }}>
      <div className="kpi-top">
        <span className="kpi-ico">{icon}</span>
        {delta !== undefined && delta !== null && (
          <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {fmtPct(Math.abs(delta))}
          </span>
        )}
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        <CountUp value={value} format={format} />
      </div>
      <div className="kpi-foot">{foot}</div>
      {spark && (
        <div className="kpi-spark">
          <Sparkline values={spark} color={color} width={120} height={44} />
        </div>
      )}
    </motion.div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const { orders, collections, customers, products, reps, zones, repById, zoneById, stockTotal, aging, visits, money, company } = useData();
  const alerts = useAlerts(profile?.role);
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const role = profile!.role;
  const isRep = role === 'rep';
  const myRep = isRep && profile!.repId ? repById.get(profile!.repId) : undefined;

  const d = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const myCustomers = isRep ? customers.filter((c) => c.repId === profile!.repId) : customers;
    const sales = orders.filter(isSale);
    const cols = collections.filter(isActiveCollection);

    const todaySales = sum(sales.filter((o) => o.createdAt >= today), (o) => o.total);
    const yesterdaySales = sum(sales.filter((o) => o.createdAt >= today - DAY && o.createdAt < today), (o) => o.total);
    const monthSales = sum(sales.filter((o) => o.createdAt >= monthStart), (o) => o.total);
    const monthCollected = sum(cols.filter((c) => c.createdAt >= monthStart), (c) => c.amount);
    const todayCollected = sum(cols.filter((c) => c.createdAt >= today), (c) => c.amount);
    const salesTarget = isRep ? (myRep?.salesTarget ?? 0) : sum(reps.filter((r) => r.active), (r) => r.salesTarget);
    const collectTarget = isRep ? (myRep?.collectionTarget ?? 0) : sum(reps.filter((r) => r.active), (r) => r.collectionTarget);

    const debt = sum(myCustomers.filter((c) => c.balance > 0), (c) => c.balance);
    const ag = sumAging(myCustomers.map((c) => aging.get(c.id)).filter((a): a is NonNullable<typeof a> => !!a));
    const open = orders.filter((o) => ['credit_hold', 'new', 'approved', 'preparing'].includes(o.status));
    const holds = orders.filter((o) => o.status === 'credit_hold').length;
    const low = products.filter((p) => p.active && stockTotal(p.id) <= p.minStock);
    const out = low.filter((p) => stockTotal(p.id) <= 0).length;

    const s14 = dailyTotals(sales, (o) => o.createdAt, (o) => o.total, 14, now).values;
    const c14 = dailyTotals(cols, (c) => c.createdAt, (c) => c.amount, 14, now).values;
    const o14 = dailyTotals(open, (o) => o.createdAt, () => 1, 14, now).values;

    const zoneSales = groupSum(sales.filter((o) => o.createdAt >= monthStart), (o) => o.zoneId, (o) => o.total);
    const repSales = groupSum(sales.filter((o) => o.createdAt >= monthStart), (o) => o.repId, (o) => o.total);
    const repCols = groupSum(cols.filter((c) => c.createdAt >= monthStart), (c) => c.repId, (c) => c.amount);
    const stale = myCustomers.filter((c) => c.active && (c.lastVisitAt ?? 0) < now - 7 * DAY).sort((a, b) => (a.lastVisitAt ?? 0) - (b.lastVisitAt ?? 0));
    const dueToday = myCustomers.filter((c) => c.promiseDate !== undefined && c.balance > 0 && c.promiseDate < today + DAY);

    return { now, today, todaySales, yesterdaySales, monthSales, monthCollected, todayCollected, salesTarget, collectTarget, debt, ag, open, holds, low, out, s14, c14, o14, zoneSales, repSales, repCols, stale, dueToday };
  }, [orders, collections, customers, products, reps, aging, stockTotal, isRep, myRep, profile]);

  const series = useMemo(() => {
    const n = Number(range);
    const s = dailyTotals(orders.filter(isSale), (o) => o.createdAt, (o) => o.total, n);
    const c = dailyTotals(collections.filter(isActiveCollection), (x) => x.createdAt, (x) => x.amount, n);
    return { labels: s.starts.map(fmtShortDate), sales: s.values, cols: c.values };
  }, [orders, collections, range]);

  const recent = useMemo(() => [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 7), [orders]);

  const feed = useMemo(() => {
    type F = { id: string; ts: number; icon: React.ReactNode; tone: string; title: string; sub: string };
    const items: F[] = [];
    for (const o of orders.slice(0, 40)) items.push({ id: `o${o.id}`, ts: o.createdAt, icon: <ClipboardList size={16} />, tone: 'violet', title: `طلب ${o.no} — ${o.customerName}`, sub: `${o.repName} • ${money(o.total)}` });
    for (const c of collections.slice(0, 40)) if (c.status === 'active' && !c.orderId) items.push({ id: `c${c.id}`, ts: c.createdAt, icon: <Banknote size={16} />, tone: 'green', title: `تحصيل ${money(c.amount)} من ${c.customerName}`, sub: c.repName });
    for (const v of visits.slice(0, 30)) items.push({ id: `v${v.id}`, ts: v.createdAt, icon: <MapPinned size={16} />, tone: 'blue', title: `زيارة ${v.customerName}`, sub: v.repName });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 9);
  }, [orders, collections, visits, money]);

  const dayDelta = pctChange(d.todaySales, d.yesterdaySales);
  const targetPct = d.salesTarget > 0 ? (d.monthSales / d.salesTarget) * 100 : 0;
  const collectPct = d.collectTarget > 0 ? (d.monthCollected / d.collectTarget) * 100 : 0;
  const nd = new Date(d.now);
  const daysInMonth = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
  const dayOfMonth = nd.getDate();
  const expectedPct = (dayOfMonth / daysInMonth) * 100;

  const summaryBits: string[] = [];
  if (d.holds > 0 && can(role, 'orders.approve_credit')) summaryBits.push(`${fmtNum(d.holds)} طلب ينتظر موافقتك`);
  if (d.dueToday.length > 0 && can(role, 'collections.view')) summaryBits.push(`${fmtNum(d.dueToday.length)} وعد سداد مستحق اليوم`);
  if (d.out > 0 && can(role, 'inventory.view')) summaryBits.push(`${fmtNum(d.out)} صنف نافد`);
  if (isRep && d.stale.length > 0) summaryBits.push(`${fmtNum(Math.min(d.stale.length, 99))} عميل يحتاج زيارة`);

  const zoneItems = [...zones]
    .map((z) => ({ label: z.name, value: d.zoneSales.get(z.id) ?? 0, color: z.color }))
    .sort((a, b) => b.value - a.value);

  const leaderboard = reps
    .filter((r) => r.active)
    .map((r) => ({ rep: r, sales: d.repSales.get(r.id) ?? 0, cols: d.repCols.get(r.id) ?? 0 }))
    .sort((a, b) => b.sales - a.sales);

  const agingSegments = AGING_BUCKETS.map((b) => ({ label: b.label, value: d.ag[b.key], color: b.color }));

  return (
    <motion.div className="dash" variants={stagger} initial="hidden" animate="show">
      {/* Hero */}
      <motion.section variants={rise} className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="hero-main">
          <span className="hero-date">{fmtWeekday(d.now)}</span>
          <h1>
            {greeting()}، <em>{profile!.name}</em> 👋
          </h1>
          <p>
            {summaryBits.length > 0 ? (
              <>
                اليوم: {summaryBits.map((b, i) => (
                  <span key={b}>
                    <b>{b}</b>
                    {i < summaryBits.length - 1 ? ' • ' : ''}
                  </span>
                ))}
              </>
            ) : (
              `هذه نظرة سريعة على أداء ${company.name} اليوم.`
            )}
          </p>
          <div className="hero-actions">
            {can(role, 'orders.create') && (
              <Button variant="default" leading={<Plus size={18} />} onClick={() => nav('/orders/new')}>
                طلب جديد
              </Button>
            )}
            {can(role, 'collections.create') && (
              <Button className="glass-btn" leading={<Wallet size={18} />} onClick={() => nav('/collections')}>
                تسجيل تحصيل
              </Button>
            )}
            {can(role, 'customers.view') && (
              <Button className="glass-btn" leading={<MapPinned size={18} />} onClick={() => nav('/customers')}>
                العملاء
              </Button>
            )}
          </div>
        </div>
        <div className="hero-ring">
          <Ring value={d.monthSales} max={Math.max(d.salesTarget, 1)} size={150} stroke={14} color="#fff" color2="#9ff5e8">
            <div className="hero-ring-num">
              <CountUp value={targetPct} format={(n) => `${fmtNum(Math.round(n))}%`} />
            </div>
            <div className="hero-ring-sub">من هدف الشهر</div>
          </Ring>
          <div className="hero-ring-foot">
            <Target size={14} /> المتوقع حتى اليوم {fmtNum(Math.round(expectedPct))}%
            {targetPct >= expectedPct ? <span className="pace good"> • متقدّم 🔥</span> : <span className="pace slow"> • متأخر عن الخطة</span>}
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <motion.div variants={stagger} className="kpi-grid">
        <Kpi label="مبيعات اليوم" value={d.todaySales} format={(n) => money(Math.round(n), { compact: n > 99999 })} icon={<TrendingUp size={20} />} color="#6d4aff" spark={d.s14} delta={dayDelta} foot={<span className="muted">أمس: {money(d.yesterdaySales, { compact: true })}</span>} to="/orders" />
        <Kpi label="مبيعات الشهر" value={d.monthSales} format={(n) => money(Math.round(n), { compact: true })} icon={<Coins size={20} />} color="#00b8a9" foot={<><Progress value={d.monthSales} max={Math.max(d.salesTarget, 1)} size="thin" c1="#00b8a9" c2="#5eead4" /><span className="muted xs">الهدف {money(d.salesTarget, { compact: true })}</span></>} />
        <Kpi label="إجمالي الديون" value={d.debt} format={(n) => money(Math.round(n), { compact: true })} icon={<Wallet size={20} />} color="#ff6b5b" spark={d.c14} foot={<span style={{ color: d.ag.overdue > 0 ? 'var(--bad)' : 'var(--muted)' }}>{d.ag.overdue > 0 ? `منها متأخر ${money(d.ag.overdue, { compact: true })}` : 'لا متأخرات'}</span>} to="/collections" />
        <Kpi label="المحصّل هذا الشهر" value={d.monthCollected} format={(n) => money(Math.round(n), { compact: true })} icon={<Banknote size={20} />} color="#12b76a" foot={<><Progress value={d.monthCollected} max={Math.max(d.collectTarget, 1)} size="thin" c1="#12b76a" c2="#6ee7b7" /><span className="muted xs">اليوم {money(d.todayCollected, { compact: true })} • {fmtPct(collectPct)} من الهدف</span></>} to="/collections" />
        <Kpi label="طلبات مفتوحة" value={d.open.length} icon={<ClipboardList size={20} />} color="#f5b50a" spark={d.o14} foot={<span className="muted">{d.holds > 0 ? `${fmtNum(d.holds)} بانتظار الائتمان` : 'لا طلبات معلّقة'}</span>} to="/orders" />
        {can(role, 'inventory.view') && <Kpi label="أصناف منخفضة" value={d.low.length} icon={<PackageX size={20} />} color="#e5385f" foot={<span className="muted">{d.out > 0 ? `${fmtNum(d.out)} صنف نافد تمامًا` : 'لا أصناف نافدة'}</span>} to="/inventory?filter=low" />}
      </motion.div>

      {/* Charts row */}
      <div className="dash-row r-2-1">
        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico"><TrendingUp size={17} /></span> المبيعات مقابل التحصيل
            </h3>
            <Segmented name="range" value={range} onChange={setRange} options={[{ value: '7', label: '7 أيام' }, { value: '30', label: '30 يومًا' }, { value: '90', label: '90 يومًا' }]} />
          </div>
          <div className="card-body">
            <div className="legend-inline">
              <span><i style={{ background: '#6d4aff' }} /> المبيعات <b className="num">{money(sum(series.sales, (x) => x), { compact: true })}</b></span>
              <span><i style={{ background: '#00b8a9' }} /> التحصيل <b className="num">{money(sum(series.cols, (x) => x), { compact: true })}</b></span>
            </div>
            <AreaChart
              animKey={range}
              labels={series.labels}
              format={(n) => fmtCompact(n)}
              series={[
                { label: 'المبيعات', color: '#6d4aff', values: series.sales },
                { label: 'التحصيل', color: '#00b8a9', values: series.cols },
              ]}
            />
          </div>
        </motion.section>

        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico"><Wallet size={17} /></span> أعمار الديون
            </h3>
            <Link to="/collections" className="btn ghost sm">التفاصيل</Link>
          </div>
          <div className="card-body">
            {d.ag.total <= 0 ? (
              <EmptyState icon="🎉" title="لا ديون قائمة" text="كل العملاء مسدِّدون." />
            ) : (
              <div className="aging-wrap">
                <Donut segments={agingSegments} size={170} stroke={24}>
                  <div className="muted xs">إجمالي</div>
                  <b style={{ fontSize: '1.2rem' }}><CountUp value={d.ag.total} format={(n) => money(Math.round(n), { compact: true })} /></b>
                </Donut>
                <div className="legend">
                  {agingSegments.map((s) => (
                    <div key={s.label} className="legend-row">
                      <i style={{ background: s.color }} />
                      {s.label}
                      <b className="num">{money(s.value, { compact: true })}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {d.ag.total > 0 && <div style={{ marginTop: '1rem' }}><StackBar segments={agingSegments} /></div>}
          </div>
        </motion.section>
      </div>

      {/* Row 3 */}
      <div className="dash-row r-1-1-1">
        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico"><Trophy size={17} /></span> {isRep ? 'عملاء يستحقون زيارتك' : 'ترتيب المندوبين هذا الشهر'}
            </h3>
          </div>
          <div className="card-body">
            {isRep ? (
              d.stale.length === 0 ? (
                <EmptyState icon="✅" title="زرت الجميع مؤخرًا" />
              ) : (
                <div className="col" style={{ gap: '0.5rem' }}>
                  {d.stale.slice(0, 6).map((c) => (
                    <Link key={c.id} to={`/customers?open=${c.id}`} className="mini-row">
                      <Avatar name={c.name} size="sm" color={zoneById.get(c.zoneId)?.color} />
                      <div className="grow">
                        <b className="truncate" style={{ display: 'block' }}>{c.name}</b>
                        <span className="muted xs">{c.lastVisitAt ? `آخر زيارة ${fmtAgo(c.lastVisitAt)}` : 'لم تتم زيارته بعد'}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            ) : (
              <div className="col" style={{ gap: '0.9rem' }}>
                {leaderboard.slice(0, 5).map((l, i) => (
                  <div key={l.rep.id} className="lb-row">
                    <span className={`rank r${i + 1}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                    <Avatar name={l.rep.name} color={l.rep.color} size="sm" />
                    <div className="grow">
                      <div className="row between">
                        <b className="truncate">{l.rep.name}</b>
                        <b className="num">{money(l.sales, { compact: true })}</b>
                      </div>
                      <Progress value={l.sales} max={Math.max(l.rep.salesTarget, 1)} size="thin" c1={l.rep.color} c2={l.rep.color} />
                      <span className="muted xs">{fmtPct((l.sales / Math.max(l.rep.salesTarget, 1)) * 100)} من الهدف • تحصيل {money(l.cols, { compact: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>

        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico"><MapPinned size={17} /></span> المبيعات حسب المنطقة
            </h3>
            <Link to="/zones" className="btn ghost sm">المناطق</Link>
          </div>
          <div className="card-body">
            <BarList items={zoneItems.map((z) => ({ ...z, display: money(z.value, { compact: true }) }))} />
          </div>
        </motion.section>

        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}><AlertTriangle size={17} /></span> تنبيهات ذكية
            </h3>
            <Badge tone={alerts.length ? 'red' : 'green'}>{alerts.length || 'سليم'}</Badge>
          </div>
          <div className="card-body">
            {alerts.length === 0 ? (
              <EmptyState icon="🎉" title="لا تنبيهات" text="كل شيء تحت السيطرة." />
            ) : (
              <div className="col" style={{ gap: '0.5rem' }}>
                {alerts.slice(0, 5).map((a) => (
                  <Link key={a.id} to={a.to} className="mini-row">
                    <span className={`badge ${a.tone}`} style={{ width: 36, height: 36, borderRadius: 12, padding: 0, justifyContent: 'center' }}>
                      <a.icon size={18} />
                    </span>
                    <div className="grow">
                      <b style={{ display: 'block', fontSize: '0.875rem' }}>{a.title}</b>
                      <span className="muted xs">{a.text}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      </div>

      {/* Row 4 */}
      <div className="dash-row r-2-1">
        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico"><ClipboardList size={17} /></span> أحدث الطلبات
            </h3>
            <Link to="/orders" className="btn ghost sm">كل الطلبات</Link>
          </div>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            {recent.length === 0 ? (
              <EmptyState icon="🧾" title="لا طلبات بعد" text="ابدأ بإنشاء أول طلب." action={can(role, 'orders.create') ? { label: 'طلب جديد', onClick: () => nav('/orders/new') } : undefined} />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>الطلب</th>
                    <th>العميل</th>
                    <th className="hide-mobile">المندوب</th>
                    <th className="num">الإجمالي</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id} className="click" onClick={() => nav(`/orders?open=${o.id}`)}>
                      <td>
                        <b className="ltr">#{o.no}</b>
                        <div className="muted xs">{fmtAgo(o.createdAt)}</div>
                      </td>
                      <td>{o.customerName}</td>
                      <td className="hide-mobile">
                        <span className="row" style={{ gap: 6 }}>
                          <Avatar name={o.repName} size="sm" color={repById.get(o.repId)?.color} round /> {o.repName}
                        </span>
                      </td>
                      <td className="num bold">{money(o.total)}</td>
                      <td>
                        <OrderStatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.section>

        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico"><CalendarClock size={17} /></span> آخر النشاطات
            </h3>
          </div>
          <div className="card-body">
            <ul className="timeline">
              {feed.map((f, i) => (
                <motion.li key={f.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                  <span className={`tl-dot ${f.tone}`}>{f.icon}</span>
                  <div className="grow">
                    <b className="truncate" style={{ display: 'block', fontSize: '0.875rem' }}>{f.title}</b>
                    <span className="muted xs">{f.sub} • {fmtAgo(f.ts)}</span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
