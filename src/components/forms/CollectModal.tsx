import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Check, CreditCard, Landmark, MessageCircle } from 'lucide-react';
import { useData } from '../../data/DataContext';
import { useActions, useRun } from '../../data/useActions';
import { PAYMENT_METHOD_LABELS, type Customer, type PaymentMethod } from '../../data/types';
import { fireConfetti } from '../ui/confetti';
import { receiptMessage } from '../../lib/messages';
import { openWhatsApp } from '../../lib/whatsapp';
import { Button } from '../ui/Button';
import { Field, NumInput, Segmented, TextInput } from '../ui/Fields';
import { Modal } from '../ui/Modal';
import { CustomerPicker } from './CustomerPicker';

const METHOD_ICON = { cash: Banknote, transfer: Landmark, cheque: CreditCard };

export function CollectModal({ open, onClose, customer: preset }: { open: boolean; onClose: () => void; customer?: Customer }) {
  const { company, money, currencySymbol, customerById } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const [customer, setCustomer] = useState<Customer | undefined>(preset);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ amount: number; after: number } | null>(null);

  useEffect(() => {
    if (open) {
      setCustomer(preset);
      setAmount(0);
      setMethod('cash');
      setReference('');
      setNote('');
      setDone(null);
    }
  }, [open, preset]);

  // الرصيد الحي (يتحدث بعد الحفظ)
  const live = customer ? (customerById.get(customer.id) ?? customer) : undefined;
  const after = live ? live.balance - amount : 0;
  const valid = !!live && amount > 0;
  const quick = useMemo(() => (live && live.balance > 0 ? [Math.round(live.balance / 2), live.balance].filter((v, i, a) => v > 0 && a.indexOf(v) === i) : []), [live]);

  const submit = async () => {
    if (!live || !valid) return;
    const before = live.balance;
    const res = await run(() => actions.recordCollection({ customer: live, amount, method, reference: reference || undefined, note: note || undefined }));
    if (res) {
      setDone({ amount, after: before - amount });
      fireConfetti();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? 'تم التحصيل بنجاح' : 'تسجيل تحصيل'}
      width={500}
      footer={
        done ? (
          <>
            <Button variant="wa" leading={<MessageCircle size={18} />} onClick={() => live && openWhatsApp(live.phone, company.dialCode, receiptMessage(company, live, done.amount, done.after, money))}>
              إرسال إيصال واتساب
            </Button>
            <Button variant="primary" onClick={onClose}>
              إغلاق
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button variant="success" onClick={submit} disabled={!valid} loading={busy} leading={<Check size={18} />}>
              تأكيد التحصيل
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" className="col" style={{ alignItems: 'center', textAlign: 'center', gap: '0.6rem', padding: '1rem 0' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div className="success-ring" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
              <svg viewBox="0 0 52 52" width="46" height="46">
                <motion.path d="M14 27l8 8 16-17" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45 }} />
              </svg>
            </motion.div>
            <h2 style={{ fontSize: '1.6rem' }}>{money(done.amount)}</h2>
            <p className="muted">من {live?.name}</p>
            <div className="callout ok" style={{ marginTop: 6 }}>
              {done.after > 0.005 ? `الرصيد المتبقي ${money(done.after)}` : done.after < -0.005 ? `رصيد دائن لصالح العميل ${money(-done.after)}` : 'تم سداد كامل الرصيد 🎉'}
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" className="col" style={{ gap: '1rem' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Field label="العميل">{() => <CustomerPicker value={live} onChange={setCustomer} filter={(c) => c.balance > 0} placeholder="اختر عميلًا عليه رصيد…" />}</Field>
            {live && (
              <>
                <div className="kv">
                  <div>
                    <div className="k">الرصيد المستحق</div>
                    <div className="v" style={{ color: live.balance > 0 ? 'var(--bad)' : 'var(--ok)' }}>{money(live.balance)}</div>
                  </div>
                  <div>
                    <div className="k">الرصيد بعد التحصيل</div>
                    <div className="v">{money(after)}</div>
                  </div>
                </div>
                <Field label="المبلغ المحصَّل" error={amount > live.balance + 0.005 ? 'المبلغ أكبر من الرصيد — سيتحوّل الفرق إلى رصيد دائن للعميل' : undefined}>
                  {(id) => <NumInput id={id} value={amount} onChange={setAmount} suffix={currencySymbol} data-autofocus />}
                </Field>
                {quick.length > 0 && (
                  <div className="chips">
                    {quick.map((q, i) => (
                      <button key={q} type="button" className="chip" aria-pressed={amount === q} onClick={() => setAmount(q)}>
                        {i === quick.length - 1 ? 'كامل الرصيد' : 'النصف'} • {money(q)}
                      </button>
                    ))}
                  </div>
                )}
                <Field label="طريقة الدفع">
                  {() => (
                    <Segmented
                      name="pay-method"
                      value={method}
                      onChange={setMethod}
                      options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => {
                        const I = METHOD_ICON[m];
                        return { value: m, label: <><I size={15} /> {PAYMENT_METHOD_LABELS[m]}</> };
                      })}
                    />
                  )}
                </Field>
                {method !== 'cash' && <Field label={method === 'cheque' ? 'رقم الشيك' : 'رقم الحوالة'}>{(id) => <TextInput id={id} value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" style={{ textAlign: 'start' }} />}</Field>}
                <Field label="ملاحظة (اختياري)">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
