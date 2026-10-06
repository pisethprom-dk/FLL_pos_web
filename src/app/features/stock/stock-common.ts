// v1.0.0 — what the three stock screens share: adjustment reasons, a
// document's status, the period filter, and the number patterns their line
// inputs accept (the backend's field sizes).
import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ReasonEnum } from '../../api/models/reason-enum';
import { daysBefore, today } from '../../shared/dates';

export interface Reason {
  readonly value: ReasonEnum;
  readonly label: string;
  /** Fixed by the reason, never typed per line. */
  readonly direction: 'IN' | 'OUT';
  /** A supplier is required for this reason, and refused for every other. */
  readonly supplier: boolean;
  readonly hint: string;
}

/** In the backend's order. "Supplier replacement" is not in the mockup (a known gap). */
export const REASONS: readonly Reason[] = [
  {
    value: 'DAMAGE',
    label: 'Damage',
    direction: 'OUT',
    supplier: false,
    hint: 'Broken or spoiled in the shop. Goes out at the current average cost.',
  },
  {
    value: 'LOSS',
    label: 'Loss',
    direction: 'OUT',
    supplier: false,
    hint: 'Missing — mislaid or stolen. Goes out at the current average cost.',
  },
  {
    value: 'SHOP_USE',
    label: 'Shop use',
    direction: 'OUT',
    supplier: false,
    hint: "Taken off the shelf for the shop's own use.",
  },
  {
    value: 'WARRANTY_REPLACEMENT',
    label: 'Warranty replacement',
    direction: 'OUT',
    supplier: false,
    hint: 'A new one handed to a customer on a warranty claim.',
  },
  {
    value: 'RETURN_TO_SUPPLIER',
    label: 'Return to supplier',
    direction: 'OUT',
    supplier: true,
    hint: 'Sent back to the supplier, such as faulty on arrival.',
  },
  {
    value: 'SUPPLIER_REPLACEMENT',
    label: 'Supplier replacement',
    direction: 'IN',
    supplier: true,
    hint: 'A replacement back from the supplier. Comes in at the current average cost.',
  },
  {
    value: 'OPENING_BALANCE',
    label: 'Opening balance',
    direction: 'IN',
    supplier: false,
    hint:
      'Stock already on the shelf when the system started, at a cost you type. Only for a ' +
      'product that has never had a stock movement.',
  },
];

export function reasonOf(value: string | null | undefined): Reason | undefined {
  return REASONS.find((r) => r.value === value);
}

export type Period = 'month' | 'days30' | 'year' | 'all';

export const PERIODS: readonly { readonly value: Period; readonly label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'days30', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All dates' },
];

/** The first day a period covers. A document cannot be dated in the future, so it has no end. */
export function periodStart(period: Period, on: string = today()): string | undefined {
  switch (period) {
    case 'month':
      return `${on.slice(0, 7)}-01`;
    case 'days30':
      return daysBefore(on, 29);
    case 'year':
      return `${on.slice(0, 4)}-01-01`;
    case 'all':
      return undefined;
  }
}

export type StatusFilter = 'all' | 'DRAFT' | 'POSTED';

export interface DocState {
  readonly label: string;
  readonly tone: 'ok' | 'credit' | 'low';
}

interface StockDoc {
  readonly status: 'DRAFT' | 'POSTED';
  readonly reversed_by_number: string | null;
}

/** The pill: a draft, posted, or posted and since reversed. A count's draft reads "Counting". */
export function docState(doc: StockDoc, draft = 'Draft'): DocState {
  if (doc.status === 'DRAFT') return { label: draft, tone: 'credit' };
  if (doc.reversed_by_number) return { label: 'Reversed', tone: 'low' };
  return { label: 'Posted', tone: 'ok' };
}

/**
 * What a document dialog closes with: 'saved' when anything changed (the list
 * reloads), or a document to open next — the reversal it just posted.
 */
export type DocResult<T> = 'saved' | { readonly open: T };

/** Four places when a cost uses them ("$0.0350"), two when it does not ("$26.40"). */
export function costPlaces(value: string | null | undefined): number {
  return /\.\d{2}0*[1-9]/.test(value ?? '') ? 4 : 2;
}

/** Whether Reverse… is offered: posted, not itself a reversal, not reversed already. */
export function canReverse(doc: StockDoc & { readonly reverses: number | null }): boolean {
  return doc.status === 'POSTED' && doc.reverses === null && doc.reversed_by_number === null;
}

/** A quantity: two places, as the backend holds it. */
export const QTY = /^\d{1,10}(\.\d{1,2})?$/;
/** A cost per pack or per unit: four places. */
export const COST = /^\d{1,8}(\.\d{1,4})?$/;

/** Refuses a typed zero: "0", "0.00". */
export const aboveZero: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  /[1-9]/.test(String(control.value ?? '')) ? null : { zero: true };

/** A document cannot be dated in the future; the backend refuses it too. */
export const notFuture: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value && String(control.value) > today() ? { future: true } : null;

/** Required, a plain number of the given pattern, and above zero. */
export function positive(pattern: RegExp): ValidatorFn[] {
  return [Validators.required, Validators.pattern(pattern), aboveZero];
}
