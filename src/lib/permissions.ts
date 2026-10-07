import type { Role } from '../data/types';

export type Perm =
  | 'dashboard'
  | 'customers.view'
  | 'customers.edit'
  | 'orders.view'
  | 'orders.create'
  | 'orders.manage'
  | 'orders.approve_credit'
  | 'products.view'
  | 'products.edit'
  | 'inventory.view'
  | 'inventory.edit'
  | 'collections.view'
  | 'collections.create'
  | 'collections.void'
  | 'reps.view'
  | 'reps.edit'
  | 'zones.view'
  | 'zones.edit'
  | 'offers.view'
  | 'offers.edit'
  | 'reports.view'
  | 'settings.view'
  | 'team.manage';

const ALL: Perm[] = [
  'dashboard', 'customers.view', 'customers.edit', 'orders.view', 'orders.create', 'orders.manage', 'orders.approve_credit',
  'products.view', 'products.edit', 'inventory.view', 'inventory.edit', 'collections.view', 'collections.create',
  'collections.void', 'reps.view', 'reps.edit', 'zones.view', 'zones.edit', 'offers.view', 'offers.edit', 'reports.view',
  'settings.view', 'team.manage',
];

const MAP: Record<Role, Perm[]> = {
  owner: ALL,
  manager: ALL,
  rep: [
    'dashboard', 'customers.view', 'customers.edit', 'orders.view', 'orders.create', 'products.view', 'inventory.view',
    'collections.view', 'collections.create', 'reps.view', 'zones.view', 'offers.view',
  ],
  storekeeper: [
    'dashboard', 'customers.view', 'orders.view', 'orders.manage', 'products.view', 'products.edit', 'inventory.view',
    'inventory.edit', 'zones.view', 'offers.view',
  ],
  accountant: [
    'dashboard', 'customers.view', 'customers.edit', 'orders.view', 'products.view', 'collections.view', 'collections.create',
    'collections.void', 'reps.view', 'zones.view', 'offers.view', 'reports.view', 'inventory.view',
  ],
};

export const can = (role: Role | undefined, perm: Perm): boolean => !!role && MAP[role].includes(perm);
