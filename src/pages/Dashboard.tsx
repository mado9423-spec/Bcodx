import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, CheckCircle2, ClipboardList, Coins, MapPinned, PackageX, Plus, Target,
  TrendingUp, Trophy, Wallet,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { AgingBreakdown, AreaChart, BarList, ChartCard, Ring, Sparkline } from '../components/ui/Charts';
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
  icon: ReactNode;
  /** لون التمييز (متغير CSS) للأيقونة والنقطة الحالية في الخط المصغّر */
  color: string;
  spark?: number[];
  delta?: number | null;
  deltaLabel?: string;
  /** هل الارتفاع خبر جيد؟ (المبيعات نعم، الديون لا) — يحدد لون التغيّر */
  goodWhenUp?: boolean;
  foot?: ReactNode;
  to?: string;
}

/** بطاقة مؤشر (stat tile): الاسم · القيمة · التغيّر مقابل فترة مسمّاة · اتجاه */
function Kpi({ label, value, format, icon, color, spark, delta, deltaLabel, goodWhenUp = true, foot, to }: KpiProps) {
  const good = delta === undefined || delta === null ? true : goodWhenUp ? delta >= 0 : delta <= 0;
  const body = (
    <motion.div variants={rise} className={`card kpi ${to ? 'hover' : ''}`} style={{ ['--k' as string]: color }}>
      <div className="kpi-top">
        <span className="kpi-ico">{icon}</span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        <CountUp value={value} format={format} />
      </div>
      {delta !== undefined && delta !== null && (
        <div className={`delta ${good ? 'up' : 'down'}`}>
          {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <b dir="ltr">{delta >= 0 ? '+' : '−'}{fmtPct(Math.abs(delta))}</b>
          {deltaLabel && <span className="delta-label">{deltaLabel}</span>}
        </div>
      )}
      <div className="kpi-foot">{foot}</div>
      {spark && (
        <div className="kpi-spark">
          <Sparkline values={spark} color={color} width={112} height={42} />
        </div>
      )}
    </motion.div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

type Period = '7' | '30' | '90' | 'month';
const PERIOD_LABEL: Record<Period, string> = { '7': 'آخر 7 أيام', '30': 'آخر 30 يومًا', '90': 'آخر 90 يومًا', month: 'هذا الشهر' };

export default function Dashboard() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const { orders, collections, customers, products, reps, zones, repById, zoneById, stockTotal, aging, visits, money, company } = useData();
  const alerts = useAlerts(profile?.role);
  const [period, setPeriod] = useState<Period>('30');
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
    // مقارنة عادلة: أمس حتى الساعة نفسها (وليس يومًا كاملًا مقابل نصف يوم)
    const yesterdaySoFar = sum(sales.filter((o) => o.createdAt >= today - DAY && o.createdAt < now - DAY), (o) => o.total);
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

    const s12 = dailyTotals(sales, (o) => o.createdAt, (o) => o.total, 12, now).values;
    const c12 = dailyTotals(cols, (c) => c.createdAt, (c) => c.amount, 12, now).values;
    const o12 = dailyTotals(open, (o) => o.createdAt, () => 1, 12, now).values;

    const stale = myCustomers.filter((c) => c.active && (c.lastVisitAt ?? 0) < now - 7 * DAY).sort((a, b) => (a.lastVisitAt ?? 0) - (b.lastVisitAt ?? 0));
    const dueToday = myCustomers.filter((c) => c.promiseDate !== undefined && c.balance > 0 && c.promiseDate < today + DAY);

    return { now, today, todaySales, yesterdaySoFar, monthSales, monthCollected, todayCollected, salesTarget, collectTarget, debt, ag, open, holds, low, out, s12, c12, o12, stale, dueToday };
  }, [orders, collections, customers, products, reps, aging, stockTotal, isRep, myRep, profile]);

  // ---- تحليل الفترة (يتحكم به الفلتر الواحد فوق الرسوم) ----
  const range = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(now);
    const from = period === 'month' ? startOfMonth(now) : today - (Number(period) - 1) * DAY;
    return { from, days: Math.round((today - from) / DAY) + 1 };
  }, [period]);

  const p = useMemo(() => {
    const sales = orders.filter((o) => isSale(o) && o.createdAt >= range.from);
    const cols = collections.filter((c) => isActiveCollection(c) && c.createdAt >= range.from);
    const s = dailyTotals(sales, (o) => o.createdAt, (o) => o.total, range.days);
    const c = dailyTotals(cols, (x) => x.createdAt, (x) => x.amount, range.days);
    const zoneSales = groupSum(sales, (o) => o.zoneId, (o) => o.total);
    const repSales = groupSum(sales, (o) => o.repId, (o) => o.total);
    const repCols = groupSum(cols, (x) => x.repId, (x) => x.amount);
    return { labels: s.starts.map(fmtShortDate), sales: s.values, cols: c.values, totalSales: sum(sales, (o) => o.total), totalCols: sum(cols, (x) => x.amount), zoneSales, repSales, repCols };
  }, [orders, collections, range]);

  const recent = useMemo(() => [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 7), [orders]);

  const feed = useMemo(() => {
    type F = { id: string; ts: number; icon: ReactNode; tone: string; title: string; sub: string };
    const items: F[] = [];
    for (const o of orders.slice(0, 40)) items.push({ id: `o${o.id}`, ts: o.createdAt, icon: <ClipboardList size={16} />, tone: 'violet', title: `طلب ${o.no} — ${o.customerName}`, sub: `${o.repName} • ${money(o.total)}` });
    for (const c of collections.slice(0, 40)) if (c.status === 'active' && !c.orderId) items.push({ id: `c${c.id}`, ts: c.createdAt, icon: <Banknote size={16} />, tone: 'green', title: `تحصيل ${money(c.amount)} من ${c.customerName}`, sub: c.repName });
    for (const v of visits.slice(0, 30)) items.push({ id: `v${v.id}`, ts: v.createdAt, icon: <MapPinned size={16} />, tone: 'blue', title: `زيارة ${v.customerName}`, sub: v.repName });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [orders, collections, visits, money]);

  const dayDelta = pctChange(d.todaySales, d.yesterdaySoFar);
  const targetPct = d.salesTarget > 0 ? (d.monthSales / d.salesTarget) * 100 : 0;
  const collectPct = d.collectTarget > 0 ? (d.monthCollected / d.collectTarget) * 100 : 0;
  const nd = new Date(d.now);
  const daysInMonth = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
  const expectedPct = (nd.getDate() / daysInMonth) * 100;
  const onPace = targetPct >= expectedPct;

  const summaryBits: string[] = [];
  if (d.holds > 0 && can(role, 'orders.approve_credit')) summaryBits.push(`${fmtNum(d.holds)} طلب ينتظر موافقتك`);
  if (d.dueToday.length > 0 && can(role, 'collections.view')) summaryBits.push(`${fmtNum(d.dueToday.length)} وعد سداد مستحق اليوم`);
  if (d.out > 0 && can(role, 'inventory.view')) summaryBits.push(`${fmtNum(d.out)} صنف نافد`);
  if (isRep && d.stale.length > 0) summaryBits.push(`${fmtNum(Math.min(d.stale.length, 99))} عميل يحتاج زيارة`);

  const zoneRows = [...zones].map((z) => ({ id: z.id, name: z.name, value: p.zoneSales.get(z.id) ?? 0 })).sort((a, b) => b.value - a.value);
  const leaderboard = reps
    .filter((r) => r.active)
    .map((r) => ({ rep: r, sales: p.repSales.get(r.id) ?? 0, cols: p.repCols.get(r.id) ?? 0 }))
    .sort((a, b) => b.sales - a.sales);
  const leaderMax = Math.max(1, ...leaderboard.map((l) => l.sales));

  return (
    <motion.div className="dash" variants={stagger} initial="hidden" animate="show">
      {/* ملخص اليوم */}
      <motion.section variants={rise} className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="hero-main">
          <span className="hero-date">{fmtWeekday(d.now)}</span>
          <h1>
            {greeting()}، <em>{profile!.name}</em>
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
              <Button leading={<Plus size={18} />} onClick={() => nav('/orders/new')}>
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
          <Ring value={d.monthSales} max={Math.max(d.salesTarget, 1)} size={176} stroke={14} color="#fff" color2="#9ff5e8">
            <div className="hero-ring-num">
              <CountUp value={targetPct} format={(n) => `${fmtNum(Math.round(n))}%`} />
            </div>
            <div className="hero-ring-sub">من هدف الشهر</div>
          </Ring>
          <div className="hero-ring-foot">
            <Target size={14} /> المتوقع حتى اليوم {fmtNum(Math.round(expectedPct))}%
            <span className={onPace ? 'pace good' : 'pace slow'}> • {onPace ? 'ضمن الوتيرة' : 'أقل من الوتيرة'}</span>
          </div>
        </div>
      </motion.section>

      {/* المؤشرات */}
      <motion.div variants={stagger} className="kpi-grid">
        <Kpi label="مبيعات اليوم" value={d.todaySales} format={(n) => money(Math.round(n), { compact: n > 99999 })} icon={<TrendingUp size={20} />} color="var(--chart-1)" spark={d.s12} delta={dayDelta} deltaLabel="عن أمس حتى الآن" foot={<span className="muted">أمس حتى الآن: {money(d.yesterdaySoFar, { compact: true })}</span>} to="/orders" />
        <Kpi label="مبيعات الشهر" value={d.monthSales} format={(n) => money(Math.round(n), { compact: true })} icon={<Coins size={20} />} color="var(--chart-1)" foot={<><Progress value={d.monthSales} max={Math.max(d.salesTarget, 1)} size="thin" c1="var(--chart-1)" /><span className="muted xs">{fmtPct(targetPct)} من الهدف {money(d.salesTarget, { compact: true })}</span></>} />
        <Kpi label="إجمالي الديون" value={d.debt} format={(n) => money(Math.round(n), { compact: true })} icon={<Wallet size={20} />} color="var(--age-2)" foot={<span style={{ color: d.ag.overdue > 0 ? 'var(--bad)' : 'var(--muted)' }}>{d.ag.overdue > 0 ? `منها متأخر ${money(d.ag.overdue, { compact: true })}` : 'لا متأخرات'}</span>} to="/collections" />
        <Kpi label="المحصّل هذا الشهر" value={d.monthCollected} format={(n) => money(Math.round(n), { compact: true })} icon={<Banknote size={20} />} color="var(--chart-2)" spark={d.c12} foot={<><Progress value={d.monthCollected} max={Math.max(d.collectTarget, 1)} size="thin" c1="var(--chart-2)" /><span className="muted xs">اليوم {money(d.todayCollected, { compact: true })} • {fmtPct(collectPct)} من الهدف</span></>} to="/collections" />
        <Kpi label="طلبات مفتوحة" value={d.open.length} icon={<ClipboardList size={20} />} color="#b97a00" spark={d.o12} foot={<span className="muted">{d.holds > 0 ? `${fmtNum(d.holds)} بانتظار الائتمان` : 'لا طلبات معلّقة'}</span>} to="/orders" />
        {can(role, 'inventory.view') && <Kpi label="أصناف منخفضة" value={d.low.length} icon={<PackageX size={20} />} color="#c42b58" foot={<span className="muted">{d.out > 0 ? `${fmtNum(d.out)} صنف نافد تمامًا` : 'لا أصناف نافدة'}</span>} to="/inventory?filter=low" />}
      </motion.div>

      {/* الوضع الحالي (لقطة لا تتأثر بفلتر الفترة) */}
      <div className="dash-row r-2-1">
        <ChartCard
          title="أعمار الديون"
          icon={<Wallet size={17} />}
          controls={<Link to="/collections" className="btn ghost sm">التفاصيل</Link>}
          table={{ head: ['الشريحة', 'المبلغ', 'النسبة'], rows: AGING_BUCKETS.map((b) => [b.label, money(Math.round(d.ag[b.key])), d.ag.total > 0 ? fmtPct((d.ag[b.key] / d.ag.total) * 100) : '—']) }}
        >
          {d.ag.total <= 0 ? <EmptyState icon={<CheckCircle2 size={34} />} title="لا ديون قائمة" text="كل العملاء مسدِّدون." /> : <AgingBreakdown aging={d.ag} money={money} />}
        </ChartCard>

        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico" style={{ background: 'var(--bad-bg)', color: 'var(--bad)' }}><AlertTriangle size={17} /></span> تنبيهات ذكية
            </h3>
            <Badge tone={alerts.length ? 'red' : 'green'}>{alerts.length || 'سليم'}</Badge>
          </div>
          <div className="card-body">
            {alerts.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={34} />} title="لا تنبيهات" text="كل شيء تحت السيطرة." />
            ) : (
              <div className="col" style={{ gap: '0.4rem' }}>
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

      {/* فلتر الفترة: صف واحد فوق الرسوم التي يحكمها */}
      <motion.div variants={rise} className="filter-bar" role="group" aria-label="فلتر الفترة">
        <span className="label bold small">تحليل الفترة</span>
        <Segmented name="period" value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABEL) as Period[]).map((k) => ({ value: k, label: PERIOD_LABEL[k] }))} />
        <span className="muted xs">يحكم المبيعات والتحصيل والمناطق والمندوبين أدناه</span>
      </motion.div>

      <div className="dash-row r-2-1">
        <ChartCard
          title="المبيعات مقابل التحصيل"
          icon={<TrendingUp size={17} />}
          table={{ head: ['اليوم', 'المبيعات', 'التحصيل'], rows: p.labels.map((l, i) => [l, money(Math.round(p.sales[i] ?? 0)), money(Math.round(p.cols[i] ?? 0))]).reverse() }}
        >
          <AreaChart
            animKey={period}
            labels={p.labels}
            format={(n) => fmtCompact(n)}
            ariaLabel="المبيعات مقابل التحصيل"
            series={[
              { key: 'sales', label: 'المبيعات', color: 'var(--chart-1)', values: p.sales, summary: money(Math.round(p.totalSales), { compact: true }) },
              { key: 'cols', label: 'التحصيل', color: 'var(--chart-2)', values: p.cols, summary: money(Math.round(p.totalCols), { compact: true }) },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="المبيعات حسب المنطقة"
          icon={<MapPinned size={17} />}
          table={{ head: ['المنطقة', 'المبيعات'], rows: zoneRows.map((z) => [z.name, money(Math.round(z.value))]) }}
        >
          <BarList key={period} items={zoneRows.map((z) => ({ label: z.name, value: z.value, display: money(Math.round(z.value), { compact: true }) }))} />
        </ChartCard>
      </div>

      <div className="dash-row r-1-2">
        <motion.section variants={rise} className="card">
          <div className="card-head">
            <h3>
              <span className="ico"><Trophy size={17} /></span> {isRep ? 'عملاء يستحقون زيارتك' : `ترتيب المندوبين — ${PERIOD_LABEL[period]}`}
            </h3>
          </div>
          <div className="card-body">
            {isRep ? (
              d.stale.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={34} />} title="زرت الجميع مؤخرًا" />
              ) : (
                <div className="col" style={{ gap: '0.4rem' }}>
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
              <div className="col" style={{ gap: '0.95rem' }}>
                {leaderboard.slice(0, 6).map((l, i) => (
                  <div key={l.rep.id} className="lb-row">
                    <span className="rank">{i + 1}</span>
                    <Avatar name={l.rep.name} color={l.rep.color} size="sm" />
                    <div className="grow">
                      <div className="row between">
                        <b className="truncate">{l.rep.name}</b>
                        <b className="num">{money(Math.round(l.sales), { compact: true })}</b>
                      </div>
                      <Progress value={l.sales} max={period === 'month' ? Math.max(l.rep.salesTarget, 1) : leaderMax} size="thin" c1="var(--chart-1)" />
                      <span className="muted xs">
                        {period === 'month' ? `${fmtPct((l.sales / Math.max(l.rep.salesTarget, 1)) * 100)} من الهدف` : `${fmtPct(p.totalSales ? (l.sales / p.totalSales) * 100 : 0)} من المبيعات`} • تحصيل {money(Math.round(l.cols), { compact: true })}
                      </span>
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
              <span className="ico"><ClipboardList size={17} /></span> أحدث الطلبات
            </h3>
            <Link to="/orders" className="btn ghost sm">كل الطلبات</Link>
          </div>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            {recent.length === 0 ? (
              <EmptyState icon={<ClipboardList size={34} />} title="لا طلبات بعد" text="ابدأ بإنشاء أول طلب." action={can(role, 'orders.create') ? { label: 'طلب جديد', onClick: () => nav('/orders/new') } : undefined} />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>الطلب</th>
                    <th>العميل</th>
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
                      <td>
                        <b style={{ display: 'block' }}>{o.customerName}</b>
                        <span className="muted xs">{o.repName}</span>
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
      </div>

      <motion.section variants={rise} className="card">
        <div className="card-head">
          <h3>
            <span className="ico"><CalendarClock size={17} /></span> آخر النشاطات
          </h3>
        </div>
        <div className="card-body">
          <ul className="timeline cols-2">
            {feed.map((f, i) => (
              <motion.li key={f.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }}>
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
    </motion.div>
  );
}
