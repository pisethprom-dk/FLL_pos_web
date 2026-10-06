// v1.1.0
import { dayBefore, daysBefore, today } from './dates';

describe('dates', () => {
  afterEach(() => vi.useRealTimers());

  it('gives today on the local calendar', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 23, 30));
    expect(today()).toBe('2026-10-05');
  });

  it('steps back across months, years and leap days', () => {
    expect(dayBefore('2026-09-01')).toBe('2026-08-31');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
    expect(dayBefore('2028-03-01')).toBe('2028-02-29');
    expect(dayBefore('2026-10-05')).toBe('2026-10-04');
  });

  it('steps back any number of days', () => {
    expect(daysBefore('2026-10-05', 29)).toBe('2026-09-06');
    expect(daysBefore('2026-01-10', 30)).toBe('2025-12-11');
    expect(daysBefore('2026-10-05', 0)).toBe('2026-10-05');
  });
});
