// v1.0.1 — for the quotation specs: quotations as the API returns them, and
// products with both list prices.
import { Customer } from '../../api/models/customer';
import { ProductLookup } from '../../api/models/product-lookup';
import { Quotation } from '../../api/models/quotation';
import { QuotationLine } from '../../api/models/quotation-line';
import { BOPHA } from '../partners/partners-testing';
import { DRILL_LOOKUP, GRINDER_LOOKUP } from '../stock/stock-testing';

export const QUOTE_URL = '/api/sales/quotations/';

/** A store customer on retail prices, beside Sok Shop on wholesale. */
export const CHHAY: Customer = {
  ...BOPHA,
  id: 6,
  code: 'CUS-000006',
  name: 'Chhay Mini Mart',
  price_tier: 'RETAIL',
};

export const DRILL_PRICED: ProductLookup = {
  ...DRILL_LOOKUP,
  retail_price: '78.00',
  wholesale_price: '69.00',
  is_price_fixed: false,
};
/** A product whose price may not be discounted. */
export const GRINDER_FIXED: ProductLookup = {
  ...GRINDER_LOOKUP,
  retail_price: '59.00',
  wholesale_price: '52.00',
  is_price_fixed: true,
};

const line = (
  l: Partial<QuotationLine> & Pick<QuotationLine, 'id' | 'product'>,
): QuotationLine => ({
  product_code: 'TL-0101',
  product_name: 'Impact drill 13mm 710W',
  unit_name: 'Piece',
  quantity: '2.00',
  unit_price: '69.00',
  discount_type: '',
  discount_value: '0.00',
  net_price: '69.00',
  line_total: '138.00',
  qty_invoiced: '0.00',
  remaining: '2.00',
  ...l,
});

const quote = (q: Partial<Quotation> & Pick<Quotation, 'id' | 'number'>): Quotation => ({
  customer: 2,
  customer_name: 'Sok Shop',
  customer_phone: '012 330 441',
  customer_address: 'No 10, Street 271, Phnom Penh',
  price_tier: 'WHOLESALE',
  quote_date: '2026-10-06',
  valid_until: '2026-11-05',
  status: 'DRAFT',
  is_expired: false,
  accepted_at: null,
  terms: '',
  note: '',
  total: '138.00',
  invoiced_total: '0.00',
  remaining_total: '138.00',
  created_by_name: 'Bopha Ly',
  lines: [line({ id: 501, product: 11 })],
  ...q,
});

export const QUO_DRAFT = quote({ id: 41, number: 'QUO-20261006001' });

/** Accepted, part invoiced, and past its date. */
export const QUO_ACCEPTED = quote({
  id: 42,
  number: 'QUO-20260929001',
  quote_date: '2026-09-29',
  valid_until: '2026-10-01',
  status: 'ACCEPTED',
  is_expired: true,
  accepted_at: '2026-09-29T03:00:00Z',
  total: '183.10',
  invoiced_total: '65.55',
  remaining_total: '117.55',
  lines: [
    line({
      id: 502,
      product: 11,
      discount_type: 'PERCENT',
      discount_value: '5.00',
      net_price: '65.55',
      line_total: '131.10',
      qty_invoiced: '1.00',
      remaining: '1.00',
    }),
    line({
      id: 503,
      product: 12,
      product_code: 'TL-0118',
      product_name: 'Angle grinder 100mm 570W',
      quantity: '1.00',
      unit_price: '52.00',
      net_price: '52.00',
      line_total: '52.00',
      remaining: '1.00',
    }),
  ],
});

export const QUO_REJECTED = quote({
  id: 40,
  number: 'QUO-20260925001',
  quote_date: '2026-09-25',
  valid_until: '2026-10-25',
  status: 'REJECTED',
  note: 'Bought elsewhere',
});
