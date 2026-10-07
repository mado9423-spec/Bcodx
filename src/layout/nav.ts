import { BarChart3, ClipboardList, Gift, LayoutDashboard, MapPin, Package, Settings, Truck, Users, Wallet, Warehouse, type LucideIcon } from 'lucide-react';
import type { Perm } from '../lib/permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  perm: Perm;
  group: string;
  end?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, perm: 'dashboard', group: 'الرئيسية', end: true },
  { to: '/orders', label: 'الطلبات', icon: ClipboardList, perm: 'orders.view', group: 'المبيعات' },
  { to: '/customers', label: 'العملاء', icon: Users, perm: 'customers.view', group: 'المبيعات' },
  { to: '/offers', label: 'العروض', icon: Gift, perm: 'offers.view', group: 'المبيعات' },
  { to: '/products', label: 'المنتجات', icon: Package, perm: 'products.view', group: 'المخزون' },
  { to: '/inventory', label: 'المخازن', icon: Warehouse, perm: 'inventory.view', group: 'المخزون' },
  { to: '/collections', label: 'التحصيل والديون', icon: Wallet, perm: 'collections.view', group: 'المال' },
  { to: '/reps', label: 'المندوبون', icon: Truck, perm: 'reps.view', group: 'الفريق' },
  { to: '/zones', label: 'مناطق التوزيع', icon: MapPin, perm: 'zones.view', group: 'الفريق' },
  { to: '/reports', label: 'التقارير', icon: BarChart3, perm: 'reports.view', group: 'التحليل' },
  { to: '/settings', label: 'الإعدادات', icon: Settings, perm: 'settings.view', group: 'النظام' },
];
