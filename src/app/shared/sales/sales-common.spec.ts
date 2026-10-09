// v1.2.0 — the expected figures are what the backend's net_price(), line
// total and settle() give in Python's Decimal; the settle cases are the
// backend's own tests (sales/tests.py, MoneyTests).
import { TenderInput, priceLine, quoteState, roundKhr, settle, usdToKhr } from './sales-common';

describe('sale line prices', () => {
  it('takes a percent off, rounding the net price half up', () => {
    expect(priceLine('52.00', '1', 'PERCENT', '5', false)).toEqual({
      net: '49.40',
      total: '49.40',
      problem: null,
    });
    expect(priceLine('25.50', '2', 'PERCENT', '15', false).net).toBe('21.68');
    expect(priceLine('3.33', '1', 'PERCENT', '10', false).net).toBe('3.00');
  });

  it('rounds the line total half to even, as the server does', () => {
    expect(priceLine('19.99', '3', 'PERCENT', '7.5', false)).toEqual({
      net: '18.49',
      total: '55.47',
      problem: null,
    });
    expect(priceLine('1.25', '0.5', 'PERCENT', '', false).total).toBe('0.62');
  });

  it('takes dollars off each unit', () => {
    expect(priceLine('1.70', '6', 'AMOUNT', '0.20', false)).toEqual({
      net: '1.50',
      total: '9.00',
      problem: null,
    });
  });

  it('refuses over 15%, either way it is typed', () => {
    const refused = 'Over the 15% limit — refused.';
    expect(priceLine('25.50', '2', 'PERCENT', '15.01', false)).toEqual({
      net: null,
      total: null,
      problem: refused,
    });
    // $0.26 off $1.70 is 15.3%; $0.25 is 14.7%.
    expect(priceLine('1.70', '1', 'AMOUNT', '0.26', false).problem).toBe(refused);
    expect(priceLine('1.70', '1', 'AMOUNT', '0.25', false).net).toBe('1.45');
  });

  it('refuses any discount on a fixed price or a free line, and allows none at all', () => {
    expect(priceLine('84.00', '1', 'PERCENT', '1', true).problem).toBe(
      "This product's price is fixed and cannot be discounted.",
    );
    expect(priceLine('84.00', '1', 'PERCENT', '0', true).net).toBe('84.00');
    expect(priceLine('0.00', '1', 'AMOUNT', '1', false).problem).toBe(
      'A free line cannot be discounted.',
    );
  });

  it('leaves half-typed input to the form, and waits for a quantity', () => {
    expect(priceLine('52.00', '1', 'PERCENT', '5.', false)).toEqual({
      net: null,
      total: null,
      problem: null,
    });
    expect(priceLine('52.00', null, 'PERCENT', '5', false)).toEqual({
      net: '49.40',
      total: null,
      problem: null,
    });
  });
});

describe('quotation states', () => {
  it('tones each status for its pill', () => {
    expect(quoteState('DRAFT')).toEqual({ label: 'Draft', tone: 'credit' });
    expect(quoteState('SENT')).toEqual({ label: 'Sent', tone: 'credit' });
    expect(quoteState('ACCEPTED')).toEqual({ label: 'Accepted', tone: 'ok' });
    expect(quoteState('INVOICED')).toEqual({ label: 'Invoiced', tone: 'ok' });
    expect(quoteState('REJECTED')).toEqual({ label: 'Rejected', tone: 'low' });
  });
});

describe('settling a sale', () => {
  const RATE = '4100';
  const T = (
    kind: TenderInput['kind'],
    amount: string,
    currency: TenderInput['currency'] = 'USD',
  ) => ({
    kind,
    currency,
    amount,
  });

  it('rounds riel to the nearest ៛100, a half up', () => {
    expect(roundKhr('2255')).toBe('2300');
    expect(roundKhr('2249')).toBe('2200');
    expect(roundKhr('41')).toBe('0');
    expect(usdToKhr('320.00', RATE)).toBe('1312000');
  });

  it('takes dollars, riel and credit together', () => {
    const s = settle(
      '320.00',
      [T('CASH', '150'), T('CASH', '410000', 'KHR'), T('CREDIT', '70')],
      RATE,
    );
    expect([s.paidNow, s.onCredit, s.changeDue, s.stillToCover]).toEqual([
      '250.00',
      '70.00',
      '0.00',
      '0.00',
    ]);
  });

  it('splits change into whole dollars and riel, and records the rounding', () => {
    const s = settle('361.45', [T('CASH', '400')], RATE);
    expect([s.changeDue, s.changeUsd, s.changeKhr, s.rounding]).toEqual([
      '38.55',
      '38',
      '2300',
      '-0.01',
    ]);
  });

  it('takes a shortfall under half a ៛100 note, paid in riel, as rounding', () => {
    const s = settle('12.40', [T('CASH', '50800', 'KHR')], RATE);
    expect([s.stillToCover, s.rounding, s.changeDue]).toEqual(['0.00', '-0.01', '0.00']);
  });

  it('says what is still to cover, and refuses change out of KHQR', () => {
    expect(settle('12.40', [T('CASH', '12.00')], RATE).stillToCover).toBe('0.40');
    // Paid now is what has been taken so far, not the total before anything is paid.
    expect(settle('12.40', [T('CASH', '12.00')], RATE).paidNow).toBe('12.00');
    expect(settle('12.40', [], RATE).paidNow).toBe('0.00');
    expect(settle('361.45', [T('CASH', '400')], RATE).paidNow).toBe('361.45');
    expect(settle('12.40', [T('KHQR', '20.00')], RATE).problem).toBe(
      'KHQR and credit cannot be more than the total — change is given from cash only.',
    );
    expect(settle('12.40', [], RATE).stillToCover).toBe('12.40');
  });
});
