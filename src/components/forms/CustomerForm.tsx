import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useData } from '../../data/DataContext';
import { useActions, useRun } from '../../data/useActions';
import { PRICE_LIST_LABELS, type Customer, type PriceList } from '../../data/types';
import { newId } from '../../lib/ids';
import { Button } from '../ui/Button';
import { Field, NumInput, SelectInput, Segmented, Switch, TextArea, TextInput } from '../ui/Fields';
import { Modal } from '../ui/Modal';

export function CustomerForm({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer?: Customer; onSaved?: (c: Customer) => void }) {
  const { zones, reps, company, currencySymbol } = useData();
  const { profile } = useAuth();
  const canSetCredit = profile?.role !== 'rep';
  const actions = useActions();
  const { run, busy } = useRun();
  const blank = (): Customer => ({
    id: newId(), name: '', contact: '', phone: '', address: '', zoneId: zones[0]?.id ?? '', repId: reps.find((r) => r.zoneIds.includes(zones[0]?.id ?? ''))?.id ?? reps[0]?.id ?? '',
    priceList: 'wholesale', creditLimit: canSetCredit ? 10000 : 0, creditDays: company.defaultCreditDays, balance: 0, active: true, createdAt: Date.now(),
  });
  const [c, setC] = useState<Customer>(blank);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setC(customer ? { ...customer } : blank());
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setC((p) => ({ ...p, [k]: v }));
  const errors = { name: !c.name.trim() ? 'اسم العميل مطلوب' : '', phone: !c.phone.trim() ? 'رقم الجوال مطلوب (لواتساب)' : '' };
  const invalid = Boolean(errors.name || errors.phone);

  const save = async () => {
    setTouched(true);
    if (invalid) return;
    const ok = await run(async () => {
      await (customer ? actions.saveCustomer(c) : actions.createCustomer(c));
      return true;
    }, customer ? 'تم تحديث بيانات العميل' : 'تمت إضافة العميل ✓');
    if (ok) {
      onSaved?.(c);
      onClose();
    }
  };

  const onZone = (zoneId: string) => {
    set('zoneId', zoneId);
    if (!customer) {
      const rep = reps.find((r) => r.zoneIds.includes(zoneId));
      if (rep) setC((p) => ({ ...p, zoneId, repId: rep.id }));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'تعديل بيانات العميل' : 'عميل جديد'}
      width={680}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={save} loading={busy}>{customer ? 'حفظ التغييرات' : 'إضافة العميل'}</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="اسم المنشأة" error={touched ? errors.name : undefined} className="full">{(id) => <TextInput id={id} value={c.name} onChange={(e) => set('name', e.target.value)} invalid={touched && !!errors.name} placeholder="مثال: سوبرماركت النور" data-autofocus />}</Field>
        <Field label="اسم المسؤول">{(id) => <TextInput id={id} value={c.contact} onChange={(e) => set('contact', e.target.value)} />}</Field>
        <Field label="رقم الجوال" error={touched ? errors.phone : undefined}>{(id) => <TextInput id={id} value={c.phone} onChange={(e) => set('phone', e.target.value)} invalid={touched && !!errors.phone} inputMode="tel" dir="ltr" style={{ textAlign: 'start' }} placeholder="05xxxxxxxx" />}</Field>
        <Field label="العنوان" className="full">{(id) => <TextInput id={id} value={c.address} onChange={(e) => set('address', e.target.value)} />}</Field>
        <Field label="منطقة التوزيع">
          {(id) => (
            <SelectInput id={id} value={c.zoneId} onChange={(e) => onZone(e.target.value)}>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label="المندوب المسؤول">
          {(id) => (
            <SelectInput id={id} value={c.repId} onChange={(e) => set('repId', e.target.value)}>
              {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label="قائمة الأسعار" className="full">
          {() => <Segmented name="pl" value={c.priceList} onChange={(v: PriceList) => set('priceList', v)} options={(Object.keys(PRICE_LIST_LABELS) as PriceList[]).map((k) => ({ value: k, label: PRICE_LIST_LABELS[k] }))} />}
        </Field>
        {canSetCredit ? (
          <>
            <Field label="الحد الائتماني" hint="الحد الأقصى للدين المسموح قبل طلب موافقة المدير">{(id) => <NumInput id={id} value={c.creditLimit} onChange={(v) => set('creditLimit', v)} suffix={currencySymbol} />}</Field>
            <Field label="مدة الائتمان (أيام)" hint="تاريخ استحقاق الفاتورة الآجلة">{(id) => <NumInput id={id} value={c.creditDays} onChange={(v) => set('creditDays', Math.round(v))} decimals={0} suffix="يوم" />}</Field>
          </>
        ) : (
          <div className="callout info full">الحد الائتماني ومدة الائتمان يحددهما المدير. الطلبات الآجلة لهذا العميل ستحتاج موافقة ائتمان حتى يُحدَّد حده.</div>
        )}
        <Field label="ملاحظات" className="full">{(id) => <TextArea id={id} value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="أوقات الاستلام، تعليمات خاصة…" />}</Field>
        {customer && (
          <div className="row between full">
            <b className="small">العميل نشط</b>
            <Switch checked={c.active} onChange={(v) => set('active', v)} label="نشط" />
          </div>
        )}
      </div>
    </Modal>
  );
}
