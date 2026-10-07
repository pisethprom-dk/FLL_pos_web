// v1.2.0 — what a quotation, the till and a return share: a sale line's price
// after its discount, and how a sale's payments settle it — change in dollars
// and riel — worked out as the backend's sales/money.py and
// company/currency.py do; and a quotation's status. A preview only — the
// server prices and settles every sale again and is the authority; what prints
// is what it returned.
import { CurrencyEnum } from '../../api/models/currency-enum';
import { QuoteStatusEnum } from '../../api/models/quote-status-enum';
import { TenderKindEnum } from '../../api/models/tender-kind-enum';
import { compare, negate, over, sum, times } from '../money/exact';

/**
 * The most a line may be discounted, in percent. Mirrors DISCOUNT_CAP_PERCENT
 * in the backend's sales/money.py — absolute, Admin included.
 */
export const DISCOUNT_CAP = '15';

export type DiscountType = 'PERCENT' | 'AMOUNT';

export interface PricedLine {
  /** The unit price after the discount; null while something is missing or refused. */
  readonly net: string | null;
  /** net × qty, rounded half to even as the server's line total is. */
  readonly total: string | null;
  /** Why the discount would be refused, in the server's words. */
  readonly problem: string | null;
}

/**
 * Prices one line as the server will. `value` is the discount: percent, or
 * dollars off each unit. `fixed` is the product's is_price_fixed (null when
 * not known, as on a line loaded from a saved document — the server decides).
 */
export function priceLine(
  price: string,
  qty: string | null,
  type: DiscountType,
  value: string,
  fixed: boolean | null,
): PricedLine {
  const net = netPrice(price, type, value, fixed);
  if (typeof net !== 'string') return { net: null, total: null, problem: net.problem };
  return { net, total: qty ? times(net, qty, 2, 'half-even') : null, problem: null };
}

/** In the backend's order: no discount, then price fixed, then the cap. */
function netPrice(
  price: string,
  type: DiscountType,
  value: string,
  fixed: boolean | null,
): string | { problem: string | null } {
  const v = value.trim();
  if (!v || compare(v, '0') === 0) return price;
  // Not a number yet: the form says so; there is nothing to price.
  if (compare(v, '0') === null) return { problem: null };
  if (fixed) return { problem: "This product's price is fixed and cannot be discounted." };
  const refused = { problem: `Over the ${DISCOUNT_CAP}% limit — refused.` };
  if (type === 'PERCENT') {
    if (compare(v, DISCOUNT_CAP) === 1) return refused;
    // price × v ÷ 100 is exact at six places; only the net price is rounded.
    return lessOff(price, over(times(price, v, 4)!, '100', 6)!);
  }
  if (compare(price, '0') !== 1) return { problem: 'A free line cannot be discounted.' };
  // v ÷ price × 100 > 15, without dividing: v × 100 > 15 × price.
  if (compare(times(v, '100', 2)!, times(DISCOUNT_CAP, price, 2)!) === 1) return refused;
  return lessOff(price, v);
}

/** price − off, rounded half up to cents, as the backend's net_price() is. */
function lessOff(price: string, off: string): string {
  return times(sum([price, negate(off)!], 6)!, '1', 2)!;
}

export interface QuoteState {
  readonly label: string;
  readonly tone: 'ok' | 'credit' | 'low';
}

export const QUOTE_STATUSES: readonly {
  readonly value: QuoteStatusEnum;
  readonly label: string;
}[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'REJECTED', label: 'Rejected' },
];

/** The status pill. Expiry is not a status: an open quote past its date gets a second pill. */
export function quoteState(status: QuoteStatusEnum): QuoteState {
  const label = QUOTE_STATUSES.find((s) => s.value === status)?.label ?? status;
  if (status === 'ACCEPTED' || status === 'INVOICED') return { label, tone: 'ok' };
  if (status === 'REJECTED') return { label, tone: 'low' };
  return { label, tone: 'credit' };
}

