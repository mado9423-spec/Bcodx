import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
const A = 'compA';
const B = 'compB';

type Role = 'owner' | 'manager' | 'rep' | 'storekeeper' | 'accountant';

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-bhub-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (uid: string, role: Role, companyId = A, repId?: string) =>
      setDoc(doc(db, 'users', uid), { uid, name: uid, email: `${uid}@x.com`, role, companyId, ...(repId ? { repId } : {}), createdAt: 1 });
    await setDoc(doc(db, 'companies', A), { id: A, name: 'A', ownerUid: 'owner', currency: 'SAR' });
    await setDoc(doc(db, 'companies', B), { id: B, name: 'B', ownerUid: 'ownerB', currency: 'SAR' });
    await user('owner', 'owner');
    await user('manager', 'manager');
    await user('rep1', 'rep', A, 'r1');
    await user('rep2', 'rep', A, 'r2');
    await user('store', 'storekeeper');
    await user('acct', 'accountant');
    await user('ownerB', 'owner', B);
    await setDoc(doc(db, 'companies', A, 'customers', 'c1'), { id: 'c1', name: 'عميل', balance: 100, creditLimit: 1000, repId: 'r1', zoneId: 'z1', active: true });
    await setDoc(doc(db, 'companies', A, 'orders', 'o1'), { id: 'o1', repId: 'r1', total: 10, status: 'new' });
    await setDoc(doc(db, 'companies', A, 'orders', 'o2'), { id: 'o2', repId: 'r2', total: 20, status: 'new' });
    await setDoc(doc(db, 'companies', A, 'collections', 'k1'), { id: 'k1', repId: 'r1', amount: 5, status: 'active', customerId: 'c1' });
    await setDoc(doc(db, 'companies', A, 'stock', 'w_p'), { warehouseId: 'w', productId: 'p', qty: 10 });
    await setDoc(doc(db, 'companies', B, 'customers', 'cB'), { id: 'cB', name: 'سرّي', balance: 1 });
  });
});

const as = (uid: string, email = `${uid}@x.com`, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

describe('العزل بين الشركات', () => {
  it('مستخدم الشركة A لا يقرأ ولا يكتب في الشركة B', async () => {
    const db = as('owner');
    await assertFails(getDoc(doc(db, 'companies', B, 'customers', 'cB')));
    await assertFails(setDoc(doc(db, 'companies', B, 'customers', 'x'), { name: 'x', balance: 0, creditLimit: 0 }));
    await assertFails(getDoc(doc(db, 'companies', B)));
  });
  it('غير المسجّل لا يصل إلى أي شيء', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'companies', A, 'customers', 'c1')));
    await assertFails(getDoc(doc(db, 'companies', A)));
  });
  it('مستخدم بلا ملف شخصي لا يصل إلى بيانات أي شركة', async () => {
    await assertFails(getDoc(doc(as('stranger'), 'companies', A, 'customers', 'c1')));
  });
});

describe('تسجيل شركة جديدة (owner bootstrap)', () => {
  it('ينشئ المستخدم شركته وملفه كمالك في دفعة واحدة', async () => {
    const db = as('newbie');
    const b = writeBatch(db);
    b.set(doc(db, 'companies', 'cNew'), { id: 'cNew', name: 'جديدة', ownerUid: 'newbie' });
    b.set(doc(db, 'users', 'newbie'), { uid: 'newbie', name: 'n', email: 'newbie@x.com', role: 'owner', companyId: 'cNew', createdAt: 1 });
    await assertSucceeds(b.commit());
    await assertSucceeds(setDoc(doc(db, 'companies', 'cNew', 'customers', 'c'), { name: 'x', balance: 0, creditLimit: 0 }));
  });
  it('لا يستطيع الاستيلاء على شركة موجودة', async () => {
    const db = as('thief');
    const b = writeBatch(db);
    b.set(doc(db, 'users', 'thief'), { uid: 'thief', name: 't', email: 'thief@x.com', role: 'owner', companyId: A, createdAt: 1 });
    await assertFails(b.commit());
  });
  it('لا يستطيع إنشاء ملف شخصي منفرد بدور مالك لشركة وهمية', async () => {
    const db = as('ghost');
    await assertFails(setDoc(doc(db, 'users', 'ghost'), { uid: 'ghost', name: 'g', email: 'ghost@x.com', role: 'owner', companyId: 'nope', createdAt: 1 }));
  });
  it('لا يمكن تسجيل شركة بمالك مختلف عن المستخدم', async () => {
    await assertFails(setDoc(doc(as('x1'), 'companies', 'cX'), { id: 'cX', name: 'x', ownerUid: 'someoneElse' }));
  });
});

