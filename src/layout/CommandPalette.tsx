import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardList, CornerDownLeft, Package, Plus, Search, Users, Wallet, type LucideIcon } from 'lucide-react';
import { useData } from '../data/DataContext';
import type { Role } from '../data/types';
import { can } from '../lib/permissions';
import { NAV } from './nav';

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

/** تطبيع عربي بسيط للبحث: توحيد الألف والياء والتاء المربوطة وحذف التشكيل */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

export function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role: Role }) {
  const nav = useNavigate();
  const { customers, orders, products } = useData();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const go = (to: string) => () => {
    onClose();
    nav(to);
  };

  const items = useMemo<Cmd[]>(() => {
    const t = norm(q.trim());
    const out: Cmd[] = [];
    const actions: Cmd[] = [];
    if (can(role, 'orders.create')) actions.push({ id: 'a-order', group: 'إجراءات', label: 'طلب جديد', hint: 'ابدأ طلبًا لعميل', icon: Plus, run: go('/orders/new') });
    if (can(role, 'collections.create')) actions.push({ id: 'a-collect', group: 'إجراءات', label: 'تسجيل تحصيل', hint: 'سند قبض من عميل', icon: Wallet, run: go('/collections') });
    if (can(role, 'customers.edit')) actions.push({ id: 'a-cust', group: 'إجراءات', label: 'عميل جديد', hint: 'إضافة عميل', icon: Users, run: go('/customers?new=1') });
    const pages: Cmd[] = NAV.filter((n) => can(role, n.perm)).map((n) => ({ id: `p-${n.to}`, group: 'الصفحات', label: n.label, icon: n.icon, run: go(n.to) }));

    const match = (c: Cmd) => !t || norm(`${c.label} ${c.hint ?? ''}`).includes(t);
    out.push(...actions.filter(match), ...pages.filter(match));

    if (t.length >= 2) {
      if (can(role, 'customers.view')) {
        customers
          .filter((c) => norm(`${c.name} ${c.contact} ${c.phone}`).includes(t))
          .slice(0, 6)
          .forEach((c) => out.push({ id: `c-${c.id}`, group: 'العملاء', label: c.name, hint: c.contact, icon: Users, run: go(`/customers?open=${c.id}`) }));
      }
      if (can(role, 'orders.view')) {
        orders
          .filter((o) => norm(`${o.no} ${o.customerName}`).includes(t))
          .slice(0, 5)
          .forEach((o) => out.push({ id: `o-${o.id}`, group: 'الطلبات', label: `#${o.no}`, hint: o.customerName, icon: ClipboardList, run: go(`/orders?open=${o.id}`) }));
      }
      if (can(role, 'products.view')) {
        products
          .filter((p) => norm(`${p.name} ${p.sku}`).includes(t))
          .slice(0, 5)
          .forEach((p) => out.push({ id: `pr-${p.id}`, group: 'المنتجات', label: p.name, hint: p.sku, icon: Package, run: go(`/products?q=${encodeURIComponent(p.name)}`) }));
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, customers, orders, products, role]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';
  const rows: ReactNode[] = [];
  items.forEach((it, i) => {
    if (it.group !== lastGroup) {
      lastGroup = it.group;
      rows.push(
        <div key={`g-${it.group}`} className="cp-group">
          {it.group}
        </div>,
      );
    }
    rows.push(
      <button key={it.id} data-i={i} type="button" role="option" aria-selected={i === active} className={`cp-item ${i === active ? 'on' : ''}`} onPointerMove={() => setActive(i)} onClick={it.run}>
        <span className="cp-ico">
          <it.icon size={17} />
        </span>
        <span className="grow">
          <b>{it.label}</b>
          {it.hint && <span className="muted xs"> {it.hint}</span>}
        </span>
        {i === active && <CornerDownLeft size={15} className="muted" />}
      </button>,
    );
  });

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="cp-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className="cp" role="dialog" aria-modal="true" aria-label="بحث وأوامر سريعة" initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
            <div className="cp-input">
              <Search size={19} />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="ابحث عن عميل أو طلب أو منتج، أو اكتب أمرًا…" role="combobox" aria-expanded aria-controls="cp-list" aria-label="بحث" />
              <kbd>Esc</kbd>
            </div>
            <div className="cp-list" id="cp-list" role="listbox" ref={listRef}>
              {items.length === 0 ? <div className="cp-empty">لا نتائج لـ «{q}»</div> : rows}
            </div>
            <div className="cp-foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> تنقّل</span>
              <span><kbd>↵</kbd> فتح</span>
              <span className="muted">اكتب حرفين لبحث العملاء والطلبات والمنتجات</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