/** A payment at the till, in its own currency. */
export interface TenderInput {
  readonly kind: TenderKindEnum;
  readonly currency: CurrencyEnum;
  readonly amount: string;
}

/** How a sale's payments settle it. All figures are dollars except change_khr. */
export interface Settlement {
  /** What the payments are worth in dollars. */
  readonly received: string;
  readonly paidNow: string;
  readonly onCredit: string;
  /** Above zero while the payments do not yet cover the sale. */
  readonly stillToCover: string;
  readonly changeDue: string;
  /** Whole dollars handed back. */
  readonly changeUsd: string;
  /** The rest of the change in riel, to the nearest ៛100. */
  readonly changeKhr: string;
  /** What the shop kept (+) or gave away (−) to riel rounding. */
  readonly rounding: string;
  /** Why the server would refuse these payments, in its words. */
  readonly problem: string | null;
}

/** A riel amount to the nearest ៛100, a half rounded up — the backend's round_khr(). */
export function roundKhr(khr: string): string {
  return times(over(khr, '100', 0)!, '100', 0)!;
}

/** Dollars to riel at `rate` (riel per dollar), to the nearest ៛100. */
export function usdToKhr(usd: string, rate: string): string {
  return roundKhr(times(usd, rate, 8)!);
}

/** Riel to dollars at `rate`, to the cent. */
export function khrToUsd(khr: string, rate: string): string {
  return over(khr, rate, 2)!;
}

/**
 * Settles `total` with `tenders` as the backend's settle() will: riel at the
 * sale's rate, change from cash only, change handed back as whole dollars
 * plus riel to the nearest ៛100, and a shortfall under half a ៛100 note,
 * paid in riel, taken as rounding rather than refused.
 */
export function settle(total: string, tenders: readonly TenderInput[], rate: string): Settlement {
  const usd = tenders.map((t) =>
    t.currency === 'KHR' ? khrToUsd(t.amount, rate) : times(t.amount, '1', 2)!,
  );
  const byKind = (kind: TenderKindEnum) =>
    sum(
      usd.filter((_, i) => tenders[i].kind === kind),
      2,
    )!;
  const cash = byKind('CASH');
  const khqr = byKind('KHQR');
  const credit = byKind('CREDIT');
  const received = sum([cash, khqr, credit], 2)!;
  // Paid now is what has been taken at the till so far, up to what is owed
  // now (the total less credit) — the server's paid_now once the sale is covered.
  const owedNow = sum([total, negate(credit)!], 2)!;
  const takenNow = sum([cash, khqr], 2)!;
  const problem =
    compare(sum([khqr, credit], 2)!, total) === 1
      ? 'KHQR and credit cannot be more than the total — change is given from cash only.'
      : null;

  let rounding = '0.00';
  let stillToCover = '0.00';
  const shortfall = sum([total, negate(received)!], 2)!;
  if (compare(shortfall, '0') === 1) {
    const paidInRiel = tenders.some((t) => t.kind === 'CASH' && t.currency === 'KHR');
    if (paidInRiel && compare(roundKhr(times(shortfall, rate, 8)!), '0') === 0) {
      rounding = negate(shortfall)!;
    } else {
      stillToCover = shortfall;
    }
  }

  const excess = sum([received, negate(total)!], 2)!;
  const changeDue = compare(excess, '0') === 1 ? excess : '0.00';
  let changeUsd = '0';
  let changeKhr = '0';
  if (compare(changeDue, '0') === 1) {
    changeUsd = changeDue.split('.')[0];
    changeKhr = usdToKhr(sum([changeDue, negate(changeUsd)!], 2)!, rate);
    const handedOver = sum([changeUsd, khrToUsd(changeKhr, rate)], 2)!;
    rounding = sum([rounding, changeDue, negate(handedOver)!], 2)!;
  }

  return {
    received,
    paidNow: compare(takenNow, owedNow) === 1 ? owedNow : takenNow,
    onCredit: credit,
    stillToCover,
    changeDue,
    changeUsd,
    changeKhr,
    rounding,
    problem,
  };
}
