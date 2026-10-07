import { ORDER_STATUS_LABELS, type OrderStatus } from '../data/types';
import { HEALTH_META, type Health } from '../lib/credit';
import { Badge, type Tone } from './ui/Badge';

const ORDER_TONE: Record<OrderStatus, Tone> = {
  credit_hold: 'red',
  new: 'blue',
  approved: 'violet',
  preparing: 'amber',
  delivered: 'green',
  cancelled: 'gray',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_TONE[status]} dot pulse={status === 'credit_hold' || status === 'new'}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function HealthBadge({ health }: { health: Health }) {
  const m = HEALTH_META[health];
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}
