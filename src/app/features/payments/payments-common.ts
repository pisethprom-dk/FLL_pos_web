// v1.0.0 — what the payment screens share: the tenders, the rate a riel
// payment is converted at, and filling a customer's invoices oldest first.
import { ExchangeRate } from '../../api/models/exchange-rate';
import { OpenInvoice } from '../../api/models/open-invoice';
import { PaymentTenderEnum } from '../../api/models/payment-tender-enum';
import { compare, negate, sum } from '../../shared/money/exact';

export const TENDERS: readonly { readonly value: PaymentTenderEnum; readonly label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'KHQR', label: 'KHQR' },
  { value: 'BANK', label: 'Bank transfer' },
];

export function tenderLabel(tender: PaymentTenderEnum): string {
  return TENDERS.find((t) => t.value === tender)?.label ?? tender;
}

/**
 * The rate in use on `date`: the latest one set on or before it, as the
 * backend's rate_on() reads it. Null before the first rate.
 */
export function rateOn(rates: readonly ExchangeRate[], date: string): string | null {
  let best: ExchangeRate | null = null;
  for (const rate of rates) {
    if (rate.effective_date <= date && (!best || rate.effective_date > best.effective_date)) {
      best = rate;
    }
  }
  return best?.rate ?? null;
}

/** One open invoice in the payment dialog: ticked or not, and what is applied to it. */
export interface Applying {
  readonly invoice: OpenInvoice;
  readonly ticked: boolean;
  /** Dollars, as typed. */
  readonly amount: string;
}

/**
 * Applies `usd` to `invoices` in the order given — the account lists them
 * oldest due first, the order the server itself applies a payment in.
 */
export function fillOldest(usd: string | null, invoices: readonly OpenInvoice[]): Applying[] {
  let left = usd && compare(usd, '0') === 1 ? usd : '0.00';
  return invoices.map((invoice) => {
    if (compare(left, '0') !== 1) return { invoice, ticked: false, amount: '' };
    const take = compare(left, invoice.balance) === 1 ? invoice.balance : left;
    left = sum([left, negate(take)!], 2)!;
    return { invoice, ticked: true, amount: take };
  });
}
