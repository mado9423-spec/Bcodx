import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsUpDown, Search, X } from 'lucide-react';
import { useData } from '../../data/DataContext';
import type { Customer } from '../../data/types';
import { Avatar } from '../ui/Badge';

export function CustomerPicker({ value, onChange, filter, placeholder = 'ابحث بالاسم أو الجوال…' }: { value: Customer | undefined; onChange: (c: Customer | undefined) => void; filter?: (c: Customer) => boolean; placeholder?: string }) {
  const { customers, zoneById, money } = useData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return customers
      .filter((c) => c.active && (!filter || filter(c)))
      .filter((c) => !t || c.name.toLowerCase().includes(t) || c.contact.toLowerCase().includes(t) || c.phone.includes(t))
      .slice(0, 8);
  }, [customers, q, filter]);

  if (value) {
    return (
      <div className="picked">
        <Avatar name={value.name} color={zoneById.get(value.zoneId)?.color} />
        <div className="grow">
          <b className="truncate" style={{ display: 'block' }}>{value.name}</b>
          <span className="muted xs">{zoneById.get(value.zoneId)?.name} • رصيد {money(value.balance)}</span>
        </div>
        <button type="button" className="btn ghost sm" onClick={() => { onChange(undefined); setQ(''); setTimeout(() => ref.current?.focus(), 50); }}>
          <X size={14} /> تغيير
        </button>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <div className="input-affix">
        <Search size={18} />
        <input ref={ref} className="input" value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} aria-label="اختيار العميل" role="combobox" aria-expanded={open} />
        <ChevronsUpDown size={16} style={{ insetInlineStart: 'auto', insetInlineEnd: 12 }} />
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul className="menu combo" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ top: 'calc(100% + 6px)', insetInline: 0, margin: 0, listStyle: 'none' }}>
            {list.length === 0 && <li className="muted small" style={{ padding: '0.8rem' }}>لا نتائج مطابقة</li>}
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(c); setOpen(false); }} style={{ height: 'auto', padding: '0.5rem 0.6rem' }}>
                  <Avatar name={c.name} size="sm" color={zoneById.get(c.zoneId)?.color} />
                  <span className="grow">
                    <b style={{ display: 'block', color: 'var(--text)' }}>{c.name}</b>
                    <span className="muted xs">{c.contact} • {zoneById.get(c.zoneId)?.name}</span>
                  </span>
                  {c.balance > 0 && <span className="badge amber">{money(c.balance, { compact: true })}</span>}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
