// v1.0.1 — for the Returns & voids spec: an invoice sold on credit, the
// customer's account, returns as the API returns them, and voided invoices.
import { CustomerAccount } from '../../api/models/customer-account';
import { Invoice } from '../../api/models/invoice';
import { InvoiceLine } from '../../api/models/invoice-line';
import { SalesReturn } from '../../api/models/sales-return';
import { COMPLETED, SOK_ACCOUNT } from '../sell/sell-testing';

export const RETURN_URL = '/api/sales/returns/';

const line = (l: Partial<InvoiceLine> & Pick<InvoiceLine, 'id' | 'product_code'>): InvoiceLine => ({
  product: l.id,
  product_name: '',
  unit_name: 'Piece',
  quantity: '1.00',
  unit_price: '0.00',
  discount_type: '',
  discount_value: '0.00',
  net_price: '0.00',
  line_total: '0.00',
  quote_line: null,
  unit_cost: null,
  qty_returned: '0.00',
  product_short_name: '',
  warranty_months: 0,
  ...l,
});

/**
 * Sok Shop's invoice of 27 Sep: twelve spanner sets, a drill already returned,
 * and 10.5 m of wire — $0.85 × 10.5 is $8.925, which the server rounds half to
 * even, to $8.92.
 */
export const SOLD: Invoice = {
  ...COMPLETED,
  id: 120,
  number: 'INV-20260927001',
  customer: 2,
  customer_name: 'Sok Shop',
  walk_in_name: '',
  price_tier: 'WHOLESALE',
  seller: 2,
  seller_name: 'Sokha Chan',
  sale_date: '2026-09-27T03:00:00Z',
  total: '383.92',
  on_credit: '383.92',
  paid_now: '0.00',
  tenders: [],
  lines: [
    line({
      id: 501,
      product_code: 'TL-0241',
      product_name: 'Combination spanner set, 14 piece',
      unit_name: 'Set',
      quantity: '12.00',
      unit_price: '25.50',
      net_price: '25.50',
      line_total: '306.00',
    }),
    line({
      id: 502,
      product_code: 'TL-0101',
      product_name: 'Impact drill 13mm 710W',
      unit_price: '69.00',
      net_price: '69.00',
      line_total: '69.00',
      qty_returned: '1.00',
    }),
    line({
      id: 503,
      product_code: 'EL-0025',
      product_name: 'Electric wire 2.5mm',
      unit_name: 'Metre',
      quantity: '10.50',
      unit_price: '0.85',
      net_price: '0.85',
      line_total: '8.92',
    }),
  ],
};

/** Sok Shop still owes $20 on that invoice. */
export const SOK_OWES_20: CustomerAccount = {
  ...SOK_ACCOUNT,
  open_invoices: [
    {
      id: 120,
      number: 'INV-20260927001',
      sale_date: '2026-09-27T03:00:00Z',
      due_date: '2026-10-27',
      on_credit: '383.92',
      paid: '363.92',
      credited: '0.00',
      balance: '20.00',
      overdue: false,
    },
  ],
};

const spannersBack = (quantity: string, total: string) => ({
  id: 1,
  invoice_line: 501,
  product_code: 'TL-0241',
  product_name: 'Combination spanner set, 14 piece',
  sold: '12.00',
  quantity,
  fit_to_sell: true,
  unit_price: '25.50',
  line_total: total,
});

const ret = (r: Partial<SalesReturn> & Pick<SalesReturn, 'id' | 'number'>): SalesReturn => ({
  invoice: 120,
  invoice_number: 'INV-20260927001',
  customer: 2,
  customer_name: 'Sok Shop',
  return_date: '2026-10-06',
  reason: 'Over-ordered, 2 sets back',
  refund_method: '',
  status: 'DRAFT',
  draft_total: '51.00',
  total: '0.00',
  credited: '0.00',
  refunded: '0.00',
  posted_at: null,
  lines: [spannersBack('2.00', '51.00')],
  ...r,
});

export const RETURN_DRAFT = ret({ id: 19, number: 'RTN-000019' });

/** $51 back: $20 off what the invoice owed, $31 refunded in cash. */
export const RETURN_POSTED = ret({
  id: 18,
  number: 'RTN-000018',
  return_date: '2026-10-03',
  status: 'POSTED',
  refund_method: 'CASH',
  total: '51.00',
  credited: '20.00',
  refunded: '31.00',
  posted_at: '2026-10-03T04:00:00Z',
});

/** One set back, all of it off what the invoice owed. */
export const RETURN_CREDITED = ret({
  id: 17,
  number: 'RTN-000017',
  return_date: '2026-10-02',
  reason: 'Faulty on arrival',
  status: 'POSTED',
  total: '25.50',
  credited: '25.50',
  posted_at: '2026-10-02T04:00:00Z',
  lines: [{ ...spannersBack('1.00', '25.50'), fit_to_sell: false }],
});

/** Rung up twice: voided by an Admin the same morning. */
export const VOIDED: Invoice = {
  ...COMPLETED,
  id: 142,
  number: 'INV-20261001002',
  status: 'VOID',
  seller: 2,
  seller_name: 'Sokha Chan',
  sale_date: '2026-10-01T02:14:00Z',
  void_reason: 'Rung up twice by mistake',
  voided_at: '2026-10-01T02:30:00Z',
  voided_by_name: 'Bopha Ly',
};
