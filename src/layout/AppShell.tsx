import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, CheckCircle2, ChevronDown, CloudOff, LogOut, Menu, Moon, Plus, RefreshCw, Search, Sun, Wifi } from 'lucide-react';
import { useAuth, DEMO_PROFILES } from '../auth/AuthContext';
import { useData } from '../data/DataContext';
import { ROLE_LABELS, type Role } from '../data/types';
import { Avatar } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LogoTile, Wordmark } from '../components/Logo';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Misc';
import { can } from '../lib/permissions';
import { useTheme } from '../lib/theme';
import { CommandPalette } from './CommandPalette';
import { NAV } from './nav';
import { useAlerts } from './useAlerts';

function SyncChip() {
  const { sync } = useData();
  if (!sync.online) {
    return (
      <span className="sync-chip off" title="تعمل دون إنترنت: كل تغييراتك محفوظة وستُرفع تلقائيًا عند عودة الاتصال">
        <CloudOff size={14} /> <span className="hide-mobile">دون اتصال — محفوظ محليًا</span>
      </span>
    );
  }
  if (sync.pending) {
    return (
      <span className="sync-chip pending" title="جارٍ رفع التغييرات إلى الخادم">
        <RefreshCw size={14} className="spin-slow" /> <span className="hide-mobile">جارٍ المزامنة…</span>
      </span>
    );
  }
  return (
    <span className="sync-chip" title="كل البيانات متزامنة">
      <Wifi size={14} /> <span className="hide-mobile">متزامن</span>
    </span>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut, active]);
}

