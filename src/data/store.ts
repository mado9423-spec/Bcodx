import type { CollName, CollectionMap, Company } from './types';

/** قيمة تُضاف/تُطرح ذريًا من الحقل الرقمي (increment في Firestore) */
export interface Inc {
  readonly __inc: number;
}
/** قيمة تحذف الحقل */
export interface Del {
  readonly __del: true;
}
export const inc = (n: number): Inc => ({ __inc: n });
export const del = (): Del => ({ __del: true });
export const isInc = (v: unknown): v is Inc => typeof v === 'object' && v !== null && '__inc' in v;
export const isDel = (v: unknown): v is Del => typeof v === 'object' && v !== null && '__del' in v;

export type Patch = Record<string, unknown>;

export interface Query {
  where?: [field: string, value: unknown];
  orderBy?: [field: string, dir: 'asc' | 'desc'];
  limit?: number;
}

export interface WriteBatch {
  set<K extends CollName>(coll: K, id: string, data: CollectionMap[K]): void;
  /** دمج (ينشئ المستند إن لم يوجد) — يُستخدم للمخزون */
  merge(coll: CollName, id: string, patch: Patch): void;
  update(coll: CollName, id: string, patch: Patch): void;
  remove(coll: CollName, id: string): void;
  updateCompany(patch: Patch): void;
  commit(): Promise<void>;
}

export interface SyncState {
  /** توجد تغييرات محلية لم تصل للخادم بعد */
  pending: boolean;
}

export interface Store {
  readonly mode: 'demo' | 'firebase';
  readonly companyId: string;
  subscribe<K extends CollName>(
    coll: K,
    query: Query | undefined,
    cb: (rows: CollectionMap[K][]) => void,
    onError?: (e: unknown) => void,
  ): () => void;
  subscribeCompany(cb: (c: Company | null) => void, onError?: (e: unknown) => void): () => void;
  subscribeSync(cb: (s: SyncState) => void): () => void;
  batch(): WriteBatch;
}

export type Op =
  | { t: 'set'; coll: CollName; id: string; data: unknown }
  | { t: 'merge'; coll: CollName; id: string; patch: Patch }
  | { t: 'update'; coll: CollName; id: string; patch: Patch }
  | { t: 'remove'; coll: CollName; id: string }
  | { t: 'company'; patch: Patch };

/** مُجمِّع العمليات المشترك بين التنفيذين */
export class OpBuffer implements Omit<WriteBatch, 'commit'> {
  ops: Op[] = [];
  set<K extends CollName>(coll: K, id: string, data: CollectionMap[K]) {
    this.ops.push({ t: 'set', coll, id, data });
  }
  merge(coll: CollName, id: string, patch: Patch) {
    this.ops.push({ t: 'merge', coll, id, patch });
  }
  update(coll: CollName, id: string, patch: Patch) {
    this.ops.push({ t: 'update', coll, id, patch });
  }
  remove(coll: CollName, id: string) {
    this.ops.push({ t: 'remove', coll, id });
  }
  updateCompany(patch: Patch) {
    this.ops.push({ t: 'company', patch });
  }
}
