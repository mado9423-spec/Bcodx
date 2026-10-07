import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AreaChart, BarList, Donut } from '../components/ui/Charts';
import { CountUp } from '../components/ui/CountUp';
import { Segmented, Tabs } from '../components/ui/Fields';
import { EmptyState, PageHeader, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { PAYMENT_METHOD_LABELS } from '../data/types';
import { AGING_BUCKETS, sumAging } from '../lib/aging';
import { downloadCsv, type CsvCell } from '../lib/csv';
import { fmtCompact, fmtNum, fmtPct, fmtShortDate } from '../lib/format';
import { dailyTotals, groupSum, isActiveCollection, isSale, sum } from '../lib/stats';
import { DAY, startOfDay, startOfMonth } from '../lib/time';

type Report = 'sales' | 'products' | 'reps' | 'zones' | 'debts' | 'collections' | 'stock';
type Period = '7' | '30' | '90' | 'month';

interface Col<T> {
  label: string;
  num?: boolean;
  value: (r: T) => CsvCell;
  cell?: (r: T) => ReactNode;
}

function ReportTable<T>({ cols, rows, csv, empty = 'لا بيانات ضمن هذه الفترة' }: { cols: Col<T>[]; rows: T[]; csv: string; empty?: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>التفاصيل</h3>
        <Button size="sm" leading={<Download size={14} />} onClick={() => downloadCsv(csv, [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => c.value(r)))])} disabled={rows.length === 0}>CSV</Button>
      </div>
      {rows.length === 0 ? <EmptyState icon="📊" title={empty} /> : (
        <div className="table-wrap" style={{ marginTop: '0.6rem' }}>
          <table className="table">
            <thead><tr>{cols.map((c) => <th key={c.label} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, 100).map((r, i) => (
                <tr key={i}>{cols.map((c) => <td key={c.label} className={c.num ? 'num' : ''}>{c.cell ? c.cell(r) : String(c.value(r) ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, format, color }: { label: string; value: number; format: (n: number) => string; color: string }) {
  return (
    <motion.div variants={rise} className="card kpi" style={{ ['--k' as string]: color, minHeight: 110 }}>
      <div className="kpi-label" style={{ marginTop: 0 }}>{label}</div>
      <div className="kpi-value"><CountUp value={value} format={format} /></div>
    </motion.div>
  );
}

export default function Reports() {
  const { orders, collections, customers, products, reps, zones, warehouses, stock, productById, repById, aging, money, stockTotal } = useData();
  const [report, setReport] = useState<Report>('sales');
  const [period, setPeriod] = useState<Period>('30');

  const range = useMemo(() => {
    const now = Date.now();
    const from = period === 'month' ? startOfMonth(now) : startOfDay(now) - (Number(period) - 1) * DAY;
    const days = Math.max(1, Math.round((startOfDay(now) - from) / DAY) + 1);
    return { from, to: now + 1, days };
  }, [period]);

  const sales = useMemo(() => orders.filter((o) => isSale(o) && o.createdAt >= range.from && o.createdAt < range.to), [orders, range]);
  const cols = useMemo(() => collections.filter((c) => isActiveCollection(c) && c.createdAt >= range.from && c.createdAt < range.to), [collections, range]);
  const totalSales = sum(sales, (o) => o.total);

  const series = useMemo(() => {
    const s = dailyTotals(sales, (o) => o.createdAt, (o) => o.total, range.days);
    const c = dailyTotals(cols, (x) => x.createdAt, (x) => x.amount, range.days);
    return { labels: s.starts.map(fmtShortDate), sales: s.values, cols: c.values };
  }, [sales, cols, range]);

  const productRows = useMemo(() => {
    const m = new Map<string, { qty: number; free: number; revenue: number; cogs: number }>();
    for (const o of sales) for (const it of o.items) {
      const cur = m.get(it.productId) ?? { qty: 0, free: 0, revenue: 0, cogs: 0 };
      cur.qty += it.qty;
      cur.free += it.freeQty;
      cur.revenue += it.lineTotal;
      cur.cogs += (it.qty + it.freeQty) * (productById.get(it.productId)?.cost ?? 0);
      m.set(it.productId, cur);
    }
    return [...m.entries()].map(([id, v]) => ({ id, name: productById.get(id)?.name ?? '—', emoji: productById.get(id)?.emoji ?? '📦', category: productById.get(id)?.category ?? '', ...v, profit: v.revenue - v.cogs })).sort((a, b) => b.revenue - a.revenue);
  }, [sales, productById]);

  const repRows = useMemo(() => {
    const sBy = groupSum(sales, (o) => o.repId, (o) => o.total);
    const nBy = groupSum(sales, (o) => o.repId, () => 1);
    const cBy = groupSum(cols, (c) => c.repId, (c) => c.amount);
    return reps.map((r) => ({ rep: r, sales: sBy.get(r.id) ?? 0, orders: nBy.get(r.id) ?? 0, cols: cBy.get(r.id) ?? 0 })).sort((a, b) => b.sales - a.sales);
  }, [reps, sales, cols]);

  const zoneRows = useMemo(() => {
    const sBy = groupSum(sales, (o) => o.zoneId, (o) => o.total);
    const nBy = groupSum(sales, (o) => o.zoneId, () => 1);
    return zones.map((z) => ({ zone: z, sales: sBy.get(z.id) ?? 0, orders: nBy.get(z.id) ?? 0, debt: sum(customers.filter((c) => c.zoneId === z.id), (c) => Math.max(0, c.balance)) })).sort((a, b) => b.sales - a.sales);
  }, [zones, sales, customers]);

  const debtRows = useMemo(() => customers.filter((c) => c.balance > 0.005).map((c) => ({ c, a: aging.get(c.id)! })).sort((x, y) => y.c.balance - x.c.balance), [customers, aging]);
  const debtTotals = useMemo(() => sumAging(debtRows.map((r) => r.a)), [debtRows]);

  const topCustomers = useMemo(() => {
    const m = groupSum(sales, (o) => o.customerId, (o) => o.total);
    const n = groupSum(sales, (o) => o.customerId, () => 1);
    return [...m.entries()].map(([id, v]) => ({ id, name: customers.find((c) => c.id === id)?.name ?? '—', sales: v, orders: n.get(id) ?? 0 })).sort((a, b) => b.sales - a.sales).slice(0, 15);
  }, [sales, customers]);

  const methodRows = (['cash', 'transfer', 'cheque'] as const).map((m) => ({ m, v: sum(cols.filter((c) => c.method === m), (c) => c.amount) }));

  const stockValueByWh = warehouses.map((w) => ({ w, value: sum(stock.filter((s) => s.warehouseId === w.id), (s) => s.qty * (productById.get(s.productId)?.cost ?? 0)), units: sum(stock.filter((s) => s.warehouseId === w.id), (s) => s.qty) }));
  const soldIds = new Set(productRows.map((p) => p.id));
  const slow = products.filter((p) => p.active && !soldIds.has(p.id) && stockTotal(p.id) > 0).sort((a, b) => stockTotal(b.id) * b.cost - stockTotal(a.id) * a.cost);
  const lowStock = products.filter((p) => p.active && stockTotal(p.id) <= p.minStock).sort((a, b) => stockTotal(a.id) - stockTotal(b.id));

  const avgOrder = sales.length ? totalSales / sales.length : 0;
  const discounts = sum(sales, (o) => o.lineDiscount + o.orderDiscount);
  const totalCols = sum(cols, (c) => c.amount);
  const profit = sum(productRows, (p) => p.profit);

  const title: Record<Report, string> = { sales: 'تقرير المبيعات', products: 'المنتجات والربحية', reps: 'أداء المندوبين', zones: 'أداء المناطق', debts: 'الديون وأعمارها', collections: 'التحصيل', stock: 'المخزون' };

  return (
    <div className="report-area">
      <PageHeader
        title="التقارير"
        subtitle={title[report]}
        actions={<><Button leading={<Printer size={16} />} onClick={() => window.print()} className="no-print">طباعة</Button></>}
      />
      <div className="row between wrap no-print" style={{ marginBottom: '1rem' }}>
        <Tabs
          name="report-tab"
          value={report}
          onChange={setReport}
          options={[
            { value: 'sales', label: 'المبيعات' }, { value: 'products', label: 'المنتجات' }, { value: 'reps', label: 'المندوبون' }, { value: 'zones', label: 'المناطق' },
            { value: 'debts', label: 'الديون' }, { value: 'collections', label: 'التحصيل' }, { value: 'stock', label: 'المخزون' },
          ]}
        />
        {report !== 'debts' && report !== 'stock' && (
          <Segmented name="report-period" value={period} onChange={setPeriod} options={[{ value: '7', label: '7 أيام' }, { value: '30', label: '30 يومًا' }, { value: '90', label: '90 يومًا' }, { value: 'month', label: 'هذا الشهر' }]} />
        )}
      </div>

      <motion.div key={`${report}-${period}`} variants={stagger} initial="hidden" animate="show" className="col" style={{ gap: '1.2rem' }}>
        {report === 'sales' && (
          <>
            <div className="kpi-grid">
              <Stat label="إجمالي المبيعات" value={totalSales} format={(n) => money(n, { compact: true })} color="#6d4aff" />
              <Stat label="عدد الطلبات" value={sales.length} format={(n) => fmtNum(Math.round(n))} color="#00b8a9" />
              <Stat label="متوسط الطلب" value={avgOrder} format={(n) => money(n, { compact: true })} color="#f5b50a" />
              <Stat label="خصومات ممنوحة" value={discounts} format={(n) => money(n, { compact: true })} color="#ff6b5b" />
            </div>
            <motion.div variants={rise} className="card"><div className="card-head"><h3>المبيعات اليومية</h3></div><div className="card-body"><AreaChart animKey={`${period}`} labels={series.labels} series={[{ label: 'المبيعات', color: '#6d4aff', values: series.sales }]} format={fmtCompact} /></div></motion.div>
            <ReportTable csv="top-customers" rows={topCustomers} cols={[{ label: 'أفضل العملاء', value: (r) => r.name }, { label: 'الطلبات', num: true, value: (r) => r.orders }, { label: 'المبيعات', num: true, value: (r) => r.sales, cell: (r) => money(r.sales) }, { label: 'الحصة', num: true, value: (r) => +((r.sales / Math.max(totalSales, 1)) * 100).toFixed(1), cell: (r) => fmtPct((r.sales / Math.max(totalSales, 1)) * 100, 1) }]} />
          </>
        )}
        {report === 'products' && (
          <>
            <div className="kpi-grid">
              <Stat label="إيراد الأصناف" value={sum(productRows, (p) => p.revenue)} format={(n) => money(n, { compact: true })} color="#6d4aff" />
              <Stat label="الربح التقديري" value={profit} format={(n) => money(n, { compact: true })} color="#12b76a" />
              <Stat label="أصناف مباعة" value={productRows.length} format={(n) => fmtNum(Math.round(n))} color="#00b8a9" />
            </div>
            <motion.div variants={rise} className="card"><div className="card-head"><h3>الأعلى مبيعًا</h3></div><div className="card-body"><BarList items={productRows.slice(0, 8).map((p) => ({ label: `${p.emoji} ${p.name}`, value: p.revenue, display: money(p.revenue, { compact: true }), color: '#6d4aff' }))} /></div></motion.div>
            <ReportTable csv="products" rows={productRows} cols={[{ label: 'الصنف', value: (r) => r.name, cell: (r) => <b>{r.emoji} {r.name}</b> }, { label: 'الفئة', value: (r) => r.category }, { label: 'الكمية', num: true, value: (r) => r.qty }, { label: 'مجاني', num: true, value: (r) => r.free }, { label: 'الإيراد', num: true, value: (r) => r.revenue, cell: (r) => money(r.revenue) }, { label: 'الربح', num: true, value: (r) => r.profit, cell: (r) => <span style={{ color: r.profit >= 0 ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{money(r.profit)}</span> }, { label: 'الهامش %', num: true, value: (r) => +((r.profit / Math.max(r.revenue, 1)) * 100).toFixed(1), cell: (r) => fmtPct((r.profit / Math.max(r.revenue, 1)) * 100, 1) }]} />
          </>
        )}
        {report === 'reps' && (
          <>
            <motion.div variants={rise} className="card"><div className="card-head"><h3>المبيعات حسب المندوب</h3></div><div className="card-body"><BarList items={repRows.map((r) => ({ label: r.rep.name, value: r.sales, color: r.rep.color, display: money(r.sales, { compact: true }) }))} /></div></motion.div>
            <ReportTable csv="reps" rows={repRows} cols={[{ label: 'المندوب', value: (r) => r.rep.name }, { label: 'الطلبات', num: true, value: (r) => r.orders }, { label: 'المبيعات', num: true, value: (r) => r.sales, cell: (r) => money(r.sales) }, { label: 'متوسط الطلب', num: true, value: (r) => Math.round(r.orders ? r.sales / r.orders : 0), cell: (r) => money(r.orders ? r.sales / r.orders : 0, { compact: true }) }, { label: 'التحصيل', num: true, value: (r) => r.cols, cell: (r) => money(r.cols) }, { label: 'نسبة التحصيل من المبيعات', num: true, value: (r) => +((r.cols / Math.max(r.sales, 1)) * 100).toFixed(1), cell: (r) => fmtPct((r.cols / Math.max(r.sales, 1)) * 100) }]} />
          </>
        )}
        {report === 'zones' && (
          <>
            <motion.div variants={rise} className="card"><div className="card-head"><h3>المبيعات حسب المنطقة</h3></div><div className="card-body"><BarList items={zoneRows.map((z) => ({ label: z.zone.name, value: z.sales, color: z.zone.color, display: money(z.sales, { compact: true }) }))} /></div></motion.div>
            <ReportTable csv="zones" rows={zoneRows} cols={[{ label: 'المنطقة', value: (r) => r.zone.name }, { label: 'الطلبات', num: true, value: (r) => r.orders }, { label: 'المبيعات', num: true, value: (r) => r.sales, cell: (r) => money(r.sales) }, { label: 'الحصة', num: true, value: (r) => +((r.sales / Math.max(totalSales, 1)) * 100).toFixed(1), cell: (r) => fmtPct((r.sales / Math.max(totalSales, 1)) * 100) }, { label: 'الديون', num: true, value: (r) => r.debt, cell: (r) => money(r.debt) }]} />
          </>
        )}
        {report === 'debts' && (
          <>
            <div className="kpi-grid">
              <Stat label="إجمالي الديون" value={debtTotals.total} format={(n) => money(n, { compact: true })} color="#ff6b5b" />
              <Stat label="المتأخر" value={debtTotals.overdue} format={(n) => money(n, { compact: true })} color="#e5385f" />
              <Stat label="عملاء مدينون" value={debtRows.length} format={(n) => fmtNum(Math.round(n))} color="#f5b50a" />
            </div>
            <motion.div variants={rise} className="card"><div className="card-head"><h3>أعمار الديون</h3></div><div className="card-body"><div className="aging-wrap"><Donut size={190} stroke={26} segments={AGING_BUCKETS.map((b) => ({ label: b.label, value: debtTotals[b.key], color: b.color }))}><b style={{ fontSize: '1.2rem' }}>{money(debtTotals.total, { compact: true })}</b></Donut><div className="legend">{AGING_BUCKETS.map((b) => <div key={b.key} className="legend-row"><i style={{ background: b.color }} />{b.label}<b className="num">{money(debtTotals[b.key], { compact: true })}</b></div>)}</div></div></div></motion.div>
            <ReportTable csv="debts" rows={debtRows} cols={[{ label: 'العميل', value: (r) => r.c.name }, { label: 'المندوب', value: (r) => repById.get(r.c.repId)?.name }, { label: 'الرصيد', num: true, value: (r) => r.c.balance, cell: (r) => <b>{money(r.c.balance)}</b> }, ...AGING_BUCKETS.map((b) => ({ label: b.label, num: true, value: (r: { c: unknown; a: ReturnType<typeof sumAging> }) => Math.round(r.a[b.key]), cell: (r: { c: unknown; a: ReturnType<typeof sumAging> }) => (r.a[b.key] > 0.005 ? money(r.a[b.key], { compact: true }) : '—') }))]} />
          </>
        )}
        {report === 'collections' && (
          <>
            <div className="kpi-grid">
              <Stat label="إجمالي التحصيل" value={totalCols} format={(n) => money(n, { compact: true })} color="#12b76a" />
              <Stat label="عدد السندات" value={cols.length} format={(n) => fmtNum(Math.round(n))} color="#6d4aff" />
              <Stat label="نسبة التحصيل من المبيعات" value={totalSales ? (totalCols / totalSales) * 100 : 0} format={(n) => fmtPct(n)} color="#00b8a9" />
            </div>
            <motion.div variants={rise} className="card"><div className="card-head"><h3>التحصيل اليومي</h3></div><div className="card-body"><AreaChart animKey={`${period}-c`} labels={series.labels} series={[{ label: 'التحصيل', color: '#12b76a', values: series.cols }]} format={fmtCompact} /></div></motion.div>
            <ReportTable csv="collections-methods" rows={methodRows} cols={[{ label: 'طريقة الدفع', value: (r) => PAYMENT_METHOD_LABELS[r.m] }, { label: 'المبلغ', num: true, value: (r) => r.v, cell: (r) => money(r.v) }, { label: 'الحصة', num: true, value: (r) => +((r.v / Math.max(totalCols, 1)) * 100).toFixed(1), cell: (r) => fmtPct((r.v / Math.max(totalCols, 1)) * 100) }]} />
            <ReportTable csv="collections-reps" rows={repRows.filter((r) => r.cols > 0)} cols={[{ label: 'المندوب', value: (r) => r.rep.name }, { label: 'المحصّل', num: true, value: (r) => r.cols, cell: (r) => money(r.cols) }, { label: 'الهدف الشهري', num: true, value: (r) => r.rep.collectionTarget, cell: (r) => money(r.rep.collectionTarget, { compact: true }) }]} />
          </>
        )}
        {report === 'stock' && (
          <>
            <div className="kpi-grid">
              <Stat label="قيمة المخزون" value={sum(stockValueByWh, (x) => x.value)} format={(n) => money(n, { compact: true })} color="#6d4aff" />
              <Stat label="أصناف تحت حد الطلب" value={lowStock.length} format={(n) => fmtNum(Math.round(n))} color="#f5b50a" />
              <Stat label="أصناف راكدة" value={slow.length} format={(n) => fmtNum(Math.round(n))} color="#ff6b5b" />
            </div>
            <ReportTable csv="stock-warehouses" rows={stockValueByWh} cols={[{ label: 'المخزن', value: (r) => r.w.name }, { label: 'الوحدات', num: true, value: (r) => r.units, cell: (r) => fmtNum(r.units) }, { label: 'القيمة', num: true, value: (r) => r.value, cell: (r) => money(r.value) }]} />
            <ReportTable csv="stock-low" rows={lowStock} cols={[{ label: 'أصناف تحتاج إعادة طلب', value: (r) => r.name, cell: (r) => <b>{r.emoji} {r.name}</b> }, { label: 'المتاح', num: true, value: (r) => stockTotal(r.id) }, { label: 'حد الطلب', num: true, value: (r) => r.minStock }, { label: 'العجز', num: true, value: (r) => Math.max(0, r.minStock * 2 - stockTotal(r.id)) }]} empty="كل الأصناف فوق حد الطلب 🎉" />
            <ReportTable csv="stock-slow" rows={slow} cols={[{ label: 'أصناف راكدة (بلا مبيعات في الفترة)', value: (r) => r.name, cell: (r) => <b>{r.emoji} {r.name}</b> }, { label: 'المتاح', num: true, value: (r) => stockTotal(r.id) }, { label: 'قيمة المخزون الراكد', num: true, value: (r) => stockTotal(r.id) * r.cost, cell: (r) => money(stockTotal(r.id) * r.cost) }]} empty="لا أصناف راكدة 🎉" />
          </>
        )}
      </motion.div>
    </div>
  );
}
