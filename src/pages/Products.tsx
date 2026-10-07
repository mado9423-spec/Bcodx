import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, Package, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ProductForm } from '../components/forms/ProductForm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/Fields';
import { EmptyState, PageHeader, Progress, rise, stagger } from '../components/ui/Misc';
import { useData } from '../data/DataContext';
import { PRICE_LIST_LABELS, type PriceList, type Product } from '../data/types';
import { colorFor } from '../lib/colors';
import { fmtNum, fmtPct } from '../lib/format';
import { can } from '../lib/permissions';
import { isOfferLive } from '../lib/pricing';

export default function Products() {
  const { products, stockTotal, offers, money } = useData();
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState<Product | undefined>();
  const [creating, setCreating] = useState(false);
  const role = profile!.role;
  const canEdit = can(role, 'products.edit');
  const now = Date.now();

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => (cat === 'all' || p.category === cat) && (!t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t))).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [products, q, cat]);
  const live = offers.filter((o) => isOfferLive(o, now));

  return (
    <>
      <PageHeader title="المنتجات" subtitle={`${fmtNum(products.length)} منتج في ${fmtNum(categories.length)} فئات`} actions={canEdit && <Button variant="primary" leading={<Plus size={18} />} onClick={() => setCreating(true)}>منتج جديد</Button>} />
      <div className="toolbar">
        <SearchInput className="grow" value={q} onChange={setQ} placeholder="ابحث بالاسم أو الرمز…" />
      </div>
      <div className="chips" style={{ marginBottom: '1.1rem' }}>
        <button className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>الكل ({products.length})</button>
        {categories.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c} ({products.filter((p) => p.category === c).length})</button>)}
      </div>
      {list.length === 0 ? (
        <div className="card"><EmptyState icon={<Package size={34} />} title="لا منتجات" text="أضف أول منتج لبدء البيع." action={canEdit ? { label: 'منتج جديد', onClick: () => setCreating(true) } : undefined} /></div>
      ) : (
        <motion.div className="prod-grid" variants={stagger} initial="hidden" animate="show" key={`${cat}-${q}`}>
          {list.map((p) => {
            const stock = stockTotal(p.id);
            const color = colorFor(p.category);
            const margin = p.prices.wholesale > 0 ? ((p.prices.wholesale - p.cost) / p.prices.wholesale) * 100 : 0;
            const out = stock <= 0;
            const low = !out && stock <= p.minStock;
            const hasOffer = live.some((o) => (o.productIds.length ? o.productIds.includes(p.id) : o.category === p.category) && o.type !== 'order_percent');
            return (
              <motion.article key={p.id} variants={rise} className={`card ${canEdit ? 'hover' : ''} prod-card`} onClick={() => canEdit && setEditing(p)} style={{ ['--pc' as string]: color, opacity: p.active ? 1 : 0.55 }}>
                <div className="prod-top">
                  <div className="prod-emoji">{p.emoji}</div>
                  <div className="grow">
                    <b style={{ display: 'block', lineHeight: 1.35 }}>{p.name}</b>
                    <span className="muted xs ltr">{p.sku}</span>
                  </div>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <Badge tone="violet">{p.category}</Badge>
                  {hasOffer && <Badge tone="green"><Gift size={12} /> عرض</Badge>}
                  {!p.active && <Badge>موقوف</Badge>}
                </div>
                <div className="price-row">
                  {(Object.keys(PRICE_LIST_LABELS) as PriceList[]).map((k) => (
                    <div key={k}><span className="muted xs">{PRICE_LIST_LABELS[k]}</span><b className="num">{money(p.prices[k], { symbol: false })}</b></div>
                  ))}
                </div>
                <div>
                  <div className="row between xs" style={{ marginBottom: 4 }}>
                    <span className="muted">المخزون الكلي</span>
                    <b style={{ color: out ? 'var(--bad)' : low ? 'var(--warn)' : 'var(--text)' }}>{out ? 'نافد' : `${fmtNum(stock)} ${p.unit}`}</b>
                  </div>
                  <Progress value={stock} max={Math.max(p.minStock * 3, 1)} size="thin" c1={out ? '#e5385f' : low ? '#f5b50a' : '#00b8a9'} c2={out ? '#ff6b5b' : low ? '#ff9a3c' : '#5eead4'} />
                </div>
                <div className="row between xs muted">
                  <span>التكلفة {money(p.cost)}</span>
                  <span style={{ color: margin < 10 ? 'var(--bad)' : 'var(--ok)', fontWeight: 700 }}>هامش {fmtPct(margin)}</span>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      )}
      <ProductForm open={creating || !!editing} onClose={() => { setCreating(false); setEditing(undefined); }} product={editing} />
    </>
  );
}
