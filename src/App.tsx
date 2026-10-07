import { lazy, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AuthPages } from './auth/AuthPages';
import { BootScreen, DataProvider } from './data/DataContext';
import { AppShell } from './layout/AppShell';
import { ToastProvider } from './components/ui/Toast';
import { can, type Perm } from './lib/permissions';
import type { ReactElement } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const NewOrder = lazy(() => import('./pages/NewOrder'));
const Products = lazy(() => import('./pages/Products'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Collections = lazy(() => import('./pages/Collections'));
const Reps = lazy(() => import('./pages/Reps'));
const Zones = lazy(() => import('./pages/Zones'));
const Offers = lazy(() => import('./pages/Offers'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function Guard({ perm, children }: { perm: Perm; children: ReactElement }) {
  const { profile } = useAuth();
  return can(profile?.role, perm) ? children : <Navigate to="/" replace />;
}

function Authed() {
  const { profile, store } = useAuth();
  const scopeRepId = profile?.role === 'rep' ? profile.repId : undefined;
  const stableKey = useMemo(() => `${profile?.companyId}:${scopeRepId ?? 'all'}`, [profile?.companyId, scopeRepId]);
  if (!profile || !store) return <BootScreen />;
  return (
    <DataProvider key={stableKey} store={store} scopeRepId={scopeRepId}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Guard perm="dashboard"><Dashboard /></Guard>} />
          <Route path="customers" element={<Guard perm="customers.view"><Customers /></Guard>} />
          <Route path="orders" element={<Guard perm="orders.view"><Orders /></Guard>} />
          <Route path="orders/new" element={<Guard perm="orders.create"><NewOrder /></Guard>} />
          <Route path="products" element={<Guard perm="products.view"><Products /></Guard>} />
          <Route path="inventory" element={<Guard perm="inventory.view"><Inventory /></Guard>} />
          <Route path="collections" element={<Guard perm="collections.view"><Collections /></Guard>} />
          <Route path="reps" element={<Guard perm="reps.view"><Reps /></Guard>} />
          <Route path="zones" element={<Guard perm="zones.view"><Zones /></Guard>} />
          <Route path="offers" element={<Guard perm="offers.view"><Offers /></Guard>} />
          <Route path="reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
          <Route path="settings" element={<Guard perm="settings.view"><SettingsPage /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}

function Gate() {
  const { status } = useAuth();
  if (status === 'loading') return <BootScreen label="جارٍ التحقق من الجلسة…" />;
  if (status !== 'ready') return <AuthPages />;
  return <Authed />;
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}
