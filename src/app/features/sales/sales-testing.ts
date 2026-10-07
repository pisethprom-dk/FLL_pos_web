// v1.0.0 — for the Sales spec: sales as the invoice list returns them, and
// the staff an Admin can filter by.
import { Invoice } from '../../api/models/invoice';
import { User } from '../../api/models/user';
import { today } from '../../shared/dates';
import { COMPLETED } from '../sell/sell-testing';

export const USERS_URL = '/api/users/';

/** Sokha Chan (the Seller fixture, id 2) sold this this morning: $361.45 cash. */
export const SELLER_TODAY: Invoice = {
  ...COMPLETED,
  id: 900,
  seller: 2,
  seller_name: 'Sokha Chan',
  sale_date: `${today()}T10:15:00`,
};

/** Sold to Sok Shop by Bopha Ly (the Admin fixture) from a quotation: part cash, part credit. */
export const ADMIN_CREDIT: Invoice = {
  ...COMPLETED,
  id: 901,
  number: 'INV-20261006002',
  customer: 2,
  customer_name: 'Sok Shop',
  walk_in_name: '',
  price_tier: 'WHOLESALE',
  quotation: 77,
  quotation_number: 'QUO-20261001001',
  seller: 1,
  seller_name: 'Bopha Ly',
  sale_date: '2026-10-06T04:30:00Z',
  total: '325.00',
  total_khr: '1332500',
  discount_total: '0.00',
  paid_now: '100.00',
  on_credit: '225.00',
  due_date: '2026-11-05',
  change_due: '0.00',
  change_usd: '0.00',
  change_khr: '0',
  rounding: '0.00',
  cost_total: '262.00',
  profit: '63.00',
  tenders: [
    { kind: 'CASH', currency: 'USD', amount: '100.00', amount_usd: '100.00', reference: '' },
    { kind: 'CREDIT', currency: 'USD', amount: '225.00', amount_usd: '225.00', reference: '' },
  ],
  lines: [
    {
      ...COMPLETED.lines![0],
      id: 961,
      quantity: '5.00',
      unit_price: '65.00',
      net_price: '65.00',
      line_total: '325.00',
    },
  ],
};

const user = (u: Pick<User, 'id' | 'username' | 'full_name'> & Partial<User>): User => ({
  role: 'SELLER',
  is_active: true,
  must_change_password: false,
  created_at: '2026-08-01T01:00:00Z',
  last_login_at: null,
  ...u,
});

export const STAFF: User[] = [
  user({ id: 1, username: 'bopha', full_name: 'Bopha Ly', role: 'ADMIN' }),
  user({ id: 2, username: 'sokha', full_name: 'Sokha Chan' }),
];
