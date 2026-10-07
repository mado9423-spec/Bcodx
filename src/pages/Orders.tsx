import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Ban, Check, ChevronLeft, Download, MessageCircle, Plus, Printer, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { OrderStatusBadge } from '../components/status';
import { Avatar, Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SearchInput, Segmented, SelectInput, TextInput, Field } from '../components/ui/Fields';
import { Drawer, Modal } from '../components/ui/Modal';
import { EmptyState, PageHeader } from '../components/ui/Misc';
import { fireConfetti } from '../components/ui/confetti';
import { useData } from '../data/DataContext';
import { useActions, useRun } from '../data/useActions';
import { ORDER_FLOW, ORDER_STATUS_LABELS, type Order, type OrderStatus } from '../data/types';
import { downloadCsv } from '../lib/csv';
import { fmtAgo, fmtDate, fmtDateTime, fmtNum } from '../lib/format';
import { printInvoice } from '../lib/invoice';
import { orderMessage } from '../lib/messages';
import { can } from '../lib/permissions';
import { DAY, startOfDay } from '../lib/time';
import { openWhatsApp } from '../lib/whatsapp';

type Tab = 'all' | OrderStatus;

function Flow({ status }: { status: OrderStatus }) {
  const idx = ORDER_FLOW.indexOf(status);
  const cancelled = status === 'cancelled';
  const hold = status === 'credit_hold';
  return (
    <div className={`flow ${cancelled ? 'cancelled' : ''}`}>
      {ORDER_FLOW.map((s, i) => {
        const done = !cancelled && !hold && i <= idx;
        const current = !cancelled && !hold && i === idx;
        return (
          <div key={s} className={`flow-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <motion.span className="flow-dot" initial={false} animate={{ scale: current ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </motion.span>
            <span className="flow-label">{ORDER_STATUS_LABELS[s]}</span>
            {i < ORDER_FLOW.length - 1 && (
              <span className="flow-line">
                <motion.i initial={false} animate={{ width: !cancelled && !hold && i < idx ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderDrawer({ order, onClose }: { order: Order | undefined; onClose: () => void }) {
  const { customerById, collections, company, money, repById, warehouseById } = useData();
  const { profile } = useAuth();
  const actions = useActions();
  const { run, busy } = useRun();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const role = profile!.role;
  const o = order;
  const customer = o ? customerById.get(o.customerId) : undefined;
  const nextStatus: OrderStatus | undefined = o ? ORDER_FLOW[ORDER_FLOW.indexOf(o.status) + 1] : undefined;
  const canManage = can(role, 'orders.manage');
  const canCancel = o && canManage && o.status !== 'delivered' && o.status !== 'cancelled';
  const canApprove = can(role, 'orders.approve_credit');

  return (
    <>
      <Drawer open={!!o} onClose={onClose} width={660} title={o ? <span className="row" style={{ gap: 10 }}>طلب <span className="ltr">#{o.no}</span></span> : ''} subtitle={o ? `${fmtDateTime(o.createdAt)} • ${fmtAgo(o.createdAt)}` : ''}>
        {o && (
          <div className="col" style={{ gap: '1.1rem' }}>
            <div className="row between wrap">
              <OrderStatusBadge status={o.status} />
              <div className="row" style={{ gap: 6 }}>
                <Button variant="wa" size="sm" leading={<MessageCircle size={16} />} onClick={() => customer && openWhatsApp(customer.phone, company.dialCode, orderMessage(company, o, money))} disabled={!customer}>واتساب</Button>
                <Button size="sm" leading={<Printer size={16} />} onClick={() => printInvoice(company, o, customer, money)}>طباعة</Button>
              </div>
            </div>

            {o.status === 'credit_hold' && (
              <div className="callout bad" style={{ flexDirection: 'column' }}>
                <div className="row"><ShieldAlert size={20} /> <b>هذا الطلب بانتظار موافقة الائتمان</b></div>
                <span style={{ fontWeight: 500 }}>تجاوز العميل حده الائتماني{customer ? ` (${money(customer.creditLimit)})` : ''}. المخزون محجوز للطلب إلى حين القرار.</span>
                {canApprove ? (
                  <div className="row" style={{ gap: 8 }}>
                    <Button variant="success" size="sm" loading={busy} leading={<ShieldCheck size={16} />} onClick={() => run(async () => { await actions.setOrderStatus(o, 'new'); fireConfetti(24); }, 'تمت الموافقة الائتمانية ✓')}>موافقة واعتماد</Button>
                    <Button variant="danger" size="sm" loading={busy} leading={<Ban size={16} />} onClick={() => run(() => actions.cancelOrder(o, 'رُفض ائتمانيًا', collections), 'تم رفض الطلب وإرجاع المخزون')}>رفض</Button>
                  </div>
                ) : (
                  <span className="xs">في انتظار قرار المدير…</span>
                )}
              </div>
            )}

            <div className="card pad" style={{ background: 'var(--surface-2)' }}>
              <Flow status={o.status} />
              {o.status === 'cancelled' && <div className="callout bad" style={{ marginTop: 12 }}><Ban size={18} /> ملغي{o.cancelReason ? ` — ${o.cancelReason}` : ''}</div>}
            </div>

            <div className="kv">
              <div><div className="k">العميل</div><div className="v" style={{ fontSize: '0.95rem' }}>{customer ? <Link to={`/customers?open=${customer.id}`}>{o.customerName}</Link> : o.customerName}</div></div>
              <div><div className="k">المندوب</div><div className="v row" style={{ fontSize: '0.95rem', gap: 6 }}><Avatar name={o.repName} size="sm" round color={repById.get(o.repId)?.color} /> {o.repName}</div></div>
              <div><div className="k">المخزن</div><div className="v" style={{ fontSize: '0.95rem' }}>{warehouseById.get(o.warehouseId)?.name ?? '—'}</div></div>
              <div><div className="k">الدفع</div><div className="v" style={{ fontSize: '0.95rem' }}>{o.paymentType === 'cash' ? 'نقدي' : `آجل • يستحق ${fmtDate(o.dueAt)}`}</div></div>
            </div>

            <div className="table-wrap card">
              <table className="table">
                <thead><tr><th>الصنف</th><th className="num">الكمية</th><th className="num">السعر</th><th className="num">الإجمالي</th></tr></thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.productId}>
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <span style={{ fontSize: '1.4rem' }}>{it.emoji}</span>
                          <span>
                            <b>{it.name}</b>
                            {it.offerName && <div className="xs" style={{ color: 'var(--c-teal)', fontWeight: 700 }}>🎁 {it.offerName}</div>}
                          </span>
                        </span>
                      </td>
                      <td className="num">{it.qty}{it.freeQty > 0 && <div className="xs" style={{ color: 'var(--c-teal)', fontWeight: 700 }}>+{it.freeQty} مجانًا</div>}</td>
                      <td className="num">{money(it.price)}</td>
                      <td className="num bold">{money(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals">
              <div><span>المجموع</span><b className="num">{money(o.subtotal)}</b></div>
              {o.lineDiscount > 0 && <div className="disc"><span>خصم الأصناف</span><b className="num">-{money(o.lineDiscount)}</b></div>}
              {o.orderDiscount > 0 && <div className="disc"><span>{o.orderOfferName ?? 'خصم الفاتورة'}</span><b className="num">-{money(o.orderDiscount)}</b></div>}
              <div className="grand"><span>الإجمالي</span><b className="num">{money(o.total)}</b></div>
              {o.paidNow > 0 && <div><span>المدفوع</span><b className="num" style={{ color: 'var(--ok)' }}>{money(o.paidNow)}</b></div>}
              {o.total - o.paidNow > 0.005 && o.status !== 'cancelled' && <div><span>المتبقي على العميل</span><b className="num" style={{ color: 'var(--bad)' }}>{money(o.total - o.paidNow)}</b></div>}
            </div>
            {o.note && <div className="callout info">{o.note}</div>}

            {canManage && o.status !== 'credit_hold' && o.status !== 'cancelled' && (
              <div className="row" style={{ gap: 8 }}>
                {nextStatus && (
                  <Button variant="primary" className="grow" loading={busy} leading={<ChevronLeft size={18} />} onClick={() => run(async () => { await actions.setOrderStatus(o, nextStatus); if (nextStatus === 'delivered') fireConfetti(30); }, `تم نقل الطلب إلى «${ORDER_STATUS_LABELS[nextStatus]}»`)}>
                    نقل إلى: {ORDER_STATUS_LABELS[nextStatus]}
                  </Button>
                )}
                {canCancel && <Button variant="danger" onClick={() => setCancelOpen(true)} leading={<Ban size={16} />}>إلغاء الطلب</Button>}
              </div>
            )}
            {o.status === 'delivered' && o.deliveredAt && <p className="muted small center">سُلِّم {fmtDateTime(o.deliveredAt)}</p>}
          </div>
        )}
      </Drawer>
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="إلغاء الطلب"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>تراجع</Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!reason.trim()}
              onClick={async () => {
                if (!o) return;
                const res = await run(() => actions.cancelOrder(o, reason.trim(), collections), (r) => (r.refund > 0 ? `تم الإلغاء. تذكّر رد ${money(r.refund)} للعميل` : 'تم إلغاء الطلب وإرجاع المخزون'));
                if (res) {
                  setCancelOpen(false);
                  setReason('');
                }
              }}
            >
              تأكيد الإلغاء
            </Button>
          </>
        }
      >
        <div className="col">
          <p className="muted">سيُعاد المخزون إلى المخزن وتُعكس القيود المحاسبية للعميل تلقائيًا.</p>
          <Field label="سبب الإلغاء">{(id) => <TextInput id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: العميل ألغى الطلب" data-autofocus />}</Field>
        </div>
      </Modal>
    </>
  );
}

export default function Orders() {
  const { orders, reps, money, orderById } = useData();
  const { profile } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = profile!.role;
  const initial = params.get('status') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && (initial === 'all' || initial in ORDER_STATUS_LABELS) ? initial : 'all');
  const [q, setQ] = useState('');
  const [rep, setRep] = useState('all');
  const [period, setPeriod] = useState<'all' | 'today' | '7' | '30'>('all');
  const openId = params.get('open');
  const opened = openId ? orderById.get(openId) : undefined;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return m;
  }, [orders]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const from = period === 'all' ? 0 : period === 'today' ? startOfDay(Date.now()) : Date.now() - Number(period) * DAY;
    return orders
      .filter((o) => (tab === 'all' || o.status === tab) && o.createdAt >= from && (rep === 'all' || o.repId === rep) && (!t || o.no.toLowerCase().includes(t) || o.customerName.toLowerCase().includes(t)))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, tab, q, rep, period]);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const exportCsv = () =>
    downloadCsv('orders', [
      ['رقم الطلب', 'التاريخ', 'العميل', 'المندوب', 'الأصناف', 'المجموع', 'الخصم', 'الإجمالي', 'المدفوع', 'الدفع', 'الحالة'],
      ...list.map((o) => [o.no, fmtDateTime(o.createdAt), o.customerName, o.repName, o.items.length, o.subtotal, o.lineDiscount + o.orderDiscount, o.total, o.paidNow, o.paymentType === 'cash' ? 'نقدي' : 'آجل', ORDER_STATUS_LABELS[o.status]]),
    ]);

  const total = list.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageHeader
        title="الطلبات"
        subtitle={`${fmtNum(list.length)} طلب • بقيمة ${money(total)}`}
        actions={
          <>
            <Button leading={<Download size={16} />} onClick={exportCsv}>تصدير CSV</Button>
            {can(role, 'orders.create') && <Button variant="primary" leading={<Plus size={18} />} onClick={() => nav('/orders/new')}>طلب جديد</Button>}
          </>
        }
      />
      <div className="toolbar">
        <SearchInput className="grow" value={q} onChange={setQ} placeholder="ابحث برقم الطلب أو اسم العميل…" />
        <SelectInput value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} style={{ width: 150 }} aria-label="الفترة">
          <option value="all">كل الفترات</option>
          <option value="today">اليوم</option>
          <option value="7">آخر 7 أيام</option>
          <option value="30">آخر 30 يومًا</option>
        </SelectInput>
        {role !== 'rep' && (
          <SelectInput value={rep} onChange={(e) => setRep(e.target.value)} style={{ width: 170 }} aria-label="المندوب">
            <option value="all">كل المندوبين</option>
            {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectInput>
        )}
      </div>
      <div style={{ marginBottom: '1.1rem' }}>
        <Segmented
          name="order-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'الكل', count: orders.length },
            { value: 'credit_hold', label: 'بانتظار الائتمان', count: counts.get('credit_hold') ?? 0 },
            { value: 'new', label: 'جديد', count: counts.get('new') ?? 0 },
            { value: 'approved', label: 'معتمد', count: counts.get('approved') ?? 0 },
            { value: 'preparing', label: 'قيد التجهيز', count: counts.get('preparing') ?? 0 },
            { value: 'delivered', label: 'مسلَّم', count: counts.get('delivered') ?? 0 },
            { value: 'cancelled', label: 'ملغي', count: counts.get('cancelled') ?? 0 },
          ]}
        />
      </div>
      <div className="card">
        {list.length === 0 ? (
          <EmptyState icon="🧾" title="لا طلبات مطابقة" text="غيّر الفلاتر أو أنشئ طلبًا جديدًا." action={can(role, 'orders.create') ? { label: 'طلب جديد', onClick: () => nav('/orders/new') } : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الطلب</th><th>العميل</th><th className="hide-mobile">المندوب</th><th className="hide-mobile num">الأصناف</th><th className="num">الإجمالي</th><th className="hide-mobile">الدفع</th><th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 200).map((o) => (
                  <tr key={o.id} className="click" onClick={() => setOpen(o.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o.id)}>
                    <td><b className="ltr">#{o.no}</b><div className="muted xs">{fmtAgo(o.createdAt)}</div></td>
                    <td><b>{o.customerName}</b></td>
                    <td className="hide-mobile">{o.repName}</td>
                    <td className="hide-mobile num">{o.items.length}</td>
                    <td className="num bold">{money(o.total)}</td>
                    <td className="hide-mobile">{o.paymentType === 'cash' ? <Badge tone="green">نقدي</Badge> : o.paidNow > 0 ? <Badge tone="amber">جزئي</Badge> : <Badge tone="orange">آجل</Badge>}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <OrderDrawer order={opened} onClose={() => setOpen(null)} />
    </>
  );
}
