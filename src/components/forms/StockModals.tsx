import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { useActions, useRun } from '../../data/useActions';
import { WAREHOUSE_TYPE_LABELS, type Product, type Warehouse, type WarehouseType } from '../../data/types';
import { newId } from '../../lib/ids';
import { fmtNum } from '../../lib/format';
import { Button } from '../ui/Button';
import { Field, NumInput, QtyStepper, SelectInput, TextInput } from '../ui/Fields';
import { Modal } from '../ui/Modal';

interface Line {
  key: string;
  productId: string;
  qty: number;
}

function LinesEditor({ lines, setLines, products, availableIn }: { lines: Line[]; setLines: (l: Line[]) => void; products: Product[]; availableIn?: (productId: string) => number }) {
  const update = (key: string, patch: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  return (
    <div className="col" style={{ gap: '0.6rem' }}>
      {lines.map((l) => {
        const avail = availableIn?.(l.productId);
        const over = avail !== undefined && l.qty > avail;
        return (
          <div key={l.key} className="line-edit">
            <SelectInput value={l.productId} onChange={(e) => update(l.key, { productId: e.target.value })} aria-label="الصنف">
              <option value="">اختر الصنف…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </SelectInput>
            <QtyStepper value={l.qty} onChange={(n) => update(l.key, { qty: n })} min={1} />
            <Button variant="ghost" icon size="sm" onClick={() => setLines(lines.filter((x) => x.key !== l.key))} aria-label="حذف السطر" disabled={lines.length === 1}><Trash2 size={16} /></Button>
            {avail !== undefined && l.productId && <span className="xs" style={{ gridColumn: '1 / -1', color: over ? 'var(--bad)' : 'var(--muted)', fontWeight: over ? 700 : 500 }}>المتاح في المخزن المصدر: {fmtNum(avail)}{over ? ' — الكمية أكبر من المتاح' : ''}</span>}
          </div>
        );
      })}
      <Button variant="soft" size="sm" leading={<Plus size={16} />} onClick={() => setLines([...lines, { key: newId(), productId: '', qty: 1 }])}>إضافة صنف</Button>
    </div>
  );
}

const blankLine = (): Line => ({ key: newId(), productId: '', qty: 1 });
const valid = (lines: Line[]) => lines.filter((l) => l.productId && l.qty > 0);

export function ReceiveModal({ open, onClose, defaultWarehouse }: { open: boolean; onClose: () => void; defaultWarehouse?: string }) {
  const { warehouses, products } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const [wh, setWh] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setWh(defaultWarehouse && defaultWarehouse !== 'all' ? defaultWarehouse : warehouses.find((w) => w.type === 'main')?.id ?? warehouses[0]?.id ?? '');
      setLines([blankLine()]);
      setNote('');
    }
  }, [open, defaultWarehouse, warehouses]);
  const ok = valid(lines);
  return (
    <Modal open={open} onClose={onClose} title="استلام بضاعة" width={560} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" loading={busy} disabled={!wh || ok.length === 0} onClick={async () => { const r = await run(async () => { await actions.receiveStock(wh, ok.map((l) => ({ productId: l.productId, qty: l.qty })), note || undefined); return true; }, `تم استلام ${ok.length} صنف ✓`); if (r) onClose(); }}>تأكيد الاستلام</Button></>}>
      <div className="col">
        <Field label="المخزن">{(id) => <SelectInput id={id} value={wh} onChange={(e) => setWh(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
        <LinesEditor lines={lines} setLines={setLines} products={products.filter((p) => p.active)} />
        <Field label="ملاحظة">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: فاتورة المورّد رقم 1234" />}</Field>
      </div>
    </Modal>
  );
}

export function TransferModal({ open, onClose, defaultFrom }: { open: boolean; onClose: () => void; defaultFrom?: string }) {
  const { warehouses, products, stockQty } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  useEffect(() => {
    if (open) {
      const f = defaultFrom && defaultFrom !== 'all' ? defaultFrom : warehouses.find((w) => w.type === 'main')?.id ?? warehouses[0]?.id ?? '';
      setFrom(f);
      setTo(warehouses.find((w) => w.id !== f)?.id ?? '');
      setLines([blankLine()]);
    }
  }, [open, defaultFrom, warehouses]);
  const ok = valid(lines);
  const overs = ok.some((l) => l.qty > stockQty(from, l.productId));
  return (
    <Modal open={open} onClose={onClose} title="تحويل بين المخازن" width={580} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" loading={busy} disabled={!from || !to || from === to || ok.length === 0 || overs} onClick={async () => { const r = await run(async () => { await actions.transferStock(from, to, ok.map((l) => ({ productId: l.productId, qty: l.qty }))); return true; }, 'تم التحويل ✓'); if (r) onClose(); }}>تنفيذ التحويل</Button></>}>
      <div className="col">
        <div className="form-grid">
          <Field label="من مخزن">{(id) => <SelectInput id={id} value={from} onChange={(e) => setFrom(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
          <Field label="إلى مخزن" error={from === to ? 'اختر مخزنًا مختلفًا' : undefined}>{(id) => <SelectInput id={id} value={to} onChange={(e) => setTo(e.target.value)}>{warehouses.filter((w) => w.id !== from).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
        </div>
        <LinesEditor lines={lines} setLines={setLines} products={products.filter((p) => p.active)} availableIn={(pid) => stockQty(from, pid)} />
      </div>
    </Modal>
  );
}

export function AdjustModal({ open, onClose, warehouse, product }: { open: boolean; onClose: () => void; warehouse?: Warehouse; product?: Product }) {
  const { stockQty } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState('');
  const current = warehouse && product ? stockQty(warehouse.id, product.id) : 0;
  useEffect(() => {
    if (open) {
      setCounted(current);
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!warehouse || !product) return null;
  const delta = counted - current;
  return (
    <Modal open={open} onClose={onClose} title="تسوية جرد" width={460} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" loading={busy} disabled={delta === 0} onClick={async () => { const r = await run(async () => { await actions.adjustStock(warehouse.id, product.id, current, counted, note || undefined); return true; }, 'تم تعديل الرصيد ✓'); if (r) onClose(); }}>حفظ التسوية</Button></>}>
      <div className="col">
        <div className="row" style={{ gap: 10 }}><span style={{ fontSize: '2rem' }}>{product.emoji}</span><div><b>{product.name}</b><div className="muted small">{warehouse.name}</div></div></div>
        <div className="kv">
          <div><div className="k">الرصيد الدفتري</div><div className="v">{fmtNum(current)}</div></div>
          <div><div className="k">الفرق</div><div className="v" style={{ color: delta === 0 ? undefined : delta > 0 ? 'var(--ok)' : 'var(--bad)' }}>{delta > 0 ? '+' : ''}{fmtNum(delta)}</div></div>
        </div>
        <Field label="الكمية الفعلية (الجرد)">{(id) => <NumInput id={id} value={counted} onChange={(n) => setCounted(Math.max(0, Math.round(n)))} decimals={0} data-autofocus />}</Field>
        <Field label="سبب الفرق">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="تالف / عجز / زيادة…" />}</Field>
      </div>
    </Modal>
  );
}

export function WarehouseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { reps } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const [name, setName] = useState('');
  const [type, setType] = useState<WarehouseType>('branch');
  const [repId, setRepId] = useState('');
  useEffect(() => {
    if (open) {
      setName('');
      setType('branch');
      setRepId(reps[0]?.id ?? '');
    }
  }, [open, reps]);
  return (
    <Modal open={open} onClose={onClose} title="مخزن جديد" width={460} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" loading={busy} disabled={!name.trim()} onClick={async () => { const r = await run(async () => { await actions.saveWarehouse({ id: newId(), name: name.trim(), type, ...(type === 'van' && repId ? { repId } : {}) }); return true; }, 'تمت إضافة المخزن ✓'); if (r) onClose(); }}>إضافة</Button></>}>
      <div className="col">
        <Field label="اسم المخزن">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مخزن الفرع الغربي" data-autofocus />}</Field>
        <Field label="النوع">{(id) => <SelectInput id={id} value={type} onChange={(e) => setType(e.target.value as WarehouseType)}>{(Object.keys(WAREHOUSE_TYPE_LABELS) as WarehouseType[]).map((t) => <option key={t} value={t}>{WAREHOUSE_TYPE_LABELS[t]}</option>)}</SelectInput>}</Field>
        {type === 'van' && <Field label="المندوب صاحب السيارة" hint="يُختار تلقائيًا عند إنشاء طلباته">{(id) => <SelectInput id={id} value={repId} onChange={(e) => setRepId(e.target.value)}>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</SelectInput>}</Field>}
      </div>
    </Modal>
  );
}
