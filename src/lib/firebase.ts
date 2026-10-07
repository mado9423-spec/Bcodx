import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** true عند توفر إعدادات Firebase ولم يُفرض وضع العرض التجريبي */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId) && String(env.VITE_FORCE_DEMO) !== 'true';

/** للتطوير المحلي: npm run emulators ثم npm run dev:emulator */
const useEmulator = String(env.VITE_USE_EMULATOR) === 'true';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  return auth;
}

/**
 * Firestore مع تخزين دائم محلي (IndexedDB) ودعم عدة تبويبات:
 * يعمل التطبيق بالكامل دون إنترنت وتُرفع التغييرات تلقائيًا عند عودة الاتصال.
 */
export function getDb(): Firestore {
  if (!db) {
    try {
      db = initializeFirestore(getFirebaseApp(), {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true,
      });
    } catch {
      db = getFirestore(getFirebaseApp());
    }
    if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return db;
}
