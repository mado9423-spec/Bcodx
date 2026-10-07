import type { Company, Customer, Order } from '../data/types';
import type { MoneyFn } from './format';
import { fmtDateTime, fmtDate } from './format';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** يفتح نافذة طباعة نظيفة للفاتورة (بدون الاعتماد على تنسيق التطبيق) */
export function printInvoice(company: Company, order: Order, customer: Customer | undefined, money: MoneyFn) {
  const rows = order.items
    .map(
      (it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name)}${it.offerName ? `<div class="s">🎁 ${esc(it.offerName)}</div>` : ''}</td><td class="n">${it.qty}${it.freeQty ? ` <span class="s">(+${it.freeQty} مجانًا)</span>` : ''}</td><td class="n">${money(it.price)}</td><td class="n">${it.discount ? money(it.discount) : '—'}</td><td class="n b">${money(it.lineTotal)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${esc(order.no)}</title>
<style>
*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;padding:28px;color:#1b1740;font-size:13px}
.h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6d4aff;padding-bottom:14px;margin-bottom:16px}
h1{margin:0;font-size:22px;color:#4a2bd1}.s{font-size:11px;color:#777}.b{font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#f1eeff;text-align:right;padding:8px;font-size:12px}
td{padding:8px;border-bottom:1px solid #e6e2f7}.n{text-align:left;direction:ltr;white-space:nowrap}
.t{margin-top:16px;margin-inline-start:auto;width:280px}.t div{display:flex;justify-content:space-between;padding:5px 0}
.t .g{border-top:2px solid #6d4aff;font-size:16px;font-weight:800;margin-top:6px;padding-top:8px}
.f{margin-top:28px;text-align:center;color:#777;font-size:11px}
@media print{body{padding:0}}
</style></head><body>
<div class="h"><div><h1>${esc(company.name)}</h1><div class="s">${esc(company.phone ?? '')}</div></div>
<div style="text-align:left"><div class="b">فاتورة #${esc(order.no)}</div><div class="s">${fmtDateTime(order.createdAt)}</div><div class="s">${order.paymentType === 'cash' ? 'نقدي' : `آجل — يستحق ${fmtDate(order.dueAt)}`}</div></div></div>
<div><b>العميل:</b> ${esc(order.customerName)}${customer?.phone ? ` — <span dir="ltr">${esc(customer.phone)}</span>` : ''}<br><span class="s">المندوب: ${esc(order.repName)}</span></div>
<table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
<div class="t"><div><span>المجموع</span><span>${money(order.subtotal)}</span></div>
${order.lineDiscount ? `<div><span>خصم الأصناف</span><span>-${money(order.lineDiscount)}</span></div>` : ''}
${order.orderDiscount ? `<div><span>${esc(order.orderOfferName ?? 'خصم الفاتورة')}</span><span>-${money(order.orderDiscount)}</span></div>` : ''}
<div class="g"><span>الإجمالي</span><span>${money(order.total)}</span></div>
${order.paidNow ? `<div><span>المدفوع</span><span>${money(order.paidNow)}</span></div><div><span>المتبقي</span><span>${money(order.total - order.paidNow)}</span></div>` : ''}</div>
${order.note ? `<p class="s">ملاحظة: ${esc(order.note)}</p>` : ''}
<div class="f">شكرًا لتعاملكم معنا — Bhub</div>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`;
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
