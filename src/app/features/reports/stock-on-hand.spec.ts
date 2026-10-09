// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Me } from '../../api/models/me';
import { SessionStore } from '../../core/session/session-store';
import { ADMIN, SELLER, answer, answerShell, signIn } from '../../core/session/session-testing';
import { APP_PROVIDERS, choose, texts, type } from '../../shared/screen-testing';
import { BRANDS, BRAND_URL, CATEGORIES, CATEGORY_URL, page } from '../catalogue/catalogue-testing';
import { answerEach } from '../stock/stock-testing';
import { STOCK_REPORT, STOCK_REPORT_SELLER, STOCK_URL } from './reports-testing';

describe('Stock on hand', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me, report: object): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/reports/stock-on-hand');
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await answer(http, BRAND_URL, page(BRANDS));
    await answerEach(http, STOCK_URL, () => report, 1, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const asked = () => seen.at(-1)!.request.params;
  const next = () => answerEach(http, STOCK_URL, () => STOCK_REPORT, 1, seen);
  const tiles = () =>
    Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b, .sub'));
  const rows = (part = 'tbody tr') =>
    Array.from(screen.querySelectorAll(part), (tr) => texts(tr, 'td'));

  it('shows an Admin what is on the shelf, its value, and why a product is flagged', async () => {
    await open(ADMIN, STOCK_REPORT);
    expect(asked().keys()).toEqual([]);
    expect(tiles()).toEqual([
      ['Stock value at cost', '$1,752.00', '5 products'],
      ['Below reorder level', '2', '1 out of stock'],
      ['No movement 90 days', '1', '$244.00 tied up'],
      ['Last counted', '30 Sep', 'Hand tools · variance −$23.49'],
    ]);
    expect(rows()).toEqual([
      [
        'TL-0101',
        'Impact drill 13mm 710W',
        'Bosch',
        'A1-1',
        '20 Piece',
        '25',
        '$52.40',
        '$1,048.00',
        '5 Oct 2026',
        'Reorder',
      ],
      [
        'TL-0118',
        'Angle grinder 100mm 570W',
        'Makita',
        '—',
        '0 Piece',
        '0',
        '$38.90',
        '$0.00',
        '5 Oct 2026',
        'Out of stock',
      ],
      [
        'TL-0130',
        'Circular saw 185mm 1400W',
        'Total',
        '—',
        '10 Piece',
        '0',
        '$40.00',
        '$400.00',
        '5 Oct 2026',
        'OK',
      ],
      [
        'TL-0150',
        'Cordless driver 12V',
        '—',
        '—',
        '4 Piece',
        '0',
        '$61.00',
        '$244.00',
        '29 Jun 2026',
        'No movement 90 days',
      ],
    ]);
    expect(rows('tfoot tr')).toEqual([['4 products', '$1,692.00', '']]);
  });

  it('asks for the status, category, brand and search chosen', async () => {
    await open(ADMIN, STOCK_REPORT);
    choose(screen, 'select[aria-label="Show"]', 'no_movement');
    await next();
    expect(asked().get('status')).toBe('no_movement');
    choose(screen, 'select[aria-label="Category"]', String(CATEGORIES[0].id));
    await next();
    choose(screen, 'select[aria-label="Brand"]', String(BRANDS[0].id));
    await next();
    type(screen, 'input[aria-label="Search stock"]', ' drill ');
    await next();
    expect([asked().get('category'), asked().get('brand'), asked().get('search')]).toEqual([
      String(CATEGORIES[0].id),
      String(BRANDS[0].id),
      'drill',
    ]);
  });

  it('shows a Seller the quantities without any cost or value', async () => {
    await open(SELLER, STOCK_REPORT_SELLER);
    expect(screen.querySelector('.tiles')!.classList).toContain('three');
    expect(tiles()).toEqual([
      ['Below reorder level', '2', '1 out of stock'],
      ['No movement 90 days', '1', 'Holding stock'],
      ['Last counted', '30 Sep', 'Hand tools · 7 lines differed'],
    ]);
    expect(rows()[0]).toEqual([
      'TL-0101',
      'Impact drill 13mm 710W',
      'Bosch',
      'A1-1',
      '20 Piece',
      '25',
      '5 Oct 2026',
      'Reorder',
    ]);
    expect(rows('tfoot tr')).toEqual([['4 products']]);
  });
});
