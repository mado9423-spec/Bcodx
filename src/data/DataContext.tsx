import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { agingByCustomer, type Aging } from '../lib/aging';
import type { Store, SyncState } from './store';
import type {
  Collection, Company, Customer, Offer, Order, Product, Rep, StockItem, StockMovement, Visit, Warehouse, Zone,
} from './types';
import { makeMoney, type MoneyFn } from '../lib/format';
import { CURRENCIES } from './types';

interface DataValue {
  store: Store;
  ready: boolean;
  error: string | null;
  company: Company;
  money: MoneyFn;
  /** رمز عملة الشركة (مثل ر.س) */
  currencySymbol: string;
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  stock: StockItem[];
  movements: StockMovement[];
  orders: Order[];
  collections: Collection[];
  reps: Rep[];
  zones: Zone[];
  offers: Offer[];
  visits: Visit[];
  customerById: Map<string, Customer>;
  productById: Map<string, Product>;
  zoneById: Map<string, Zone>;
  repById: Map<string, Rep>;
  warehouseById: Map<string, Warehouse>;
  orderById: Map<string, Order>;
  stockQty: (warehouseId: string, productId: string) => number;
  stockTotal: (productId: string) => number;
  aging: Map<string, Aging>;
  sync: SyncState & { online: boolean };
}

const Ctx = createContext<DataValue | null>(null);

export function useData(): DataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside <DataProvider>');
  return v;
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

const LIMITS = { orders: 1500, collections: 1500, visits: 800, movements: 400 };

export function DataProvider({ store, scopeRepId, children }: { store: Store; scopeRepId?: string; children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    const mark = (k: string) => setLoaded((s) => (s.has(k) ? s : new Set(s).add(k)));
    const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
    const scope: [string, unknown] | undefined = scopeRepId ? ['repId', scopeRepId] : undefined;
    const newest = (limit: number) => ({ where: scope, orderBy: ['createdAt', 'desc'] as ['createdAt', 'desc'], limit });
    const subs = [
      store.subscribeCompany((c) => {
        setCompany(c);
        mark('company');
      }, fail),
      store.subscribe('customers', undefined, (r) => (setCustomers(r), mark('customers')), fail),
      store.subscribe('products', undefined, (r) => (setProducts(r), mark('products')), fail),
      store.subscribe('warehouses', undefined, (r) => (setWarehouses(r), mark('warehouses')), fail),
      store.subscribe('stock', undefined, (r) => (setStock(r), mark('stock')), fail),
      store.subscribe('stockMovements', { orderBy: ['createdAt', 'desc'], limit: LIMITS.movements }, (r) => (setMovements(r), mark('mov')), fail),
      store.subscribe('orders', newest(LIMITS.orders), (r) => (setOrders(r), mark('orders')), fail),
      store.subscribe('collections', newest(LIMITS.collections), (r) => (setCollections(r), mark('collections')), fail),
      store.subscribe('reps', undefined, (r) => (setReps(r), mark('reps')), fail),
      store.subscribe('zones', undefined, (r) => (setZones(r), mark('zones')), fail),
      store.subscribe('offers', undefined, (r) => (setOffers(r), mark('offers')), fail),
      store.subscribe('visits', newest(LIMITS.visits), (r) => (setVisits(r), mark('visits')), fail),
      store.subscribeSync((s) => setPending(s.pending)),
    ];
    return () => subs.forEach((u) => u());
  }, [store, scopeRepId]);

  const ready = loaded.size >= 12;

  const value = useMemo<DataValue | null>(() => {
    if (!company) return null;
    const stockMap = new Map(stock.map((s) => [s.id, s.qty]));
    const totals = new Map<string, number>();
    for (const s of stock) totals.set(s.productId, (totals.get(s.productId) ?? 0) + s.qty);
    return {
      store, ready, error, company, money: makeMoney(company.currency), currencySymbol: CURRENCIES[company.currency].symbol, customers, products, warehouses, stock, movements, orders,
      collections, reps, zones, offers, visits,
      customerById: byId(customers), productById: byId(products), zoneById: byId(zones), repById: byId(reps),
      warehouseById: byId(warehouses), orderById: byId(orders),
      stockQty: (w, p) => stockMap.get(`${w}_${p}`) ?? 0,
      stockTotal: (p) => totals.get(p) ?? 0,
      aging: agingByCustomer(customers, orders, collections, Date.now()),
      sync: { pending, online },
    };
  }, [store, ready, error, company, customers, products, warehouses, stock, movements, orders, collections, reps, zones, offers, visits, pending, online]);

  if (error && (!value || !ready)) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <h2>تعذّر تحميل البيانات</h2>
          <p className="muted">{error}</p>
          <p className="muted small">تحقق من قواعد Firestore وصلاحيات المستخدم، ثم أعد تحميل الصفحة.</p>
        </div>
      </div>
    );
  }
  if (!value || !ready) return <BootScreen />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function BootScreen({ label = 'جارٍ تجهيز بياناتك…' }: { label?: string }) {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <div className="boot-truck" aria-hidden>
        <svg viewBox="0 0 120 70" width="120" height="70">
          <rect x="6" y="14" width="64" height="38" rx="6" fill="var(--brand)" />
          <path d="M70 26h20a8 8 0 0 1 6.4 3.2L108 42v10H70z" fill="var(--c-teal)" />
          <circle cx="30" cy="54" r="9" fill="#1e1b4b" />
          <circle cx="30" cy="54" r="3.5" fill="#fff" />
          <circle cx="88" cy="54" r="9" fill="#1e1b4b" />
          <circle cx="88" cy="54" r="3.5" fill="#fff" />
        </svg>
        <div className="boot-road" />
      </div>
      <p>{label}</p>
    </div>
  );
}