function AlertsMenu({ role }: { role: Role }) {
  const alerts = useAlerts(role);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useOutside(ref, () => setOpen(false), open);
  const total = alerts.reduce((s, a) => s + a.count, 0);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button variant="ghost" icon onClick={() => setOpen((o) => !o)} aria-label={`التنبيهات (${alerts.length})`} aria-expanded={open}>
        <Bell size={20} />
        {alerts.length > 0 && (
          <motion.span key={total} initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ position: 'absolute', top: 4, insetInlineEnd: 4, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--c-coral)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px' }}>
            {alerts.length}
          </motion.span>
        )}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div className="menu" style={{ top: 'calc(100% + 8px)', insetInlineEnd: 0, width: 360, maxWidth: '88vw' }} initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <div className="menu-title">تنبيهات ذكية</div>
            {alerts.length === 0 && <div className="empty" style={{ padding: '1.5rem' }}><CheckCircle2 size={34} color="var(--ok)" /><b>كل شيء على ما يرام</b></div>}
            {alerts.map((a) => (
              <button key={a.id} onClick={() => { setOpen(false); nav(a.to); }} style={{ alignItems: 'flex-start', padding: '0.7rem 0.75rem', height: 'auto' }}>
                <span className={`badge ${a.tone}`} style={{ width: 34, height: 34, borderRadius: 11, padding: 0, justifyContent: 'center', flex: 'none' }}><a.icon size={18} /></span>
                <span>
                  <b style={{ display: 'block', color: 'var(--text)' }}>{a.title}</b>
                  <span className="small muted">{a.text}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu({ placement }: { placement: 'up' | 'down' }) {
  const { profile, mode, setDemoRole, resetDemoData, signOut } = useAuth();
  const { company } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  if (!profile) return null;
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button className="user-card" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar name={profile.name} round />
        <span className="who">
          <b className="truncate">{profile.name}</b>
          <span className="truncate" style={{ display: 'block' }}>{ROLE_LABELS[profile.role]} • {company.name}</span>
        </span>
        <ChevronDown size={16} className="muted" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="menu" style={placement === 'up' ? { bottom: 'calc(100% + 8px)', insetInline: 0 } : { top: 'calc(100% + 8px)', insetInline: 0 }} initial={{ opacity: 0, y: placement === 'up' ? 8 : -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: placement === 'up' ? 8 : -8 }}>
            {mode === 'demo' && (
              <>
                <div className="menu-title">عرض النظام كـ (وضع تجريبي)</div>
                {(Object.keys(DEMO_PROFILES) as Role[]).map((r) => (
                  <button key={r} onClick={() => { setDemoRole(r); setOpen(false); }}>
                    {profile.role === r ? <Check size={16} color="var(--c-teal)" /> : <span style={{ width: 16 }} />} {ROLE_LABELS[r]}
                  </button>
                ))}
                <hr />
                <button onClick={() => { if (window.confirm('سيتم مسح التغييرات وإعادة البيانات التجريبية الأصلية. متابعة؟')) resetDemoData(); }}>
                  <RefreshCw size={16} /> إعادة ضبط البيانات التجريبية
                </button>
                <hr />
              </>
            )}
            <button onClick={() => void signOut()} style={{ color: 'var(--bad)' }}>
              <LogOut size={16} /> تسجيل الخروج
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ role, pendingOrders }: { role: Role; pendingOrders: number }) {
  const items = NAV.filter((n) => can(role, n.perm));
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <aside className="sidebar" aria-label="القائمة الرئيسية">
      <div className="brand">
        <LogoTile />
        <div>
          <div className="brand-name"><Wordmark height={21} /></div>
          <div className="brand-tag">منظومة التوزيع الذكية</div>
        </div>
      </div>
      <nav className="nav">
        {groups.map((g) => (
          <div key={g} style={{ display: 'contents' }}>
            {g !== 'الرئيسية' && <div className="nav-group">{g}</div>}
            {items.filter((i) => i.group === g).map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                    <i.icon size={20} />
                    <span>{i.label}</span>
                    {i.to === '/orders' && pendingOrders > 0 && <span className="nav-badge">{pendingOrders}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <UserMenu placement="up" />
      </div>
    </aside>
  );
}

function MobileNav({ role }: { role: Role }) {
  const items = NAV.filter((n) => can(role, n.perm));
  const find = (to: string) => items.find((i) => i.to === to);
  const canCreate = can(role, 'orders.create');
  // يمين → يسار: الرئيسية، الطلبات، [طلب جديد]، العملاء/التحصيل، المزيد
  const slots = [find('/'), find('/orders'), canCreate ? 'fab' : find('/products'), find('/customers') ?? find('/collections'), 'more'].filter(Boolean) as (typeof items[number] | 'fab' | 'more')[];
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setMore(false), [loc.pathname]);
  return (
    <>
      <nav className="mobile-nav" aria-label="التنقل السريع">
        {slots.map((s) => {
          if (s === 'fab') {
            return (
              <div key="fab" className="fab-slot">
                <button type="button" className="fab-btn" onClick={() => nav('/orders/new')} aria-label="طلب جديد">
                  <Plus size={26} strokeWidth={2.6} />
                </button>
                <span className="fab-label">طلب جديد</span>
              </div>
            );
          }
          if (s === 'more') {
            return (
              <button key="more" onClick={() => setMore(true)} aria-label="المزيد">
                <Menu size={21} />
                <span>المزيد</span>
              </button>
            );
          }
          return (
            <NavLink key={s.to} to={s.to} end={s.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="mnav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                  <s.icon size={21} />
                  <span>{s.label.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="كل الأقسام" width={460}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className="card hover" style={{ display: 'grid', placeItems: 'center', gap: 6, padding: '1rem 0.5rem', textAlign: 'center', fontWeight: 700, fontSize: '0.8125rem' }}>
              <i.icon size={24} color="var(--brand)" />
              {i.label}
            </NavLink>
          ))}
        </div>
        <div style={{ marginTop: '1rem' }}><UserMenu placement="up" /></div>
      </Modal>
    </>
  );
}

function titleFor(pathname: string): string {
  if (pathname === '/orders/new') return 'طلب جديد';
  const hit = [...NAV].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));
  return hit?.label ?? '';
}

export function AppShell(): ReactNode {
  const { profile } = useAuth();
  const { orders } = useData();
  const loc = useLocation();
  const nav = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [palette, setPalette] = useState(false);
  const role = profile!.role;
  const pendingOrders = orders.filter((o) => o.status === 'credit_hold' || o.status === 'new').length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((o) => !o);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const t = titleFor(loc.pathname);
    document.title = t ? `${t} — Bhub` : 'Bhub — منظومة التوزيع الذكية';
  }, [loc.pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">تخطَّ إلى المحتوى</a>
      <Sidebar role={role} pendingOrders={pendingOrders} />
      <div className="main">
        <header className="topbar">
          <div className="crumb">{titleFor(loc.pathname)}</div>
          <div className="spacer" />
          <button type="button" className="search-pill" onClick={() => setPalette(true)} aria-label="بحث سريع (Ctrl+K)">
            <Search size={16} />
            <span className="hide-mobile">بحث سريع…</span>
            <kbd className="hide-mobile">Ctrl K</kbd>
          </button>
          <SyncChip />
          {can(role, 'orders.create') && loc.pathname !== '/orders/new' && (
            <Button variant="primary" size="sm" leading={<Plus size={16} />} onClick={() => nav('/orders/new')} className="hide-mobile">
              طلب جديد
            </Button>
          )}
          <AlertsMenu role={role} />
          <Button variant="ghost" icon onClick={toggleTheme} aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={theme} initial={{ rotate: -90, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.5 }} transition={{ duration: 0.2 }} style={{ display: 'grid' }}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </motion.span>
            </AnimatePresence>
          </Button>
        </header>
        <main className="page" id="main" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="col" aria-busy>
                <Skeleton h={36} w={240} />
                <Skeleton h={120} />
                <Skeleton h={320} />
              </div>
            }
          >
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
              <Outlet />
            </motion.div>
          </Suspense>
        </main>
      </div>
      <MobileNav role={role} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} role={role} />
    </div>
  );
}
