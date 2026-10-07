import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword,
  signOut as fbSignOut, updateProfile, type User,
} from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { FirestoreStore } from '../data/firestoreStore';
import { LocalStore } from '../data/localStore';
import { generateSeed } from '../data/seed';
import { writeSeed } from '../data/seedRunner';
import type { Store } from '../data/store';
import type { Invite, Role, UserProfile } from '../data/types';
import { getAuthInstance, getDb, firebaseEnabled } from '../lib/firebase';
import { newId } from '../lib/ids';

export type AuthStatus = 'loading' | 'signedOut' | 'needsCompany' | 'needsVerification' | 'ready';

interface AuthValue {
  mode: 'demo' | 'firebase';
  status: AuthStatus;
  profile: UserProfile | null;
  store: Store | null;
  email: string | null;
  pendingInvite: Invite | null;
  signIn(email: string, password: string): Promise<void>;
  signUpOwner(input: { name: string; email: string; password: string; companyName: string; withDemoData: boolean }): Promise<void>;
  signUpStaff(input: { name: string; email: string; password: string }): Promise<void>;
  createCompany(input: { companyName: string; withDemoData: boolean }): Promise<void>;
  resendVerification(): Promise<void>;
  recheckVerification(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  startDemo(role?: Role): void;
  setDemoRole(role: Role): void;
  resetDemoData(): void;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

const DEMO_ID = 'demo';
const SESSION_KEY = 'bhub:demo:session';

export const DEMO_PROFILES: Record<Role, { name: string; repId?: string }> = {
  owner: { name: 'مدير النظام' },
  manager: { name: 'مدير المبيعات' },
  rep: { name: 'أحمد الخالدي', repId: 'r1' },
  storekeeper: { name: 'أمين المخزن' },
  accountant: { name: 'المحاسب' },
};

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
    'auth/email-already-in-use': 'هذا البريد مسجَّل مسبقًا، جرّب تسجيل الدخول.',
    'auth/weak-password': 'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل.',
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
    'auth/network-request-failed': 'تعذّر الاتصال بالإنترنت. تحقق من الشبكة وحاول مجددًا.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.',
    'permission-denied': 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  };
  return map[code] ?? (e instanceof Error ? e.message : 'حدث خطأ غير متوقع.');
}

function readDemoRole(): Role | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const role = (JSON.parse(raw) as { role: Role }).role;
    return role in DEMO_PROFILES ? role : null;
  } catch {
    return null;
  }
}

function buildDemoStore(): LocalStore {
  let snap = LocalStore.load(DEMO_ID);
  if (!snap) {
    const { company, data } = generateSeed();
    snap = { company: { ...company, id: DEMO_ID, ownerUid: 'demo-user' }, tables: data as unknown as NonNullable<typeof snap>['tables'] };
  }
  const store = new LocalStore(DEMO_ID, snap);
  // يضمن حفظ البذرة الأولى
  void store.batch().commit();
  return store;
}

