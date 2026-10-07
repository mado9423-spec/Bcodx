import type { Store } from './store';
import type { CollName } from './types';
import type { SeedData } from './seed';

const ORDER: CollName[] = [
  'zones', 'reps', 'warehouses', 'products', 'customers', 'offers', 'stock', 'orders', 'collections', 'visits', 'stockMovements',
];

/** يكتب بيانات العرض التجريبي في المخزن (Firestore: على دفعات داخليًا) */
export async function writeSeed(store: Store, data: SeedData): Promise<void> {
  const b = store.batch();
  for (const coll of ORDER) {
    for (const row of data[coll] as { id: string }[]) {
      (b.set as (c: CollName, id: string, d: unknown) => void)(coll, row.id, row);
    }
  }
  await b.commit();
}
