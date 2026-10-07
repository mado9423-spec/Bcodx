import {
  collection, deleteDoc, deleteField, doc, increment, limit as qLimit, onSnapshot, orderBy as qOrderBy, query as qQuery,
  setDoc, updateDoc, where as qWhere, writeBatch as fsBatch, type DocumentData, type Query as FsQuery,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { OpBuffer, isDel, isInc, type Op, type Patch, type Query, type Store, type SyncState, type WriteBatch } from './store';
import type { CollName, CollectionMap, Company } from './types';

const MAX_OPS = 450;

function convertPatch(patch: Patch): DocumentData {
  const out: DocumentData = {};
  for (const [k, v] of Object.entries(patch)) {
    if (isInc(v)) out[k] = increment(v.__inc);
    else if (isDel(v)) out[k] = deleteField();
    else out[k] = v;
  }
  return out;
}

/** مخزن Firestore: بيانات كل شركة تحت companies/{companyId}/... */
export class FirestoreStore implements Store {
  readonly mode = 'firebase' as const;
  readonly companyId: string;
  private pendingFlags = new Map<string, boolean>();
  private syncListeners = new Set<(s: SyncState) => void>();

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  private path(coll: CollName) {
    return collection(getDb(), 'companies', this.companyId, coll);
  }

  private setPending(key: string, v: boolean) {
    if (this.pendingFlags.get(key) === v) return;
    this.pendingFlags.set(key, v);
    const pending = [...this.pendingFlags.values()].some(Boolean);
    for (const fn of this.syncListeners) fn({ pending });
  }

  subscribe<K extends CollName>(
    coll: K,
    query: Query | undefined,
    cb: (rows: CollectionMap[K][]) => void,
    onError?: (e: unknown) => void,
  ): () => void {
    const constraints = [];
    if (query?.where) constraints.push(qWhere(query.where[0], '==', query.where[1]));
    if (query?.orderBy) constraints.push(qOrderBy(query.orderBy[0], query.orderBy[1]));
    if (query?.limit) constraints.push(qLimit(query.limit));
    const q: FsQuery = constraints.length ? qQuery(this.path(coll), ...constraints) : this.path(coll);
    let first = true;
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        this.setPending(coll, snap.metadata.hasPendingWrites);
        // تغيّر الـ metadata فقط (مثل انتقال من الكاش للخادم) لا يستدعي إعادة رسم
        if (!first && snap.docChanges().length === 0) return;
        first = false;
        cb(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as unknown as CollectionMap[K][]);
      },
      (e) => onError?.(e),
    );
  }

  subscribeCompany(cb: (c: Company | null) => void, onError?: (e: unknown) => void): () => void {
    return onSnapshot(
      doc(getDb(), 'companies', this.companyId),
      (snap) => cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as Company) : null),
      (e) => onError?.(e),
    );
  }

  subscribeSync(cb: (s: SyncState) => void): () => void {
    this.syncListeners.add(cb);
    cb({ pending: [...this.pendingFlags.values()].some(Boolean) });
    return () => this.syncListeners.delete(cb);
  }

  batch(): WriteBatch {
    const buf = new OpBuffer();
    const commit = async () => {
      const db = getDb();
      const ref = (coll: CollName, id: string) => doc(db, 'companies', this.companyId, coll, id);
      // أقل من 450 عملية = ذرّي بالكامل؛ الأكبر (مثل بذر البيانات) يُقسَّم على دفعات
      for (let i = 0; i < buf.ops.length; i += MAX_OPS) {
        const b = fsBatch(db);
        for (const op of buf.ops.slice(i, i + MAX_OPS) as Op[]) {
          if (op.t === 'set') b.set(ref(op.coll, op.id), { ...(op.data as DocumentData), id: op.id });
          else if (op.t === 'merge') b.set(ref(op.coll, op.id), convertPatch(op.patch), { merge: true });
          else if (op.t === 'update') b.update(ref(op.coll, op.id), convertPatch(op.patch));
          else if (op.t === 'remove') b.delete(ref(op.coll, op.id));
          else b.update(doc(db, 'companies', this.companyId), convertPatch(op.patch));
        }
        await b.commit();
      }
    };
    return Object.assign(buf, { commit }) as unknown as WriteBatch;
  }
}

// دوال مساعدة منفردة تُستخدم من طبقة المصادقة/الفريق
export const fsDoc = (...segments: string[]) => doc(getDb(), segments[0]!, ...segments.slice(1));
export { setDoc, updateDoc, deleteDoc };
