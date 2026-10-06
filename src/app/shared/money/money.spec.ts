// v1.3.0
import { formatDecimal } from './decimal';
import { KhrPipe, QtyPipe, RatePipe, UsdPipe, formatMoney } from './money-pipes';

describe('formatDecimal', () => {
  it('groups thousands and pads to the places asked for', () => {
    expect(formatDecimal('1284.5', 2)?.text).toBe('1,284.50');
    expect(formatDecimal('1312000', 0)?.text).toBe('1,312,000');
    expect(formatDecimal('0', 2)?.text).toBe('0.00');
  });

  it('rounds half away from zero, carrying through nines', () => {
    expect(formatDecimal('4100.000000', 0)?.text).toBe('4,100');
    expect(formatDecimal('4087.5', 0)?.text).toBe('4,088');
    expect(formatDecimal('52.4049', 2)?.text).toBe('52.40');
    expect(formatDecimal('999.995', 2)?.text).toBe('1,000.00');
    expect(formatDecimal('-2.605', 2)).toEqual({ negative: true, text: '2.61' });
  });

  it('never calls a rounded zero negative', () => {
    expect(formatDecimal('-0.004', 2)).toEqual({ negative: false, text: '0.00' });
  });

  it('accepts a missing whole or fraction part', () => {
    expect(formatDecimal('.5', 2)?.text).toBe('0.50');
    expect(formatDecimal('7.', 2)?.text).toBe('7.00');
  });

  it('refuses anything that is not a plain decimal', () => {
    expect(formatDecimal('', 2)).toBeNull();
    expect(formatDecimal('.', 2)).toBeNull();
    expect(formatDecimal('1e5', 2)).toBeNull();
    expect(formatDecimal('12,000', 2)).toBeNull();
  });
});

describe('money pipes', () => {
  it('shows dollars with two places and a true minus sign', () => {
    const usd = new UsdPipe();
    expect(usd.transform('212.05')).toBe('$212.05');
    expect(usd.transform('-2.6')).toBe('−$2.60');
  });

  it('shows a unit cost to the four places it is held', () => {
    expect(new UsdPipe().transform('1.1', 4)).toBe('$1.1000');
    expect(new UsdPipe().transform('52.4000', 4)).toBe('$52.4000');
  });

  it('shows riel with no places', () => {
    expect(new KhrPipe().transform('1312000.00')).toBe('៛1,312,000');
  });

  it('shows a dash for a field the user may not see', () => {
    expect(new UsdPipe().transform(null)).toBe('—');
    expect(new KhrPipe().transform(undefined)).toBe('—');
  });

  it('shows an unexpected value as received', () => {
    expect(formatMoney('n/a', '$', 2)).toBe('n/a');
  });
});

describe('rate pipe', () => {
  const rate = new RatePipe();

  it('groups the thousands and keeps every place that matters', () => {
    expect(rate.transform('4100.000000')).toBe('4,100');
    expect(rate.transform('4087.500000')).toBe('4,087.5');
    expect(rate.transform('4000.000001')).toBe('4,000.000001');
    expect(rate.transform('4000')).toBe('4,000');
  });

  it('never rounds a rate to whole riel', () => {
    expect(rate.transform('4099.75')).toBe('4,099.75');
  });

  it('shows a dash when there is no rate', () => {
    expect(rate.transform(null)).toBe('—');
  });
});

describe('qty pipe', () => {
  const qty = new QtyPipe();

  it('drops the places a whole quantity does not need', () => {
    expect(qty.transform('14.00')).toBe('14');
    expect(qty.transform('12.50')).toBe('12.5');
    expect(qty.transform('1250.00')).toBe('1,250');
    expect(qty.transform('0.00')).toBe('0');
    expect(qty.transform('-2.00')).toBe('−2');
  });

  it('shows a dash for nothing', () => {
    expect(qty.transform(null)).toBe('—');
  });
});