describe('الدعوات وانضمام الموظفين', () => {
  const invite = { email: 'new@x.com', companyId: A, role: 'rep', repId: 'r1', name: 'جديد', createdAt: 1 };
  it('المدير فقط ينشئ دعوة، ولا يدعو مالكًا', async () => {
    await assertSucceeds(setDoc(doc(as('manager'), 'invites', 'new@x.com'), invite));
    await assertFails(setDoc(doc(as('rep1'), 'invites', 'a@x.com'), { ...invite, email: 'a@x.com' }));
    await assertFails(setDoc(doc(as('manager'), 'invites', 'o@x.com'), { ...invite, email: 'o@x.com', role: 'owner' }));
    await assertFails(setDoc(doc(as('manager'), 'invites', 'other@x.com'), { ...invite, email: 'new@x.com' })); // مفتاح لا يطابق البريد
  });
  it('الموظف المفعَّل بريده ينضم بالدور المدعو به فقط', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'invites', 'new@x.com'), invite));
    const db = as('newuid', 'new@x.com', true);
    const prof = { uid: 'newuid', name: 'جديد', email: 'new@x.com', role: 'rep', companyId: A, repId: 'r1', createdAt: 1 };
    await assertFails(setDoc(doc(db, 'users', 'newuid'), { ...prof, role: 'manager' }));
    await assertFails(setDoc(doc(db, 'users', 'newuid'), { ...prof, companyId: B }));
    await assertFails(setDoc(doc(db, 'users', 'newuid'), { ...prof, repId: 'r2' }));
    const b = writeBatch(db);
    b.set(doc(db, 'users', 'newuid'), prof);
    b.delete(doc(db, 'invites', 'new@x.com'));
    await assertSucceeds(b.commit());
  });
  it('بريد غير مفعَّل لا ينضم (حماية من انتحال البريد)', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'invites', 'new@x.com'), invite));
    await assertFails(setDoc(doc(as('u9', 'new@x.com', false), 'users', 'u9'), { uid: 'u9', name: 'x', email: 'new@x.com', role: 'rep', companyId: A, repId: 'r1', createdAt: 1 }));
  });
  it('لا انضمام بلا دعوة', async () => {
    await assertFails(setDoc(doc(as('u8', 'nobody@x.com'), 'users', 'u8'), { uid: 'u8', name: 'x', email: 'nobody@x.com', role: 'rep', companyId: A, createdAt: 1 }));
  });
  it('لا يقرأ أحد دعوة غيره', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'invites', 'new@x.com'), invite));
    await assertFails(getDoc(doc(as('rep2'), 'invites', 'new@x.com')));
    await assertSucceeds(getDoc(doc(as('u7', 'new@x.com'), 'invites', 'new@x.com')));
  });
});

