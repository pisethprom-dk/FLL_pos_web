// v1.0.0 — for the partners specs: customers and suppliers as the API returns them.
import { Customer } from '../../api/models/customer';
import { Supplier } from '../../api/models/supplier';

export const CUSTOMER_URL = '/api/partners/customers/';
export const SUPPLIER_URL = '/api/partners/suppliers/';
export const accountUrl = (id: number) => `/api/sales/customers/${id}/account/`;

const customer = (c: Partial<Customer> & Pick<Customer, 'id' | 'code' | 'name'>): Customer => ({
  is_system: false,
  credit_status: 'NO',
  price_tier: 'WHOLESALE',
  allow_credit: false,
  credit_limit: '0.00',
  payment_terms_days: 0,
  credit_hold: false,
  is_active: true,
  display_order: 1,
  country: 'Cambodia',
  ...c,
});

export const WALK_IN = customer({
  id: 1,
  code: 'CUS-000000',
  name: 'Walk-in customer',
  is_system: true,
  price_tier: 'RETAIL',
});

export const SOK_SHOP = customer({
  id: 2,
  code: 'CUS-000001',
  name: 'Sok Shop',
  name_kh: 'ហាង សុខ',
  contact_person: 'Sok Piseth',
  phone: '012 330 441',
  allow_credit: true,
  credit_status: 'YES',
  credit_limit: '1500.00',
  payment_terms_days: 30,
});

export const DARA = customer({
  id: 3,
  code: 'CUS-000002',
  name: 'Dara Grocery',
  allow_credit: true,
  credit_status: 'HOLD',
  credit_hold: true,
  credit_limit: '1200.00',
  payment_terms_days: 30,
});

export const BOPHA = customer({ id: 4, code: 'CUS-000005', name: 'Bopha (Street 315)' });

export const CUSTOMERS = [WALK_IN, SOK_SHOP, DARA, BOPHA];

export const TOTAL_TOOLS: Supplier = {
  id: 1,
  code: 'SUP-000001',
  name: 'Total Tools (Cambodia) Co., Ltd',
  name_kh: 'តូតាល់ ធូល',
  supplier_type: 'DISTRIBUTOR',
  contact_person: 'Chan Sopheak',
  phone: '010 888 121',
  telegram: '@totaltools_kh',
  province: 'Phnom Penh',
  logo: '/media/suppliers/total.png',
  display_order: 1,
  is_active: true,
};

export const LIM_HENG: Supplier = {
  id: 2,
  code: 'SUP-000002',
  name: 'Lim Heng Import Export',
  supplier_type: 'IMPORTER',
  display_order: 2,
  is_active: true,
};
