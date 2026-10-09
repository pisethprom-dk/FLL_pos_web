// v1.0.0 — what the Sales screens share: how a sale was paid, and who may
// void it. The backend's CanVoidInvoice decides; this only says whether to
// offer Void — an Admin any completed sale, a Seller their own on the day it
// was raised.
import { Invoice } from '../../api/models/invoice';
import { InvoiceLine } from '../../api/models/invoice-line';
import { Me } from '../../api/models/me';
import { TenderKindEnum } from '../../api/models/tender-kind-enum';
import { dayOf } from '../../shared/dates';
import { plainDecimal } from '../../shared/money/decimal';
import { compare } from '../../shared/money/exact';

const KINDS: readonly { readonly value: TenderKindEnum; readonly label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'KHQR', label: 'KHQR' },
  { value: 'CREDIT', label: 'Credit' },
];

export function kindLabel(kind: TenderKindEnum): string {
  return KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** A line's discount as the till showed it: "5%", "$1.50 each", or a dash. */
export function discountText(line: InvoiceLine): string {
  if (!line.discount_type || !line.discount_value || compare(line.discount_value, '0') === 0) {
    return '—';
  }
  return line.discount_type === 'PERCENT'
    ? `${plainDecimal(line.discount_value)}%`
    : `$${line.discount_value} each`;
}

/** Each way the sale was paid, once, in a fixed order: Cash, KHQR, Credit. */
export function paidBy(invoice: Invoice): string[] {
  const used = new Set(invoice.tenders.map((t) => t.kind));
  return KINDS.filter((k) => used.has(k.value)).map((k) => k.label);
}

export function mayVoid(
  invoice: Invoice,
  me: Me | null,
  can: (scopes: readonly string[]) => boolean,
  today: string,
): boolean {
  if (invoice.status !== 'COMPLETED' || !me) return false;
  if (can(['invoice.void.any'])) return true;
  return (
    can(['invoice.void.own']) &&
    invoice.seller === me.id &&
    !!invoice.sale_date &&
    dayOf(invoice.sale_date) === today
  );
}