describe('المستخدمون والأدوار', () => {
  it('لا يرفع المستخدم دوره بنفسه', async () => {
    await assertFails(updateDoc(doc(as('rep1'), 'users', 'rep1'), { role: 'owner' }));
    await assertFails(updateDoc(doc(as('manager'), 'users', 'manager'), { role: 'owner' }));
    await assertSucceeds(updateDoc(doc(as('rep1'), 'users', 'rep1'), { name: 'اسم جديد' }));
  });
  it('المالك يغيّر دور موظف في شركته لكن لا يجعله مالكًا', async () => {
    await assertSucceeds(updateDoc(doc(as('owner'), 'users', 'store'), { role: 'accountant' }));
    await assertFails(updateDoc(doc(as('owner'), 'users', 'store'), { role: 'owner' }));
    await assertFails(updateDoc(doc(as('manager'), 'users', 'store'), { role: 'manager' }));
    await assertFails(updateDoc(doc(as('owner'), 'users', 'ownerB'), { role: 'rep' }));
  });
  it('المدير يسرد أعضاء شركته فقط', async () => {
    await assertSucceeds(getDocs(query(collection(as('manager'), 'users'), where('companyId', '==', A))));
    await assertFails(getDocs(query(collection(as('manager'), 'users'), where('companyId', '==', B))));
    await assertFails(getDocs(query(collection(as('rep1'), 'users'), where('companyId', '==', A))));
  });
});

describe('صلاحيات المندوب', () => {
  it('يقرأ طلباته فقط', async () => {
    const db = as('rep1');
    await assertSucceeds(getDoc(doc(db, 'companies', A, 'orders', 'o1')));
    await assertFails(getDoc(doc(db, 'companies', A, 'orders', 'o2')));
    await assertSucceeds(getDocs(query(collection(db, 'companies', A, 'orders'), where('repId', '==', 'r1'))));
    await assertFails(getDocs(collection(db, 'companies', A, 'orders')));
  });
  it('ينشئ طلبًا باسمه فقط', async () => {
    const db = as('rep1');
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'orders', 'n1'), { repId: 'r1', total: 5 }));
    await assertFails(setDoc(doc(db, 'companies', A, 'orders', 'n2'), { repId: 'r2', total: 5 }));
  });
  it('لا يعدّل حالة الطلب ولا يحذفه', async () => {
    await assertFails(updateDoc(doc(as('rep1'), 'companies', A, 'orders', 'o1'), { status: 'delivered' }));
    await assertFails(deleteDoc(doc(as('rep1'), 'companies', A, 'orders', 'o1')));
  });
  it('لا يُنشئ منتجات ولا عروضًا ولا مناطق ولا مندوبين', async () => {
    const db = as('rep1');
    await assertFails(setDoc(doc(db, 'companies', A, 'products', 'p'), { name: 'x' }));
    await assertFails(setDoc(doc(db, 'companies', A, 'offers', 'o'), { name: 'x' }));
    await assertFails(setDoc(doc(db, 'companies', A, 'zones', 'z'), { name: 'x' }));
    await assertFails(setDoc(doc(db, 'companies', A, 'reps', 'r'), { name: 'x' }));
  });
  it('يحدّث رصيد العميل لكن لا يغيّر حده الائتماني', async () => {
    const db = as('rep1');
    await assertSucceeds(updateDoc(doc(db, 'companies', A, 'customers', 'c1'), { balance: 150, lastOrderAt: 5 }));
    await assertFails(updateDoc(doc(db, 'companies', A, 'customers', 'c1'), { creditLimit: 999999 }));
    await assertFails(updateDoc(doc(db, 'companies', A, 'customers', 'c1'), { priceList: 'wholesale', repId: 'r2' }));
  });
  it('العميل الجديد من المندوب بحد ائتماني صفر فقط', async () => {
    const db = as('rep1');
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'customers', 'n1'), { name: 'جديد', balance: 0, creditLimit: 0 }));
    await assertFails(setDoc(doc(db, 'companies', A, 'customers', 'n2'), { name: 'جديد', balance: 0, creditLimit: 50000 }));
    await assertFails(setDoc(doc(db, 'companies', A, 'customers', 'n3'), { name: 'جديد', balance: 500, creditLimit: 0 }));
  });
  it('ينشئ تحصيلًا باسمه فقط ولا يلغيه', async () => {
    const db = as('rep1');
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'collections', 'n1'), { repId: 'r1', amount: 5, status: 'active' }));
    await assertFails(setDoc(doc(db, 'companies', A, 'collections', 'n2'), { repId: 'r2', amount: 5, status: 'active' }));
    await assertFails(updateDoc(doc(db, 'companies', A, 'collections', 'k1'), { status: 'void' }));
  });
});

