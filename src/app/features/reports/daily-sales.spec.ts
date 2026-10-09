// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Me } from '../../api/models/me';
import { SessionStore } from '../../core/session/session-store';
import { ADMIN, SELLER, answer, answerShell, signIn } from '../../core/session/session-testing';
import { daysBefore, today } from '../../shared/dates';
import { APP_PROVIDERS, choose, texts } from '../../shared/screen-testing';
import { page } from '../catalogue/catalogue-testing';
import { STAFF, USERS_URL } from '../sales/sales-testing';
import { answerEach } from '../stock/stock-testing';
import { ADMIN_REPORT, DAILY_SALES_URL, SELLER_REPORT } from './reports-testing';

describe('Daily sales', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me, report: object): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/reports/daily-sales');
    if (user === ADMIN) await answer(http, USERS_URL, page(STAFF));
    await answerEach(http, DAILY_SALES_URL, () => report, 1, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const asked = () => seen.at(-1)!.request.params;
  const next = () => answerEach(http, DAILY_SALES_URL, () => ADMIN_REPORT, 1, seen);
  const tiles = () =>
    Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b, .sub'));
  const rows = (panel: number, part = 'tbody tr') =>
    Array.from(screen.querySelectorAll('.panel')[panel].querySelectorAll(part), (tr) =>
      texts(tr, 'td'),
    );

  it("shows an Admin this month's sales with cost and profit, by day, seller and tender", async () => {
    await open(ADMIN, ADMIN_REPORT);
    expect([asked().get('date_from'), asked().get('date_to'), asked().has('seller')]).toEqual([
      `${today().slice(0, 7)}-01`,
      today(),
      false,
    ]);
    expect(tiles()).toEqual([
      ['Sales', '$255.00', '៛1,045,500'],
      ['Gross profit', '$72.40', '28.4% margin'],
      ['Invoices', '3', 'average $85.00'],
      ['Returns', '−$52.00', '1 document'],
    ]);
    expect(rows(0)).toEqual([
      ['Wed 7 Oct', '2', '$73.00', '$50.00', '$54.00', '$177.00', '$130.20', '$46.80'],
      ['Tue 6 Oct', '1', '$78.00', '$0.00', '$0.00', '$78.00', '$52.40', '$25.60'],
    ]);
    expect(rows(0, 'tfoot tr')).toEqual([
      ['Total', '3', '$151.00', '$50.00', '$54.00', '$255.00', '$182.60', '$72.40'],
    ]);
    expect(rows(1)).toEqual([
      ['Sokha Chan', '2', '$177.00', '$88.50', '$5.00'],
      ['Bopha Ly', '1', '$78.00', '$78.00', '$0.00'],
    ]);
    expect(rows(2)).toEqual([
      ['Cash', '$151.00 · 59.2%'],
      ['KHQR', '$50.00 · 19.6%'],
      ['Credit', '$54.00 · 21.2%'],
    ]);
  });

  it('asks for the period and the seller chosen', async () => {
    await open(ADMIN, ADMIN_REPORT);
    choose(screen, 'select[aria-label="Period"]', 'today');
    await next();
    expect([asked().get('date_from'), asked().get('date_to')]).toEqual([today(), today()]);
    choose(screen, 'select[aria-label="Period"]', 'days7');
    await next();
    expect([asked().get('date_from'), asked().get('date_to')]).toEqual([
      daysBefore(today(), 6),
      today(),
    ]);
    choose(screen, 'select[aria-label="Period"]', 'range');
    await next();
    await harness.fixture.whenStable();
    choose(screen, 'input[aria-label="From"]', '2026-09-01');
    await next();
    choose(screen, 'input[aria-label="To"]', '2026-09-30');
    await next();
    expect([asked().get('date_from'), asked().get('date_to')]).toEqual([
      '2026-09-01',
      '2026-09-30',
    ]);
    expect(texts(screen, 'select[aria-label="Seller"] option')).toEqual([
      'All sellers',
      'Bopha Ly',
      'Sokha Chan',
    ]);
    choose(screen, 'select[aria-label="Seller"]', '2');
    await next();
    expect(asked().get('seller')).toBe('2');
  });

  it('shows a Seller their own sales, without cost, profit or the other sellers', async () => {
    await open(SELLER, SELLER_REPORT);
    expect(http.match(USERS_URL)).toEqual([]);
    expect(screen.querySelector('select[aria-label="Seller"]')).toBeNull();
    expect(screen.querySelector('.tiles')!.classList).toContain('three');
    expect(tiles().map((t) => t[0])).toEqual(['Sales', 'Invoices', 'Returns']);
    expect(rows(0)).toEqual([['Wed 7 Oct', '2', '$73.00', '$50.00', '$54.00', '$177.00']]);
    expect(texts(screen, '.panel-head h3')).toEqual([
      'By day — 1 Oct 2026 to 7 Oct 2026',
      'By tender',
    ]);
  });
});
