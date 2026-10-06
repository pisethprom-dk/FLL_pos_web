// v1.0.1
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { ExchangeRate } from '../../../api/models/exchange-rate';
import { PaginatedExchangeRateList } from '../../../api/models/paginated-exchange-rate-list';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, TODAY_RATE, answer, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  dialog,
  dialogCount,
  find,
  openScreen,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';

const rate = (r: Partial<ExchangeRate> & Pick<ExchangeRate, 'id' | 'effective_date' | 'rate'>) =>
  ({
    is_in_use: false,
    set_by: 'Bopha Ly',
    created_at: '2026-01-01T09:00:00Z',
    ...r,
  }) as ExchangeRate;

// Deliberately out of order: the screen sorts them.
const RATES: PaginatedExchangeRateList = {
  count: 4,
  results: [
    rate({ id: 2, effective_date: '2026-09-01', rate: '4100.000000', is_in_use: true }),
    rate({ id: 3, effective_date: '2026-11-01', rate: '4120.000000' }),
    // The seeded opening rate: nobody set it, so set_by is null.
    rate({
      id: 1,
      effective_date: '2025-12-01',
      rate: '4000.500000',
      is_in_use: true,
      set_by: null,
    }),
    rate({
      id: 4,
      effective_date: '2026-08-01',
      rate: '4080.000000',
      is_in_use: true,
      note: 'Bank rate',
    }),
  ],
};

describe('Exchange rates', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let page: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 10, 0));
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    harness = await openScreen(http, '/company/exchange-rate', [
      { url: '/api/company/exchange-rates/', body: RATES },
    ]);
    page = harness.routeNativeElement!;
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const settle = () => harness.fixture.whenStable();
  const rows = () =>
    Array.from(page.querySelectorAll('tbody tr'), (tr) =>
      Array.from(tr.querySelectorAll('td'), (td) => td.textContent!.replace(/\s+/g, ' ').trim()),
    );

  it('lists rates newest first, with when each stopped and where it stands today', () => {
    expect(rows()).toEqual([
      ['1 Nov 2026', '—', '4,120', 'Bopha Ly', 'Scheduled', 'Edit'],
      ['1 Sep 2026', '31 Oct 2026', '4,100', 'Bopha Ly', 'In use', 'View'],
      ['1 Aug 2026', '31 Aug 2026', '4,080', 'Bopha Ly', 'Past', 'View'],
      ['1 Dec 2025', '31 Jul 2026', '4,000.5', '—', 'Past', 'View'],
    ]);
  });

  it('sums it up in the tiles', () => {
    const tiles = Array.from(page.querySelectorAll('.tile'), (tile) =>
      texts(tile, 'small, b, .sub'),
    );
    expect(tiles).toEqual([
      ['Rate in use', '៛4,100', 'per USD, since 1 Sep 2026'],
      ['Previous rate', '៛4,080', '1 Aug 2026 – 31 Aug 2026'],
      ['Changes this year', '3', '2026'],
      ['Next change', '៛4,120', 'from 1 Nov 2026'],
    ]);
  });

  it('sets a new rate, then reloads the list and the top bar', async () => {
    press(page, 'Set a new rate');
    await settle();
    const card = dialog();
    expect(find(card, 'h3').textContent!.trim()).toBe('Set a new rate');
    expect(find<HTMLInputElement>(card, '#rate-date').value).toBe('2026-10-05');

    type(card, '#rate-value', '4110');
    type(card, '#rate-note', 'Bank moved');
    press(card, 'Save rate');

    const req = http.expectOne('/api/company/exchange-rates/');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      effective_date: '2026-10-05',
      rate: '4110',
      note: 'Bank moved',
    });
    req.flush(rate({ id: 5, effective_date: '2026-10-05', rate: '4110.000000' }));

    await answer(http, '/api/company/exchange-rates/', RATES);
    await answer(http, '/api/company/rate/', TODAY_RATE);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it("keeps the dialog open with the server's reason when it refuses", async () => {
    press(page, 'Set a new rate');
    await settle();
    const card = dialog();
    type(card, '#rate-date', '2026-09-01');
    type(card, '#rate-value', '4100');
    press(card, 'Save rate');

    http
      .expectOne('/api/company/exchange-rates/')
      .flush(
        { effective_date: ['exchange rate with this effective date already exists.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(dialogCount()).toBe(1);
    const field = find(card, '#rate-date').closest('.field')!;
    expect(texts(field, '.hint.warn')).toEqual([
      'exchange rate with this effective date already exists.',
    ]);

    // The reason goes once the date it was about has been changed.
    type(card, '#rate-date', '2099-01-01');
    await settle();
    expect(texts(field, '.hint.warn')).toEqual([]);
  });

  it('will not send a rate that is not a plain number above zero', async () => {
    press(page, 'Set a new rate');
    await settle();
    const card = dialog();
    for (const bad of ['4,100', '0', 'abc', '4100.1234567']) {
      type(card, '#rate-value', bad);
      press(card, 'Save rate');
      await settle();
      expect(texts(card, '.hint.warn')).toContain(
        'A number above zero, up to six decimals — no commas.',
      );
    }
    // http.verify() in afterEach: nothing was sent.
  });

  it('changes a rate no sale has used yet', async () => {
    press(page, 'Edit', '.rowlink');
    await settle();
    const card = dialog();
    expect(find(card, 'h3').textContent!.trim()).toBe('Change the rate from 1 Nov 2026');
    expect(find<HTMLInputElement>(card, '#rate-value').value).toBe('4120');

    type(card, '#rate-value', '4125.5');
    press(card, 'Save rate');
    const req = http.expectOne('/api/company/exchange-rates/3/');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ effective_date: '2026-11-01', rate: '4125.5', note: '' });
    req.flush(rate({ id: 3, effective_date: '2026-11-01', rate: '4125.500000' }));

    await answer(http, '/api/company/exchange-rates/', RATES);
    await answer(http, '/api/company/rate/', TODAY_RATE);
    await settle();
  });

  it('shows a rate with sales against it read-only, and offers a new rate instead', async () => {
    const [, inUse] = Array.from(page.querySelectorAll<HTMLButtonElement>('.rowlink'));
    inUse.click();
    await settle();
    const card = dialog();
    expect(find(card, 'h3').textContent!.trim()).toBe('Rate from 1 Sep 2026');
    expect(find(card, '.note').textContent).toContain('has sales recorded against it');
    expect(card.querySelector('button[type=submit]')).toBeNull();

    press(card, 'Set a new rate instead');
    await settle();
    expect(dialogCount()).toBe(1);
    expect(find(dialog(), 'h3').textContent!.trim()).toBe('Set a new rate');
  });
});
