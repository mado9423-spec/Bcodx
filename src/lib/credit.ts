import type { Customer } from '../data/types';
import type { Aging } from './aging';

export interface CreditCheck {
  limit: number;
  projected: number;
  available: number;
  usage: number;
  exceeds: boolean;
}

/** newDebt = قيمة الدين الجديد الذي سيُضاف على العميل بهذا الطلب */
export function creditCheck(customer: Pick<Customer, 'balance' | 'creditLimit'>, newDebt: number): CreditCheck {
  const limit = customer.creditLimit;
  const projected = customer.balance + Math.max(0, newDebt);
  const available = Math.max(0, limit - customer.balance);
  const usage = limit > 0 ? projected / limit : projected > 0 ? Infinity : 0;
  return { limit, projected, available, usage, exceeds: projected > limit + 0.005 };
}

export type Health = 'clear' | 'ok' | 'near' | 'overdue' | 'exceeded';

export const HEALTH_META: Record<Health, { label: string; tone: 'green' | 'blue' | 'amber' | 'orange' | 'red' }> = {
  clear: { label: 'لا ديون', tone: 'green' },
  ok: { label: 'ضمن الحد', tone: 'blue' },
  near: { label: 'قارب الحد', tone: 'amber' },
  overdue: { label: 'متأخر السداد', tone: 'orange' },
  exceeded: { label: 'تجاوز الحد', tone: 'red' },
};

export function customerHealth(c: Pick<Customer, 'balance' | 'creditLimit'>, aging?: Aging): Health {
  if (c.balance <= 0.005) return 'clear';
  if (c.creditLimit > 0 && c.balance > c.creditLimit + 0.005) return 'exceeded';
  if (aging && aging.overdue > 0.005) return 'overdue';
  if (c.creditLimit > 0 && c.balance >= c.creditLimit * 0.8) return 'near';
  return 'ok';
}
