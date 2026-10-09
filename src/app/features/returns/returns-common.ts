// v1.0.0 — what the Returns & voids screens share: how a return was settled,
// what an invoice line can still give back, and how a return's value splits
// between what is still owed and a refund — as the backend's post_return().
import { InvoiceLine } from '../../api/models/invoice-line';
import { RefundMethodEnum } from '../../api/models/refund-method-enum';
import { SalesReturn } from '../../api/models/sales-return';
import { compare, negate, sum } from '../../shared/money/exact';
import { formatMoney } from '../../shared/money/money-pipes';

export const REFUNDS: readonly { readonly value: RefundMethodEnum; readonly label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'KHQR', label: 'KHQR' },
];

function refundLabel(method: string | undefined): string {
  return `${REFUNDS.find((r) => r.value === method)?.label ?? 'Cash'} refund`;
}

/** The list's "Settled by": the server's split once posted; nothing while a draft. */
export function settledBy(ret: SalesReturn): string {
  if (ret.status !== 'POSTED') return '—';
  const credited = compare(ret.credited, '0') === 1;
  const refunded = compare(ret.refunded, '0') === 1;
  if (credited && refunded) {
    return (
      `${formatMoney(ret.credited, '$', 2)} credited, ` +
      `${formatMoney(ret.refunded, '$', 2)} ${refundLabel(ret.refund_method).toLowerCase()}`
    );
  }
  return refunded ? refundLabel(ret.refund_method) : 'Credited to the invoice';
}

/** Sold on the line, less what posted returns have brought back. */
export function stillReturnable(line: InvoiceLine): string {
  return sum([line.quantity, negate(line.qty_returned)!], 2)!;
}

export interface Split {
  /** Takes off what is still owed on the invoice. */
  readonly credited: string;
  /** Whatever is left over, paid back by cash or KHQR. */
  readonly refunded: string;
}

/** A return's value first reduces what the invoice still owes; the rest is refunded. */
export function split(total: string, owed: string): Split {
  const owing = compare(owed, '0') === 1 ? owed : '0.00';
  const credited = compare(total, owing) === 1 ? owing : total;
  return { credited, refunded: sum([total, negate(credited)!], 2)! };
}
