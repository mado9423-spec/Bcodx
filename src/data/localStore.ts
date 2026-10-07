import { OpBuffer, isDel, isInc, type Op, type Patch, type Query, type Store, type SyncState, type WriteBatch } from './store';
import type { CollName, CollectionMap, Company } from './types';

type Table = Map<string, Record<string, unknown>>;

export interface LocalSnapshot {
  company: Company;
  tables: Partial<Record<CollName, Record<string, unknown>[]>>;
}

const COLLS: CollName[] = [
  'customers', 'products', 'warehouses', 'stock', 'stockMovements', 'orders', 'collections', 'reps', 'zones', 'offers', 'visits',
];

function applyPatch(target: Record<string, unknown>, patch: Patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (isInc(v)) target[k] = (Number(target[k]) || 0) + v.__inc;
    else if (isDel(v) || v === undefined) delete target[k];
    else target[k] = v;
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** مخزن محلي (localStorage) لوضع العرض التجريبي — نفس واجهة Firestore */
export class LocalStore implements Store {
  readonly mode = 'demo' as const;
  readonly companyId: string;
  private tables = new Map<CollName, Table>();
  private company: Company;
  private listeners = new Map<CollName, Set<() => void>>();
  private companyListeners = new Set<() => void>();
  private storageKey: string;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(companyId: string, snapshot: LocalSnapshot) {
    this.companyId = companyId;
    this.storageKey = `bcodx:demo:${companyId}:v2`;
    this.company = snapshot.company;
    for (const c of COLLS) {
      const t: Table = new Map();
      for (const row of snapshot.tables[c] ?? []) t.set(String(row.id), clone(row));
      this.tables.set(c, t);
      this.listeners.set(c, new Set());
    }
  }

  static load(companyId: string): LocalSnapshot | null {
    try {
      const raw = localStorage.getItem(`bcodx:demo:${companyId}:v2`);
      return raw ? (JSON.parse(raw) as LocalSnapshot) : null;
    } catch {
      return null;
    }
  }

  static clear(companyId: string) {
    try {
      localStorage.removeItem(`bcodx:demo:${companyId}:v2`);
    } catch {
      /* التخزين غير متاح */
    }
  }

  private persist() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const tables: LocalSnapshot['tables'] = {};
      for (const [c, t] of this.tables) tables[c] = [...t.values()];
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({ company: this.company, tables }));
      } catch {
        /* الحصة ممتلئة أو التخزين محظور: نكمل بالذاكرة */
      }
    }, 150);
  }

  private read<K extends CollName>(coll: K, q?: Query): CollectionMap[K][] {
    let rows = [...this.tables.get(coll)!.values()] as unknown as Record<string, unknown>[];
    if (q?.where) rows = rows.filter((r) => r[q.where![0]] === q.where![1]);
    if (q?.orderBy) {
      const [f, dir] = q.orderBy;
      rows.sort((a, b) => ((Number(a[f]) || 0) - (Number(b[f]) || 0)) * (dir === 'desc' ? -1 : 1));
    }
    if (q?.limit) rows = rows.slice(0, q.limit);
    return clone(rows) as unknown as CollectionMap[K][];
  }

  subscribe<K extends CollName>(coll: K, query: Query | undefined, cb: (rows: CollectionMap[K][]) => void): () => void {
    const fire = () => cb(this.read(coll, query));
    this.listeners.get(coll)!.add(fire);
    queueMicrotask(fire);
    return () => this.listeners.get(coll)!.delete(fire);
  }

  subscribeCompany(cb: (c: Company | null) => void): () => void {
    const fire = () => cb(clone(this.company));
    this.companyListeners.add(fire);
    queueMicrotask(fire);
    return () => this.companyListeners.delete(fire);
  }

  subscribeSync(cb: (s: SyncState) => void): () => void {
    cb({ pending: false });
    return () => undefined;
  }

  batch(): WriteBatch {
    const buf = new OpBuffer();
    const commit = async () => this.apply(buf.ops);
    return Object.assign(buf, { commit }) as unknown as WriteBatch;
  }

  /** تطبيق ذرّي: عند أي خطأ (مثل نزول المخزون تحت الصفر) تُسترجع كل التغييرات */
  private apply(ops: Op[]) {
    const touched = new Set<CollName>();
    const undo: (() => void)[] = [];
    let companyTouched = false;
    try {
      for (const op of ops) {
        if (op.t === 'company') {
          const before = clone(this.company);
          undo.push(() => {
            this.company = before;
          });
          applyPatch(this.company as unknown as Record<string, unknown>, op.patch);
          companyTouched = true;
          continue;
        }
        const table = this.tables.get(op.coll)!;
        const prev = table.has(op.id) ? clone(table.get(op.id)!) : undefined;
        undo.push(() => (prev ? table.set(op.id, prev) : table.delete(op.id)));
        touched.add(op.coll);
        if (op.t === 'set') table.set(op.id, { ...clone(op.data as object), id: op.id });
        else if (op.t === 'remove') table.delete(op.id);
        else if (op.t === 'merge') {
          const cur = table.get(op.id) ?? { id: op.id };
          applyPatch(cur, op.patch);
          table.set(op.id, cur);
        } else {
          const cur = table.get(op.id);
          if (!cur) throw new Error(`المستند غير موجود: ${op.coll}/${op.id}`);
          applyPatch(cur, op.patch);
        }
      }
      // نفس ما تفرضه قواعد Firestore: لا مخزون سالب
      if (touched.has('stock')) {
        for (const row of this.tables.get('stock')!.values()) {
          if ((Number(row.qty) || 0) < 0) throw new Error('الكمية المتاحة في المخزن غير كافية');
        }
      }
    } catch (e) {
      for (const fn of undo.reverse()) fn();
      throw e;
    }
    for (const c of touched) for (const fn of this.listeners.get(c)!) fn();
    if (companyTouched) for (const fn of this.companyListeners) fn();
    this.persist();
  }
}
