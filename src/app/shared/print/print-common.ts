// v1.0.0 — what the printed documents share: whether an amount is above zero,
// and how a line's discount reads.
import { plainDecimal } from '../money/decimal';
import { compare } from '../money/exact';

export function more(value: string | null | undefined): boolean {
  return !!value && compare(value, '0') === 1;
}

interface Discounted {
  readonly discount_type?: string;
  readonly discount_value?: string;
}

/** "−5%" or "−$1.50", off the list price of each unit; null when there is none. */
export function discountOff(line: Discounted): string | null {
  if (!line.discount_type || !more(line.discount_value)) return null;
  return line.discount_type === 'PERCENT'
    ? `−${plainDecimal(line.discount_value!)}%`
    : `−$${line.discount_value}`;
}
