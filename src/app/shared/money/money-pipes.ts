// v1.3.0 — $ and ៛ for display, exchange rates and quantities. Places follow
// the backend's company/currency.py: USD two, KHR none. These only show what
// the server sent — riel rounding to the nearest 100 happens there, not here.
import { Pipe, PipeTransform } from '@angular/core';
import { formatDecimal } from './decimal';

const MINUS = '−';
const EMPTY = '—';

/**
 * "$1,284.50", "−$2.60". A null value — a field this user may not see — shows
 * as a dash. A value that is not a decimal is shown as received, not hidden.
 */
export function formatMoney(
  value: string | null | undefined,
  symbol: string,
  places: number,
): string {
  if (value === null || value === undefined || value.trim() === '') return EMPTY;
  const formatted = formatDecimal(value, places);
  if (!formatted) return value;
  return `${formatted.negative ? MINUS : ''}${symbol}${formatted.text}`;
}

/** Two places for money; `usd: 4` for a unit cost, which is held to four ("$1.1000"). */
@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(value: string | null | undefined, places = 2): string {
    return formatMoney(value, '$', places);
  }
}

@Pipe({ name: 'khr' })
export class KhrPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatMoney(value, '៛', 0);
  }
}

/**
 * Riel per US dollar, exactly as stored: "4,100", "4,087.5". A rate is not a
 * riel amount, so it is never rounded to whole riel.
 */
export function formatRate(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') return EMPTY;
  const formatted = formatDecimal(value, 6);
  if (!formatted) return value;
  return `${formatted.negative ? MINUS : ''}${formatted.text.replace(/\.?0+$/, '')}`;
}

@Pipe({ name: 'rate' })
export class RatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatRate(value);
  }
}

/**
 * A quantity as people say it: "14.00" → "14", "12.50" → "12.5", "1250" →
 * "1,250". Stock quantities carry two places; most are whole.
 */
export function formatQty(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') return EMPTY;
  const formatted = formatDecimal(value, 2);
  if (!formatted) return value;
  return `${formatted.negative ? MINUS : ''}${formatted.text.replace(/\.?0+$/, '')}`;
}

@Pipe({ name: 'qty' })
export class QtyPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatQty(value);
  }
}