/** يمنع إنشاء مخزن جديد (واشتراكات جديدة) في كل رسم */
const storeCache = new Map<string, FirestoreStore>();
function getFirestoreStore(companyId: string): FirestoreStore {
  let s = storeCache.get(companyId);
  if (!s) {
    s = new FirestoreStore(companyId);
    storeCache.set(companyId, s);
  }
  return s;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: 'demo' | 'firebase' = firebaseEnabled ? 'firebase' : 'demo';
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<Invite | null>(null);
  const [demoStore, setDemoStore] = useState<LocalStore | null>(null);
  const registering = useRef(false);

  // ---------- وضع العرض التجريبي ----------
  useEffect(() => {
    if (mode !== 'demo') return;
    const role = readDemoRole();
    if (role) {
      const store = buildDemoStore();
      setDemoStore(store);
      setProfile({ uid: 'demo-user', email: 'demo@bhub.app', companyId: DEMO_ID, role, ...DEMO_PROFILES[role] });
      setStatus('ready');
    } else {
      setStatus('signedOut');
    }
  }, [mode]);

  const startDemo = useCallback((role: Role = 'owner') => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
    } catch {
      /* ignore */
    }
    setDemoStore((s) => s ?? buildDemoStore());
    setProfile({ uid: 'demo-user', email: 'demo@bhub.app', companyId: DEMO_ID, role, ...DEMO_PROFILES[role] });
    setStatus('ready');
  }, []);

  const setDemoRole = useCallback(
    (role: Role) => {
      startDemo(role);
    },
    [startDemo],
  );

  const resetDemoData = useCallback(() => {
    LocalStore.clear(DEMO_ID);
    window.location.reload();
  }, []);

  // ---------- Firebase ----------
  const resolveUser = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setPendingInvite(null);
      setEmail(null);
      setStatus('signedOut');
      return;
    }
    setEmail(user.email);
    const db = getDb();
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      setProfile({ ...(snap.data() as UserProfile), uid: user.uid });
      setPendingInvite(null);
      setStatus('ready');
      return;
    }
    const key = (user.email ?? '').toLowerCase();
    const inv = key ? await getDoc(doc(db, 'invites', key)).catch(() => null) : null;
    if (inv?.exists()) {
      const invite = inv.data() as Invite;
      setPendingInvite(invite);
      if (!user.emailVerified) {
        setStatus('needsVerification');
        return;
      }
      await user.getIdToken(true);
      const prof: UserProfile = {
        uid: user.uid, name: invite.name || user.displayName || key, email: key, role: invite.role, companyId: invite.companyId,
        ...(invite.repId ? { repId: invite.repId } : {}),
      };
      const b = writeBatch(db);
      b.set(doc(db, 'users', user.uid), { ...prof, createdAt: Date.now() });
      b.delete(doc(db, 'invites', key));
      await b.commit();
      setProfile(prof);
      setPendingInvite(null);
      setStatus('ready');
      return;
    }
    setPendingInvite(null);
    setStatus('needsCompany');
  }, []);

  useEffect(() => {
    if (mode !== 'firebase') return;
    return onAuthStateChanged(getAuthInstance(), (user) => {
      if (registering.current) return;
      resolveUser(user).catch(() => setStatus('signedOut'));
    });
  }, [mode, resolveUser]);

  const createCompanyFor = useCallback(
    async (user: User, input: { name: string; companyName: string; withDemoData: boolean }) => {
      const db = getDb();
      const companyId = newId();
      const now = Date.now();
      const b = writeBatch(db);
      b.set(doc(db, 'companies', companyId), {
        id: companyId, name: input.companyName, currency: 'SAR', dialCode: '966', defaultCreditDays: 30, ownerUid: user.uid, createdAt: now,
      });
      const prof: UserProfile = { uid: user.uid, name: input.name, email: (user.email ?? '').toLowerCase(), role: 'owner', companyId };
      b.set(doc(db, 'users', user.uid), { ...prof, createdAt: now });
      await b.commit();
      if (input.withDemoData) {
        const store = new FirestoreStore(companyId);
        await writeSeed(store, generateSeed().data);
      }
      setProfile(prof);
      setStatus('ready');
    },
    [],
  );

  const value = useMemo<AuthValue>(() => {
    const auth = () => getAuthInstance();
    return {
      mode,
      status,
      profile,
      email,
      pendingInvite,
      store: mode === 'demo' ? demoStore : profile ? getFirestoreStore(profile.companyId) : null,
      async signIn(e, p) {
        await signInWithEmailAndPassword(auth(), e.trim(), p);
      },
      async signUpOwner({ name, email: e, password, companyName, withDemoData }) {
        registering.current = true;
        try {
          const cred = await createUserWithEmailAndPassword(auth(), e.trim(), password);
          await updateProfile(cred.user, { displayName: name });
          await createCompanyFor(cred.user, { name, companyName, withDemoData });
          setEmail(cred.user.email);
        } finally {
          registering.current = false;
        }
      },
      async signUpStaff({ name, email: e, password }) {
        registering.current = true;
        try {
          const cred = await createUserWithEmailAndPassword(auth(), e.trim(), password);
          await updateProfile(cred.user, { displayName: name });
          await sendEmailVerification(cred.user);
        } finally {
          registering.current = false;
        }
        await resolveUser(auth().currentUser);
      },
      async createCompany({ companyName, withDemoData }) {
        const user = auth().currentUser;
        if (!user) throw new Error('الجلسة منتهية، سجّل الدخول من جديد.');
        await createCompanyFor(user, { name: user.displayName ?? user.email ?? 'المالك', companyName, withDemoData });
      },
      async resendVerification() {
        const user = auth().currentUser;
        if (user) await sendEmailVerification(user);
      },
      async recheckVerification() {
        const user = auth().currentUser;
        if (!user) return;
        await user.reload();
        await resolveUser(auth().currentUser);
      },
      async resetPassword(e) {
        await sendPasswordResetEmail(auth(), e.trim());
      },
      startDemo,
      setDemoRole,
      resetDemoData,
      async signOut() {
        if (mode === 'demo') {
          try {
            localStorage.removeItem(SESSION_KEY);
          } catch {
            /* ignore */
          }
          setProfile(null);
          setStatus('signedOut');
          return;
        }
        await fbSignOut(auth());
      },
    };
  }, [mode, status, profile, email, pendingInvite, demoStore, createCompanyFor, resolveUser, startDemo, setDemoRole, resetDemoData]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
