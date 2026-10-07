import { collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getDb } from '../lib/firebase';
import type { Invite, Role } from './types';

export interface Member {
  uid: string;
  name: string;
  email: string;
  role: Role;
  repId?: string;
}

export interface TeamApi {
  listMembers(): Promise<Member[]>;
  listInvites(): Promise<Invite[]>;
  invite(i: Omit<Invite, 'createdAt' | 'companyId'>): Promise<void>;
  revoke(email: string): Promise<void>;
  setRole(uid: string, role: Role, repId?: string): Promise<void>;
  remove(uid: string): Promise<void>;
}

const KEY = 'bhub:demo:team:v1';

interface DemoTeam {
  members: Member[];
  invites: Invite[];
}

function loadDemo(): DemoTeam {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoTeam;
  } catch {
    /* ignore */
  }
  return {
    members: [
      { uid: 'demo-user', name: 'مدير النظام', email: 'owner@demo.bhub.app', role: 'owner' },
      { uid: 'u2', name: 'مدير المبيعات', email: 'sales.manager@demo.bhub.app', role: 'manager' },
      { uid: 'u3', name: 'أحمد الخالدي', email: 'ahmed@demo.bhub.app', role: 'rep', repId: 'r1' },
      { uid: 'u4', name: 'أمين المخزن', email: 'store@demo.bhub.app', role: 'storekeeper' },
      { uid: 'u5', name: 'المحاسب', email: 'accounts@demo.bhub.app', role: 'accountant' },
    ],
    invites: [],
  };
}

const saveDemo = (t: DemoTeam) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
};

function demoApi(companyId: string): TeamApi {
  return {
    async listMembers() {
      return loadDemo().members;
    },
    async listInvites() {
      return loadDemo().invites;
    },
    async invite(i) {
      const t = loadDemo();
      t.invites = [...t.invites.filter((x) => x.email !== i.email.toLowerCase()), { ...i, email: i.email.toLowerCase(), companyId, createdAt: Date.now() }];
      saveDemo(t);
    },
    async revoke(email) {
      const t = loadDemo();
      t.invites = t.invites.filter((x) => x.email !== email);
      saveDemo(t);
    },
    async setRole(uid, role, repId) {
      const t = loadDemo();
      t.members = t.members.map((m) => (m.uid === uid ? { ...m, role, ...(repId ? { repId } : {}) } : m));
      saveDemo(t);
    },
    async remove(uid) {
      const t = loadDemo();
      t.members = t.members.filter((m) => m.uid !== uid);
      saveDemo(t);
    },
  };
}

function firebaseApi(companyId: string): TeamApi {
  return {
    async listMembers() {
      const snap = await getDocs(query(collection(getDb(), 'users'), where('companyId', '==', companyId)));
      return snap.docs.map((d) => ({ ...(d.data() as Member), uid: d.id }));
    },
    async listInvites() {
      const snap = await getDocs(query(collection(getDb(), 'invites'), where('companyId', '==', companyId)));
      return snap.docs.map((d) => d.data() as Invite);
    },
    async invite(i) {
      const email = i.email.trim().toLowerCase();
      await setDoc(doc(getDb(), 'invites', email), { ...i, email, companyId, createdAt: Date.now() });
    },
    async revoke(email) {
      await deleteDoc(doc(getDb(), 'invites', email));
    },
    async setRole(uid, role, repId) {
      await updateDoc(doc(getDb(), 'users', uid), { role, repId: repId ?? null });
    },
    async remove(uid) {
      await deleteDoc(doc(getDb(), 'users', uid));
    },
  };
}

export function useTeam(): TeamApi {
  const { mode, profile } = useAuth();
  const companyId = profile?.companyId ?? '';
  return useMemo(() => (mode === 'demo' ? demoApi(companyId) : firebaseApi(companyId)), [mode, companyId]);
}
