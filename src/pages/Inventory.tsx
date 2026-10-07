import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Boxes, ClipboardCheck, PackagePlus, Plus, Truck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { AdjustModal, ReceiveModal, TransferModal, WarehouseModal } from '../components/forms/StockModals';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CountUp } from '../components/ui/CountUp';
import { SearchInput, Segmented, Tabs } from '../components/ui/Fields';
import { EmptyState, PageHeader, Progress, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { MOVEMENT_LABELS, WAREHOUSE_TYPE_LABELS, type Product, type Warehouse } from '../data/types';
import { fmtAgo, fmtNum } from '../lib/format';
import { can } from '../lib/permissions';

type Filter = 'all' | 'low' | 'out';

export default function Inventory() {
  const { products, warehouses, stock, stockQty, stockTotal, movements, productById, warehouseById, money, repById } = useData();
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const role = profile!.role;
  const canEdit = can(role, 'inventory.edit');
  const [view, setView] = useState<'stock' | 'moves'>('stock');
  const [wh, setWh] = useState<string>('all');
  const [filter, setFilter] = useState<Filter>(params.get('filter') === 'low' ? 'low' : 'all');
  const [q, setQ] = useState('');
  const [receive, setReceive] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [newWh, setNewWh] = useState(false);
  const [adjust, setAdjust] = useState<{ w: Warehouse; p: Product } | null>(null);

  const qtyOf = (p: Product) => (wh === 'all' ? stockTotal(p.id) : stockQty(wh, p.id));
  const stats = useMemo(() => {
    const active = products.filter((p) => p.active);
    const value = stock.reduce((s, it) => s + it.qty * (productById.get(it.productId)?.cost ?? 0), 0);
    const low = active.filter((p) => stockTotal(p.id) <= p.minStock && stockTotal(p.id) > 0).length;
    const out = active.filter((p) => stockTotal(p.id) <= 0).length;
    return { value, low, out, units: stock.reduce((s, it) => s + it.qty, 0) };
  }, [products, stock, stockTotal, productById]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products
      .filter((p) => p.active && (!t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)))
      .filter((p) => {
        const n = qtyOf(p);
        return filter === 'all' || (filter === 'out' ? n <= 0 : n > 0 && n <= p.minStock) || (filter === 'low' && n <= 0);
      })
      .sort((a, b) => qtyOf(a) - qtyOf(b) || a.name.localeCompare(b.name, 'ar'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, q, filter, wh, stock]);

  const selectedWh = wh === 'all' ? undefined : warehouseById.get(wh);

  return (
    <>
      <PageHeader
        title="المخازن والمخزون"
        subtitle={`${fmtNum(warehouses.length)} مخازن • ${fmtNum(stats.units)} وحدة`}
        actions={
          canEdit && (
            <>
              <Button leading={<Plus size={16} />} onClick={() => setNewWh(true)}>مخزن</Button>
              <Button leading={<ArrowLeftRight size={16} />} onClick={() => setTransfer(true)}>تحويل</Button>
              <Button variant="primary" leading={<PackagePlus size={18} />} onClick={() => setReceive(true)}>استلام بضاعة</Button>
            </>
          )
        }
      />
      <motion.div className="kpi-grid" variants={stagger} initial="hidden" animate="show" style={{ marginBottom: '1.25rem' }}>
        <motion.div variants={rise} className="card kpi" style={{ ['--k' as string]: '#6d4aff' }}><div className="kpi-top"><span className="kpi-ico"><Boxes size={20} /></span></div><div className="kpi-label">قيمة المخزون (بالتكلفة)</div><div className="kpi-value"><CountUp value={stats.value} format={(n) => money(n, { compact: true })} /></div></motion.div>
        <motion.div variants={rise} className="card kpi" style={{ ['--k' as string]: '#f5b50a' }}><div className="kpi-top"><span className="kpi-ico"><ClipboardCheck size={20} /></span></div><div className="kpi-label">أصناف منخفضة</div><div className="kpi-value"><CountUp value={stats.low} /></div></motion.div>
        <motion.div variants={rise} className="card kpi" style={{ ['--k' as string]: '#e5385f' }}><div className="kpi-top"><span className="kpi-ico"><Boxes size={20} /></span></div><div className="kpi-label">أصناف نافدة</div><div className="kpi-value"><CountUp value={stats.out} /></div></motion.div>
        <motion.div variants={rise} className="card kpi" style={{ ['--k' as string]: '#00b8a9' }}><div className="kpi-top"><span className="kpi-ico"><Truck size={20} /></span></div><div className="kpi-label">مخازن السيارات</div><div className="kpi-value"><CountUp value={warehouses.filter((w) => w.type === 'van').length} /></div></motion.div>
      </motion.div>

      <Tabs name="inv-view" value={view} onChange={setView} options={[{ value: 'stock', label: 'أرصدة المخزون' }, { value: 'moves', label: 'حركات المخزون', count: movements.length }]} />
      <div style={{ height: '1rem' }} />

      {view === 'stock' ? (
        <>
          <div className="toolbar">
            <SearchInput className="grow" value={q} onChange={setQ} placeholder="ابحث عن صنف…" />
            <Segmented name="inv-filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'الكل' }, { value: 'low', label: 'منخفض' }, { value: 'out', label: 'نافد' }]} />
          </div>
          <div className="chips" style={{ marginBottom: '1rem' }}>
            <button className="chip" aria-pressed={wh === 'all'} onClick={() => setWh('all')}>كل المخازن</button>
            {warehouses.map((w) => <button key={w.id} className="chip" aria-pressed={wh === w.id} onClick={() => setWh(w.id)}>{w.type === 'van' ? '🚚' : '🏬'} {w.name}</button>)}
          </div>
          <div className="card">
            {list.length === 0 ? <EmptyState icon="✅" title="لا أصناف ضمن هذا الفلتر" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>الصنف</th><th className="num">الكمية</th><th className="hide-mobile">مستوى المخزون</th><th className="hide-mobile num">القيمة</th><th>الحالة</th>{canEdit && selectedWh && <th />}</tr></thead>
                  <tbody>
                    {list.map((p) => {
                      const n = qtyOf(p);
                      const out = n <= 0;
                      const low = !out && n <= p.minStock;
                      return (
                        <tr key={p.id}>
                          <td><span className="row" style={{ gap: 10 }}><span style={{ fontSize: '1.5rem' }}>{p.emoji}</span><span><b>{p.name}</b><div className="muted xs">{p.category} • حد الطلب {fmtNum(p.minStock)}</div></span></span></td>
                          <td className="num bold">{fmtNum(n)} <span className="muted xs">{p.unit}</span></td>
                          <td className="hide-mobile" style={{ minWidth: 160 }}><Progress value={n} max={Math.max(p.minStock * 3, 1)} size="thin" c1={out ? '#e5385f' : low ? '#f5b50a' : '#00b8a9'} c2={out ? '#ff6b5b' : low ? '#ff9a3c' : '#5eead4'} /></td>
                          <td className="hide-mobile num">{money(n * p.cost, { compact: true })}</td>
                          <td>{out ? <Badge tone="red" dot>نافد</Badge> : low ? <Badge tone="amber" dot>منخفض</Badge> : <Badge tone="green" dot>جيد</Badge>}</td>
                          {canEdit && selectedWh && <td><Button size="sm" variant="ghost" onClick={() => setAdjust({ w: selectedWh, p })}>تسوية</Button></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {wh === 'all' && (
            <div className="wh-grid">
              {warehouses.map((w) => {
                const items = stock.filter((s) => s.warehouseId === w.id);
                const units = items.reduce((s, i) => s + i.qty, 0);
                const value = items.reduce((s, i) => s + i.qty * (productById.get(i.productId)?.cost ?? 0), 0);
                return (
                  <motion.button key={w.id} className="card hover wh-card" onClick={() => setWh(w.id)} whileTap={{ scale: 0.98 }}>
                    <span className="wh-ico">{w.type === 'van' ? '🚚' : w.type === 'main' ? '🏭' : '🏬'}</span>
                    <b>{w.name}</b>
                    <span className="muted xs">{WAREHOUSE_TYPE_LABELS[w.type]}{w.repId ? ` • ${repById.get(w.repId)?.name ?? ''}` : ''}</span>
                    <div className="row between small"><span>{fmtNum(units)} وحدة</span><b>{money(value, { compact: true })}</b></div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="card">
          {movements.length === 0 ? <EmptyState icon="📜" title="لا حركات" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>الصنف</th><th>المخزن</th><th>النوع</th><th className="num">الكمية</th><th className="hide-mobile">بواسطة</th><th>الوقت</th></tr></thead>
                <tbody>
                  {movements.slice(0, 150).map((m) => (
                    <tr key={m.id}>
                      <td><b>{productById.get(m.productId)?.emoji} {productById.get(m.productId)?.name ?? '—'}</b></td>
                      <td>{warehouseById.get(m.warehouseId)?.name ?? '—'}</td>
                      <td><Badge tone={m.qty > 0 ? 'green' : 'orange'}>{MOVEMENT_LABELS[m.type]}</Badge></td>
                      <td className="num bold" style={{ color: m.qty > 0 ? 'var(--ok)' : 'var(--bad)' }}>{m.qty > 0 ? '+' : ''}{fmtNum(m.qty)}</td>
                      <td className="hide-mobile">{m.byName}</td>
                      <td className="muted small">{fmtAgo(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <ReceiveModal open={receive} onClose={() => setReceive(false)} defaultWarehouse={wh} />
      <TransferModal open={transfer} onClose={() => setTransfer(false)} defaultFrom={wh} />
      <WarehouseModal open={newWh} onClose={() => setNewWh(false)} />
      <AdjustModal open={!!adjust} onClose={() => setAdjust(null)} warehouse={adjust?.w} product={adjust?.p} />
    </>
  );
}
