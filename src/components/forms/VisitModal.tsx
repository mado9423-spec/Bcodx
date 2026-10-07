import { useEffect, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { useActions, useRun } from '../../data/useActions';
import { VISIT_RESULT_LABELS, type Customer, type VisitResult } from '../../data/types';
import { Button } from '../ui/Button';
import { Field, Switch, TextInput } from '../ui/Fields';
import { Modal } from '../ui/Modal';

const ICONS: Record<VisitResult, string> = { order: '🧾', collected: '💰', no_order: '🤝', closed: '🔒' };

function getCoords(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      () => resolve(undefined),
      { timeout: 6000, maximumAge: 60000 },
    );
  });
}

export function VisitModal({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: Customer | undefined }) {
  const actions = useActions();
  const { zoneById } = useData();
  const { run, busy } = useRun();
  const [result, setResult] = useState<VisitResult>('order');
  const [note, setNote] = useState('');
  const [geo, setGeo] = useState(true);
  useEffect(() => {
    if (open) {
      setResult('order');
      setNote('');
    }
  }, [open]);
  if (!customer) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تسجيل زيارة"
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              const ok = await run(async () => {
                const coords = geo ? await getCoords() : undefined;
                await actions.logVisit({ customer, result, note: note || undefined, coords });
                return true;
              }, 'تم تسجيل الزيارة ✓');
              if (ok) onClose();
            }}
          >
            حفظ الزيارة
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: '1rem' }}>
        <div>
          <b>{customer.name}</b>
          <div className="muted small">{zoneById.get(customer.zoneId)?.name} • {customer.address}</div>
        </div>
        <Field label="نتيجة الزيارة">
          {() => (
            <div className="visit-grid">
              {(Object.keys(VISIT_RESULT_LABELS) as VisitResult[]).map((r) => (
                <button key={r} type="button" className="role-chip" aria-pressed={result === r} onClick={() => setResult(r)} style={result === r ? { borderColor: 'var(--brand)', background: 'var(--brand-50)' } : undefined}>
                  <b>{ICONS[r]} {VISIT_RESULT_LABELS[r]}</b>
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="ملاحظة (اختياري)">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: يطلب عرضًا على المشروبات" />}</Field>
        <div className="row between">
          <span className="row" style={{ gap: 8 }}><LocateFixed size={18} color="var(--brand)" /> <b className="small">إرفاق موقعي الحالي</b></span>
          <Switch checked={geo} onChange={setGeo} label="إرفاق الموقع" />
        </div>
      </div>
    </Modal>
  );
}
