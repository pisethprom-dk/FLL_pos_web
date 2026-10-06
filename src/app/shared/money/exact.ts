// v1.0.0 — exact decimal arithmetic for previews (owner's choice, 2026-10-05).
// A screen may show what a line will come to while it is typed — a stock-in's
// unit cost and line total, the till's totals — using the backend's own rules:
// whole digits held as BigInt, never a float, and halves rounded away from
// zero (Python's ROUND_HALF_UP). The server's figures replace the preview once
// the document is saved; what prints is what the API returned.

const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/;

/** `units` scaled down by 10^places: 1.10 is { units: 110n, places: 2 }. */
interface Exact {
  readonly units: bigint;
  readonly places: number;
}

function parse(text: string): Exact | null {
  const match = DECIMAL.exec(text.trim());
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const units = BigInt(whole + fraction);
  return { units: sign === '-' ? -units : units, places: fraction.length };
}

const TEN = 10n;
const pow10 = (n: number): bigint => TEN ** BigInt(n);

/** n / d rounded half away from zero. */
function divide(n: bigint, d: bigint): bigint {
  const negative = n < 0n !== d < 0n;
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  let q = an / ad;
  if ((an % ad) * 2n >= ad) q += 1n;
  return negative ? -q : q;
}

function rescale(x: Exact, places: number): Exact {
  if (places >= x.places) return { units: x.units * pow10(places - x.places), places };
  return { units: divide(x.units, pow10(x.places - places)), places };
}

function text(x: Exact): string {
  const negative = x.units < 0n;
  const digits = (negative ? -x.units : x.units).toString().padStart(x.places + 1, '0');
  const whole = digits.slice(0, digits.length - x.places);
  const fraction = digits.slice(digits.length - x.places);
  const body = x.places > 0 ? `${whole}.${fraction}` : whole;
  return negative && /[1-9]/.test(digits) ? `-${body}` : body;
}

/** a × b, rounded to `places`. Null when either is not a plain decimal. */
export function times(a: string, b: string, places: number): string | null {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return null;
  return text(rescale({ units: x.units * y.units, places: x.places + y.places }, places));
}

/** a ÷ b, rounded to `places`. Null when either is not a plain decimal, or b is zero. */
export function over(a: string, b: string, places: number): string | null {
  const x = parse(a);
  const y = parse(b);
  if (!x || !y || y.units === 0n) return null;
  // a / b = (x.units / 10^x.places) / (y.units / 10^y.places); scaled up by 10^places.
  const n = x.units * pow10(y.places + places);
  const d = y.units * pow10(x.places);
  return text({ units: divide(n, d), places });
}

/** The sum, to `places`. Null when any value is not a plain decimal. */
export function sum(values: readonly string[], places: number): string | null {
  let total = 0n;
  for (const value of values) {
    const x = parse(value);
    if (!x) return null;
    total += rescale(x, places).units;
  }
  return text({ units: total, places });
}

/** The same value with its sign turned: "3.70" → "-3.70". */
export function negate(value: string): string | null {
  const x = parse(value);
  return x ? text({ units: -x.units, places: x.places }) : null;
}
