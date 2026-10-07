import type { Company, Customer, Order } from '../data/types';
import type { Aging } from './aging';
import type { MoneyFn } from './format';
import { fmtDate } from './format';

export function statementMessage(company: Company, c: Customer, money: MoneyFn, aging?: Aging): string {
  const lines = [
    `السلام عليكم ${c.contact || c.name} 👋`,
    `كشف حساب *${c.name}* لدى *${company.name}*`,
    '',
    `💰 الرصيد المستحق: *${money(c.balance)}*`,
  ];
  if (aging && aging.overdue > 0.005) lines.push(`⚠️ منه متأخر السداد: *${money(aging.overdue)}*`);
  if (c.creditLimit > 0) lines.push(`📊 الحد الائتماني: ${money(c.creditLimit)}`);
  lines.push('', 'نرجو التكرّم بالسداد في أقرب وقت. شاكرين تعاونكم 🌷');
  return lines.join('\n');
}

export function reminderMessage(company: Company, c: Customer, money: MoneyFn, aging?: Aging): string {
  const overdue = aging?.overdue ?? 0;
  const lines = [`السلام عليكم ${c.contact || c.name}،`, `تذكير ودّي من *${company.name}*:`];
  lines.push(overdue > 0.005 ? `لديكم مبلغ متأخر قدره *${money(overdue)}* من إجمالي رصيد *${money(c.balance)}*.` : `رصيدكم المستحق *${money(c.balance)}*.`);
  if (c.promiseDate) lines.push(`وعدتمونا بالسداد بتاريخ ${fmtDate(c.promiseDate)} 🤝`);
  lines.push('يسعدنا استلام الدفعة في أقرب وقت، ولكم جزيل الشكر 🌷');
  return lines.join('\n');
}

export function receiptMessage(company: Company, c: Customer, amount: number, balanceAfter: number, money: MoneyFn): string {
  return [
    `السلام عليكم ${c.contact || c.name}،`,
    `✅ تم استلام دفعة بقيمة *${money(amount)}* لدى *${company.name}*.`,
    balanceAfter > 0.005 ? `الرصيد المتبقي: ${money(balanceAfter)}` : balanceAfter < -0.005 ? `رصيد دائن لصالحكم: ${money(-balanceAfter)}` : 'تم سداد كامل الرصيد 🎉',
    'شكرًا لتعاملكم معنا 🌷',
  ].join('\n');
}

export function orderMessage(company: Company, o: Order, money: MoneyFn): string {
  const lines = [`فاتورة *${company.name}* — طلب #${o.no}`, `العميل: ${o.customerName}`, ''];
  for (const it of o.items) lines.push(`• ${it.name} × ${it.qty}${it.freeQty ? ` (+${it.freeQty} مجانًا)` : ''} = ${money(it.lineTotal)}`);
  lines.push('');
  if (o.lineDiscount + o.orderDiscount > 0) lines.push(`خصومات: ${money(o.lineDiscount + o.orderDiscount)}`);
  lines.push(`*الإجمالي: ${money(o.total)}*`);
  lines.push(o.paymentType === 'cash' ? 'الدفع: نقدًا ✅' : o.paidNow > 0 ? `المدفوع: ${money(o.paidNow)} • المتبقي: ${money(o.total - o.paidNow)}` : `الدفع: آجل — الاستحقاق ${fmtDate(o.dueAt)}`);
  lines.push('', 'شكرًا لثقتكم 🌷');
  return lines.join('\n');
}
