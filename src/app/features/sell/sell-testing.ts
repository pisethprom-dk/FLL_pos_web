// v1.0.2 — for the till's spec: customers as the till's lookup returns them,
// an account, products with both prices, and invoices held and completed.
import { CustomerAccount } from '../../api/models/customer-account';
import { CustomerLookup } from '../../api/models/customer-lookup';
import { Invoice } from '../../api/models/invoice';
import { ProductLookup } from '../../api/models/product-lookup';
import { DRILL_PRICED } from '../quotations/quotations-testing';

export const CUSTOMER_LOOKUP_URL = '/api/partners/customers/lookup/';
export const INVOICE_URL = '/api/sales/invoices/';
export const accountOf = (id: number) => `/api/sales/customers/${id}/account/`;

export const WALK_IN_LOOKUP: CustomerLookup = {
  id: 1,
  code: 'CUS-000000',
  name: 'Walk-in customer',
  is_system: true,
  price_tier: 'RETAIL',
  credit_status: 'NO',
};
export const SOK_LOOKUP: CustomerLookup = {
  id: 2,
  code: 'CUS-000001',
  name: 'Sok Shop',
  phone: '012 330 441',
  is_system: false,
  price_tier: 'WHOLESALE',
  credit_status: 'YES',
  credit_limit: '1500.00',
  payment_terms_days: 30,
};
export const DARA_LOOKUP: CustomerLookup = {
  id: 3,
  code: 'CUS-000002',
  name: 'Dara Grocery',
  is_system: false,
  price_tier: 'WHOLESALE',
  credit_status: 'HOLD',
};

export const SOK_ACCOUNT: CustomerAccount = {
  customer: 2,
  code: 'CUS-000001',
  name: 'Sok Shop',
  credit_status: 'YES',
  credit_limit: '1500.00',
  payment_terms_days: 30,
  balance: '1030.00',
  room_left: '470.00',
  open_invoices: [],
};
export const DARA_ACCOUNT: CustomerAccount = {
  ...SOK_ACCOUNT,
  customer: 3,
  code: 'CUS-000002',
  name: 'Dara Grocery',
  credit_status: 'HOLD',
  credit_limit: '1200.00',
  balance: '1342.00',
  room_left: '0.00',
};

/** $72.29 retail: five of them come to $361.45, the backend's own change example. */
export const LEVEL: ProductLookup = {
  id: 31,
  code: 'TL-0283',
  barcode: '8850000000283',
  name: 'Spirit level 600mm',
  brand_name: 'Total',
  category_name: 'Measuring',
  unit_name: 'Piece',
  qty_on_hand: '9.00',
  retail_price: '72.29',
  wholesale_price: '65.00',
  is_price_fixed: false,
  track_stock: true,
};
export { DRILL_PRICED };

const invoice = (i: Partial<Invoice> & Pick<Invoice, 'id' | 'status'>): Invoice => ({
  number: null,
  customer: 1,
  customer_name: 'Walk-in customer',
  walk_in_name: '',
  walk_in_phone: '',
  price_tier: 'RETAIL',
  quotation: null,
  quotation_number: null,
  hold_label: '',
  seller: null,
  seller_name: null,
  sale_date: null,
  exchange_rate: null,
  held_total: '361.45',
  total: '0.00',
  total_khr: null,
  discount_total: '0.00',
  paid_now: '0.00',
  on_credit: '0.00',
  change_due: '0.00',
  change_usd: '0.00',
  change_khr: '0',
  rounding: '0.00',
  due_date: null,
  cost_total: null,
  profit: null,
  void_reason: '',
  voided_at: null,
  voided_by_name: null,
  tenders: [],
  lines: [
    {
      id: 951,
      product: 31,
      product_code: 'TL-0283',
      product_name: 'Spirit level 600mm',
      unit_name: 'Piece',
      quantity: '5.00',
      unit_price: '72.29',
      discount_type: '',
      discount_value: '0.00',
      net_price: '72.29',
      line_total: '361.45',
      quote_line: null,
      unit_cost: null,
      qty_returned: '0.00',
      product_short_name: 'Spirit level 600mm',
      warranty_months: 0,
    },
  ],
  ...i,
});

/** Created by Complete, the moment before it is completed. */
export const HELD = invoice({ id: 900, status: 'HELD' });

/** Held on purpose, under a label. */
export const HELD_LABELLED = invoice({
  id: 901,
  status: 'HELD',
  hold_label: 'Blue pickup',
  walk_in_name: 'Dara',
});

/** $361.45 paid with $400: change $38 and ៛2,300. */
export const COMPLETED = invoice({
  id: 900,
  status: 'COMPLETED',
  number: 'INV-20261006001',
  walk_in_name: 'Dara',
  sale_date: '2026-10-06T03:00:00Z',
  exchange_rate: '4100.000000',
  total: '361.45',
  total_khr: '1481900',
  paid_now: '361.45',
  change_due: '38.55',
  change_usd: '38.00',
  change_khr: '2300',
  rounding: '-0.01',
  tenders: [{ kind: 'CASH', currency: 'USD', amount: '400.00', amount_usd: '400.00' }],
});