describe('المخزون', () => {
  it('لا كميات سالبة، ولا حذف للأرصدة', async () => {
    const db = as('store');
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'stock', 'w_p'), { warehouseId: 'w', productId: 'p', qty: 3 }));
    await assertFails(setDoc(doc(db, 'companies', A, 'stock', 'w_p'), { warehouseId: 'w', productId: 'p', qty: -1 }));
    await assertFails(deleteDoc(doc(db, 'companies', A, 'stock', 'w_p')));
  });
  it('المحاسب لا يعدّل المخزون', async () => {
    await assertFails(setDoc(doc(as('acct'), 'companies', A, 'stock', 'w_p'), { warehouseId: 'w', productId: 'p', qty: 1 }));
  });
  it('سجل الحركات إضافة فقط', async () => {
    const db = as('store');
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'stockMovements', 'm1'), { qty: 1, type: 'receive' }));
    await assertFails(updateDoc(doc(db, 'companies', A, 'stockMovements', 'm1'), { qty: 99 }));
    await assertFails(deleteDoc(doc(db, 'companies', A, 'stockMovements', 'm1')));
  });
});

describe('المحاسبة والإدارة', () => {
  it('المحاسب ينشئ تحصيلًا ويلغيه (الحالة فقط) لكن لا ينشئ طلبًا', async () => {
    const db = as('acct');
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'collections', 'n1'), { repId: 'r1', amount: 5, status: 'active' }));
    await assertSucceeds(updateDoc(doc(db, 'companies', A, 'collections', 'k1'), { status: 'void' }));
    await assertFails(updateDoc(doc(db, 'companies', A, 'collections', 'k1'), { amount: 1 }));
    await assertFails(setDoc(doc(db, 'companies', A, 'orders', 'n'), { repId: 'r1', total: 1 }));
  });
  it('المخزني يغيّر حالة الطلب ويحدّث الرصيد فقط من العميل', async () => {
    const db = as('store');
    await assertSucceeds(updateDoc(doc(db, 'companies', A, 'orders', 'o1'), { status: 'preparing' }));
    await assertSucceeds(updateDoc(doc(db, 'companies', A, 'customers', 'c1'), { balance: 50 }));
    await assertFails(updateDoc(doc(db, 'companies', A, 'customers', 'c1'), { name: 'تغيير' }));
  });
  it('المدير يدير العروض والمناطق والمندوبين والمنتجات', async () => {
    const db = as('manager');
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'offers', 'o'), { name: 'x' }));
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'zones', 'z'), { name: 'x' }));
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'reps', 'r'), { name: 'x' }));
    await assertSucceeds(setDoc(doc(db, 'companies', A, 'products', 'p'), { name: 'x' }));
    await assertSucceeds(updateDoc(doc(db, 'companies', A), { name: 'اسم جديد' }));
    await assertFails(updateDoc(doc(db, 'companies', A), { ownerUid: 'manager' }));
  });
  it('لا يُحذف الطلب ولا الشركة أبدًا', async () => {
    await assertFails(deleteDoc(doc(as('owner'), 'companies', A, 'orders', 'o1')));
    await assertFails(deleteDoc(doc(as('owner'), 'companies', A)));
  });
  it('مسارات غير معرّفة مرفوضة', async () => {
    await assertFails(setDoc(doc(as('owner'), 'companies', A, 'secrets', 's'), { x: 1 }));
    await assertFails(getDoc(doc(as('owner'), 'whatever', 'x')));
    expect(true).toBe(true);
  });
});
