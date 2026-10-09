// v1.1.0 — every expected figure here is what Python's Decimal gives:
// ROUND_HALF_UP, the backend's rounding, or its default (half to even) where
// a test says so.
import { compare, negate, over, sum, times } from './exact';

describe('exact decimal previews', () => {
  it('multiplies and rounds to the places asked for', () => {
    expect(times('2', '26.40', 2)).toBe('52.80');
    expect(times('1.5', '38.9000', 2)).toBe('58.35');
    expect(times('0.333', '3', 2)).toBe('1.00');
    expect(times('2.5', '0.0001', 2)).toBe('0.00');
  });

  it('rounds halves away from zero, on both sides of it', () => {
    expect(times('0.125', '1', 2)).toBe('0.13');
    expect(times('-0.125', '1', 2)).toBe('-0.13');
    expect(times('-2', '1.855', 2)).toBe('-3.71');
  });

  it("rounds a sale line's total half to even, as the server's default does", () => {
    expect(times('1.25', '0.50', 2, 'half-even')).toBe('0.62');
    expect(times('2.45', '0.5', 2, 'half-even')).toBe('1.22');
    expect(times('0.135', '1', 2, 'half-even')).toBe('0.14');
    expect(times('-0.125', '1', 2, 'half-even')).toBe('-0.12');
    expect(times('52.40', '3', 2, 'half-even')).toBe('157.20');
    // The same figure, half up: the two rules differ only on an exact half.
    expect(times('1.25', '0.50', 2)).toBe('0.63');
  });

  it('compares two amounts, whatever their places', () => {
    expect(compare('15.00', '15')).toBe(0);
    expect(compare('15.01', '15')).toBe(1);
    expect(compare('2', '10')).toBe(-1);
    expect(compare('-3.70', '0')).toBe(-1);
    expect(compare('abc', '1')).toBeNull();
  });

  it('divides to four places, as a unit cost is held', () => {
    expect(over('26.40', '24', 4)).toBe('1.1000');
    expect(over('26.40', '23', 4)).toBe('1.1478');
    expect(over('2', '3', 4)).toBe('0.6667');
    expect(over('7', '0.30', 4)).toBe('23.3333');
  });

  it('adds without drifting the way floats do', () => {
    expect(sum(['52.80', '314.40', '73.60'], 2)).toBe('440.80');
    expect(sum(['0.10', '0.20'], 2)).toBe('0.30');
    expect(sum(['-77.80', '3.30'], 2)).toBe('-74.50');
    expect(sum([], 2)).toBe('0.00');
  });

  it('turns a sign, and never shows a negative zero', () => {
    expect(negate('3.70')).toBe('-3.70');
    expect(negate('-3.70')).toBe('3.70');
    expect(negate('0.00')).toBe('0.00');
    expect(times('-0.001', '1', 2)).toBe('0.00');
  });

  it('gives nothing for text that is not a plain decimal, or a division by zero', () => {
    expect(times('abc', '1', 2)).toBeNull();
    expect(times('1,200', '1', 2)).toBeNull();
    expect(over('1', '0', 4)).toBeNull();
    expect(over('1', '0.00', 4)).toBeNull();
    expect(sum(['1.00', ''], 2)).toBeNull();
  });
});
