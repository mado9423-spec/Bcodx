import { useMemo } from 'react';
import { AlertTriangle, Clock, Gift, MapPinOff, PackageX, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useData } from '../data/DataContext';
import { can } from '../lib/permissions';
import type { Role } from '../data/types';
import { DAY, startOfDay } from '../lib/time';
import { fmtNum } from '../lib/format';

export interface AlertItem {
  id: string;
  tone: 'red' | 'amber' | 'orange' | 'blue' | 'violet';
  icon: LucideIcon;
  title: string;
  text: string;
  to: string;
  count: number;
}

export function useAlerts(role: Role | undefined): AlertItem[] {
  const { orders, customers, products, stockTotal, aging, offers } = useData();
  return useMemo(() => {
    const now = Date.now();
    const list: AlertItem[] = [];
    if (can(role, 'orders.approve_credit')) {
      const held = orders.filter((o) => o.status === 'credit_hold');
      if (held.length) list.push({ id: 'hold', tone: 'red', icon: ShieldAlert, title: 'طلبات بانتظار موافقة الائتمان', text: `${fmtNum(held.length)} طلب تجاوز العميل فيه الحد الائتماني`, to: '/orders?status=credit_hold', count: held.length });
    }
    if (can(role, 'inventory.view')) {
      const low = products.filter((p) => p.active && stockTotal(p.id) <= p.minStock);
      const out = low.filter((p) => stockTotal(p.id) <= 0);
      if (low.length) list.push({ id: 'low', tone: out.length ? 'red' : 'amber', icon: PackageX, title: 'مخزون منخفض', text: `${fmtNum(low.length)} صنف تحت حد إعادة الطلب${out.length ? ` (${fmtNum(out.length)} نافد)` : ''}`, to: '/inventory?filter=low', count: low.length });
    }
    if (can(role, 'collections.view')) {
      const overdue = customers.filter((c) => (aging.get(c.id)?.overdue ?? 0) > 0.005);
      if (overdue.length) list.push({ id: 'overdue', tone: 'orange', icon: AlertTriangle, title: 'عملاء متأخرون في السداد', text: `${fmtNum(overdue.length)} عميل لديهم مبالغ تجاوزت تاريخ الاستحقاق`, to: '/collections?filter=overdue', count: overdue.length });
      const today = startOfDay(now);
      const promises = customers.filter((c) => c.promiseDate !== undefined && c.balance > 0 && c.promiseDate <= today + DAY - 1);
      if (promises.length) list.push({ id: 'promise', tone: 'violet', icon: Clock, title: 'وعود بالسداد مستحقة اليوم', text: `${fmtNum(promises.length)} عميل وعدوا بالدفع اليوم أو قبله`, to: '/collections?filter=promise', count: promises.length });
    }
    if (can(role, 'customers.view')) {
      const stale = customers.filter((c) => c.active && (c.lastVisitAt ?? 0) < now - 14 * DAY);
      if (stale.length) list.push({ id: 'visit', tone: 'blue', icon: MapPinOff, title: 'عملاء لم تتم زيارتهم', text: `${fmtNum(stale.length)} عميل بلا زيارة منذ أكثر من 14 يومًا`, to: '/customers?filter=unvisited', count: stale.length });
    }
    if (can(role, 'offers.view')) {
      const ending = offers.filter((o) => o.active && o.startAt <= now && o.endAt >= now && o.endAt - now < 5 * DAY);
      if (ending.length) list.push({ id: 'offer', tone: 'blue', icon: Gift, title: 'عروض تنتهي قريبًا', text: `${fmtNum(ending.length)} عرض ينتهي خلال 5 أيام`, to: '/offers', count: ending.length });
    }
    return list;
  }, [role, orders, customers, products, stockTotal, aging, offers]);
}
