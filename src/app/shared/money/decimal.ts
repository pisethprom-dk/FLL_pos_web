// v1.1.0 — formats a decimal string for display without turning it into a
// float. Money arrives from the API as strings ("212.05"); any arithmetic on
// it belongs to the server.

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;

export interface FormattedDecimal {
  /** True for a value below zero once rounded; a rounded zero is never negative. */
  readonly negative: boolean;
  /** Digits only, thousands grouped with commas: "1,284.50". */
  readonly text: string;
}

/**
 * Rounds `value` half away from zero to `places` decimals and groups the
 * thousands. Returns null when `value` is not a plain decimal.
 */
export function formatDecimal(value: string, places: number): FormattedDecimal | null {
  const match = DECIMAL.exec(value.trim());
  if (!match) return null;
  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;

  // The value scaled by 10^places, as a string of digits.
  let digits = (whole || '0') + fraction.padEnd(places, '0').slice(0, places);
  if (fraction.length > places && fraction[places] >= '5') digits = addOne(digits);

  const padded = digits.replace(/^0+/, '').padStart(places + 1, '0');
  const intPart = padded.slice(0, padded.length - places);
  const fracPart = padded.slice(padded.length - places);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return {
    negative: sign === '-' && /[1-9]/.test(padded),
    text: places > 0 ? `${grouped}.${fracPart}` : grouped,
  };
}

/** Adds one to a string of digits: "1299" → "1300", "99" → "100". */
function addOne(digits: string): string {
  const out = digits.split('');
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] !== '9') {
      out[i] = '0123456789'[Number(out[i]) + 1];
      return out.join('');
    }
    out[i] = '0';
  }
  return '1' + out.join('');
}

/** A stored decimal as someone would type it, for an input: "26.4000" → "26.4", "24.00" → "24". */
export function plainDecimal(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}
