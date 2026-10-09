// v1.0.0 — for the payment specs: rates, a customer's open invoices, and
// payments as the API returns them.
import { CustomerAccount } from '../../api/models/customer-account';
import { CustomerPayment } from '../../api/models/customer-payment';
import { ExchangeRate } from '../../api/models/exchange-rate';
import { OpenInvoice } from '../../api/models/open-invoice';
import { SOK_ACCOUNT } from '../sell/sell-testing';

export const PAYMENT_URL = '/api/sales/payments/';
export const RATES_URL = '/api/company/exchange-rates/';

const rate = (id: number, effective_date: string, value: string): ExchangeRate => ({
  id,
  effective_date,
  rate: value,
  is_in_use: false,
  set_by: 'Bopha Ly',
  created_at: `${effective_date}T01:00:00Z`,
});

/** ៛4,100 from 1 Sep, ៛4,000 from 5 Oct. */
export const RATES: ExchangeRate[] = [
  rate(2, '2026-10-05', '4000.000000'),
  rate(1, '2026-09-01', '4100.000000'),
];

const owed = (
  i: Partial<OpenInvoice> & Pick<OpenInvoice, 'id' | 'number' | 'balance'>,
): OpenInvoice => ({
  sale_date: '2026-09-01T03:00:00Z',
  due_date: '2026-10-01',
  on_credit: i.balance,
  paid: '0.00',
  credited: '0.00',
  overdue: false,
  ...i,
});

/** Sok Shop owes $1,030 on three invoices, oldest due first; the first is overdue. */
export const SOK_OWING: CustomerAccount = {
  ...SOK_ACCOUNT,
  open_invoices: [
    owed({
      id: 101,
      number: 'INV-20260901001',
      balance: '300.00',
      due_date: '2026-09-15',
      overdue: true,
    }),
    owed({ id: 102, number: 'INV-20260920001', balance: '250.00', due_date: '2026-10-20' }),
    owed({ id: 103, number: 'INV-20261006001', balance: '480.00', due_date: '2026-11-05' }),
  ],
};

const payment = (
  p: Partial<CustomerPayment> & Pick<CustomerPayment, 'id' | 'number'>,
): CustomerPayment => ({
  customer: 2,
  customer_name: 'Sok Shop',
  payment_date: '2026-10-06',
  tender: 'CASH',
  currency: 'USD',
  amount_tendered: '500.00',
  exchange_rate: null,
  amount: '500.00',
  reference: '',
  note: '',
  status: 'POSTED',
  taken_by_name: 'Bopha Ly',
  void_reason: '',
  voided_at: null,
  voided_by_name: null,
  allocations: [
    { invoice: 101, invoice_number: 'INV-20260901001', amount: '300.00' },
    { invoice: 102, invoice_number: 'INV-20260920001', amount: '200.00' },
  ],
  ...p,
});

export const PAY_POSTED = payment({ id: 47, number: 'PAY-000047' });

/** ៛410,000 at ៛4,100 is $100, voided since. */
export const PAY_VOID = payment({
  id: 46,
  number: 'PAY-000046',
  payment_date: '2026-09-20',
  tender: 'KHQR',
  currency: 'KHR',
  amount_tendered: '410000.00',
  exchange_rate: '4100.000000',
  amount: '100.00',
  status: 'VOID',
  void_reason: 'Entered against the wrong customer',
  voided_at: '2026-09-21T02:00:00Z',
  voided_by_name: 'Bopha Ly',
  allocations: [{ invoice: 101, invoice_number: 'INV-20260901001', amount: '100.00' }],
});
