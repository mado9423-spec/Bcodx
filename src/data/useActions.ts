import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/ui/Toast';
import { createActions } from './actions';
import { useData } from './DataContext';

export function useActions() {
  const { store } = useData();
  const { profile } = useAuth();
  return useMemo(() => createActions(store, { name: profile?.name ?? 'مستخدم', repId: profile?.repId }), [store, profile?.name, profile?.repId]);
}

function errMsg(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/permission|insufficient/i.test(raw)) return 'ليست لديك صلاحية لتنفيذ هذا الإجراء، أو الكمية المتاحة في المخزن غير كافية.';
  return raw || 'تعذّر تنفيذ العملية.';
}

/** يشغّل عملية غير متزامنة مع حالة انشغال ورسالة نجاح/خطأ موحّدة */
export function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (success) toast.success(typeof success === 'function' ? success(r) : success);
        return r;
      } catch (e) {
        toast.error(errMsg(e));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
