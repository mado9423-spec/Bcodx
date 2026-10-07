import { useEffect, useState } from 'react';
import { useData } from '../../data/DataContext';
import { useActions, useRun } from '../../data/useActions';
import { PRICE_LIST_LABELS, type PriceList, type Product } from '../../data/types';
import { newId } from '../../lib/ids';
import { fmtPct } from '../../lib/format';
import { Button } from '../ui/Button';
import { Field, NumInput, Switch, TextInput } from '../ui/Fields';
import { Modal } from '../ui/Modal';

const EMOJIS = ['💧', '🧃', '🥤', '☕', '🍵', '🍚', '🍬', '🌻', '🍝', '🌾', '🐟', '🥛', '🫘', '🥔', '🍪', '🍫', '🥜', '🧴', '🧽', '🧺', '🧻', '🍞', '🥫', '🧈', '🍯', '🍼', '🧂', '📦'];

export function ProductForm({ open, onClose, product }: { open: boolean; onClose: () => void; product?: Product }) {
  const { products, warehouses, currencySymbol } = useData();
  const actions = useActions();
  const { run, busy } = useRun();
  const blank = (): Product => ({ id: newId(), name: '', sku: `BX-${1000 + products.length * 7 + 13}`, category: '', unit: 'كرتون', emoji: '📦', cost: 0, prices: { wholesale: 0, semi: 0, retail: 0 }, minStock: 10, active: true });
  const [p, setP] = useState<Product>(blank);
  const [initial, setInitial] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setP(product ? { ...product, prices: { ...product.prices } } : blank());
      setInitial(0);
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);
  const cats = [...new Set(products.map((x) => x.category))];
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((s) => ({ ...s, [k]: v }));
  const setPrice = (k: PriceList, v: number) => setP((s) => ({ ...s, prices: { ...s.prices, [k]: v } }));
  const errs = { name: !p.name.trim(), category: !p.category.trim(), price: p.prices.wholesale <= 0 };
  const margin = p.prices.wholesale > 0 ? ((p.prices.wholesale - p.cost) / p.prices.wholesale) * 100 : 0;
  const sym = currencySymbol;

  const save = async () => {
    setTouched(true);
    if (errs.name || errs.category || errs.price) return;
    const main = warehouses.find((w) => w.type === 'main') ?? warehouses[0];
    const ok = await run(async () => {
      await actions.saveProduct({ ...p, name: p.name.trim(), category: p.category.trim() });
      if (!product && initial > 0 && main) await actions.receiveStock(main.id, [{ productId: p.id, qty: initial }], 'رصيد افتتاحي');
      return true;
    }, product ? 'تم تحديث المنتج' : 'تمت إضافة المنتج ✓');
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'تعديل منتج' : 'منتج جديد'} width={680} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button variant="primary" onClick={save} loading={busy}>{product ? 'حفظ' : 'إضافة المنتج'}</Button></>}>
      <div className="form-grid">
        <Field label="اسم المنتج" className="full" error={touched && errs.name ? 'مطلوب' : undefined}>{(id) => <TextInput id={id} value={p.name} onChange={(e) => set('name', e.target.value)} invalid={touched && errs.name} data-autofocus />}</Field>
        <Field label="الأيقونة" className="full">
          {() => (
            <div className="emoji-pick">
              {EMOJIS.map((e) => <button key={e} type="button" aria-pressed={p.emoji === e} onClick={() => set('emoji', e)}>{e}</button>)}
            </div>
          )}
        </Field>
        <Field label="الفئة" error={touched && errs.category ? 'مطلوبة' : undefined}>
          {(id) => (
            <>
              <TextInput id={id} list="cat-list" value={p.category} onChange={(e) => set('category', e.target.value)} invalid={touched && errs.category} placeholder="مثال: مشروبات" />
              <datalist id="cat-list">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="وحدة البيع">{(id) => <TextInput id={id} value={p.unit} onChange={(e) => set('unit', e.target.value)} placeholder="كرتون / كيس / حبة" />}</Field>
        <Field label="رمز الصنف (SKU)">{(id) => <TextInput id={id} value={p.sku} onChange={(e) => set('sku', e.target.value)} dir="ltr" style={{ textAlign: 'start' }} />}</Field>
        <Field label="حد إعادة الطلب" hint="يظهر تنبيه عند الوصول إليه">{(id) => <NumInput id={id} value={p.minStock} onChange={(v) => set('minStock', Math.round(v))} decimals={0} />}</Field>
        <Field label="التكلفة">{(id) => <NumInput id={id} value={p.cost} onChange={(v) => set('cost', v)} suffix={sym} />}</Field>
        <div />
        {(Object.keys(PRICE_LIST_LABELS) as PriceList[]).map((k) => (
          <Field key={k} label={`سعر ${PRICE_LIST_LABELS[k]}`} error={k === 'wholesale' && touched && errs.price ? 'مطلوب' : undefined}>{(id) => <NumInput id={id} value={p.prices[k]} onChange={(v) => setPrice(k, v)} suffix={sym} invalid={k === 'wholesale' && touched && errs.price} />}</Field>
        ))}
        <div className="callout info full" style={{ background: margin < 0 ? 'var(--bad-bg)' : undefined, color: margin < 0 ? 'var(--bad)' : undefined }}>
          هامش الربح على سعر الجملة: <b>{fmtPct(margin, 1)}</b> {margin < 0 && '— السعر أقل من التكلفة!'}
        </div>
        {!product && <Field label="كمية افتتاحية في المخزن الرئيسي (اختياري)" className="full">{(id) => <NumInput id={id} value={initial} onChange={(v) => setInitial(Math.round(v))} decimals={0} />}</Field>}
        {product && (
          <div className="row between full">
            <b className="small">المنتج متاح للبيع</b>
            <Switch checked={p.active} onChange={(v) => set('active', v)} label="متاح" />
          </div>
        )}
      </div>
    </Modal>
  );
}
