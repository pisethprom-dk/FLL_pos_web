// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Dashboard } from '../../api/models/dashboard';
import { Me } from '../../api/models/me';
import { SessionStore } from '../../core/session/session-store';
import { ADMIN, SELLER, answer, answerShell, signIn } from '../../core/session/session-testing';
import { APP_PROVIDERS, dialog, dialogCount, press, texts } from '../../shared/screen-testing';
import { page } from '../catalogue/catalogue-testing';
import { DASHBOARD, DASHBOARD_SELLER, DASHBOARD_URL } from '../reports/reports-testing';
import { RETURN_URL } from '../returns/returns-testing';
import { COMPLETED, INVOICE_URL } from '../sell/sell-testing';
import { answerEach } from '../stock/stock-testing';

describe('Dashboard', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me = ADMIN, body: Dashboard = DASHBOARD): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/');
    await answerEach(http, DASHBOARD_URL, () => body, 1, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const tiles = (row: Element) =>
    Array.from(row.querySelectorAll('.tile'), (t) => texts(t, 'small, b, .sub'));
  const rows = (panel: Element, part = 'tbody tr') =>
    Array.from(panel.querySelectorAll(part), (tr) => texts(tr, 'td'));
  const panel = (title: string) =>
    Array.from(screen.querySelectorAll('.panel')).find(
      (p) => p.querySelector('h3')?.textContent?.trim() === title,
    );

  it("shows an Admin the whole shop's day, the money, the stock and what waits", async () => {
    await open();
    expect(texts(screen, '.band .lead small, .band .usd, .band .khr')).toEqual([
      'Sales today',
      '$1,284.50',
      '៛5,266,450',
    ]);
    expect(
      Array.from(screen.querySelectorAll('.band .split > div'), (d) => texts(d, 'small, b')),
    ).toEqual([
      ['Transactions', '47'],
      ['Average sale', '$27.33'],
      ['Gross profit', '$312.80'],
      ['Margin', '24.4%'],
    ]);

    const [money, todo] = Array.from(screen.querySelectorAll('.tiles'));
    expect(tiles(money)).toEqual([
      ['Cash taken today', '$634.15', 'Sales $612.15 · payments $40.00 · refunds $18.00'],
      ['Customers owe', '$403.00', '$98.00 over 90 days'],
      ['Stock value at cost', '$18,472.30', '412 products'],
      ['Below reorder level', '6', '2 out of stock'],
    ]);
    // Red: money owed over 90 days, and products out of stock.
    expect(
      Array.from(money.querySelectorAll('.sub'), (s) => s.classList.contains('alert')),
    ).toEqual([false, true, false, true]);
    expect(todo.classList).toContain('three');
    expect(tiles(todo)).toEqual([
      ['Held sales', '2', 'Waiting at the till'],
      ['Quotations to follow up', '3', '1 expiring within 7 days · 1 expired'],
      ['Open warranty claims', '4', '1 out of warranty'],
    ]);
    expect(Array.from(todo.querySelectorAll('a.tile'), (a) => a.getAttribute('href'))).toEqual([
      '/sell',
      '/quotations',
      '/warranty',
    ]);

    expect(texts(screen, '.bars .val')).toEqual([
      '$980',
      '$1,120',
      '$860',
      '$1,340',
      '$1,205',
      '$1,490',
      '$1,285',
    ]);
    expect(texts(screen, '.bars .cap')).toEqual([
      'Thu',
      'Fri',
      'Sat',
      'Sun',
      'Mon',
      'Tue',
      'Today',
    ]);
    expect(
      Array.from(screen.querySelectorAll<HTMLElement>('.bars .bar'), (b) => b.style.height),
    ).toEqual(['65.8%', '75.2%', '57.7%', '89.9%', '80.9%', '100%', '86.2%']);
    expect(screen.querySelector('.bars .col:last-child')!.classList).toContain('today');
    expect(texts(screen, '.hbar .row')).toEqual([
      'Power tools$488.10',
      'Hand tools$346.80',
      'Fasteners$231.20',
      'Paint$141.30',
      'Other$77.10',
    ]);
    expect(screen.querySelector<HTMLElement>('.hbar .fill')!.style.width).toBe('38%');

    const recent = panel('Recent sales')!;
    expect(rows(recent).map((r) => r.slice(2))).toEqual([
      ['Cash', '$12.40'],
      ['Credit', '$186.00'],
      ['Mixed', '$8.75'],
    ]);
    expect(texts(recent, 'tbody .rowlink')).toEqual([
      'INV-20261007047',
      'INV-20261007046',
      'INV-20261007045',
    ]);
    expect(texts(recent, 'tbody td:nth-child(2) .cell-sub')).toEqual(['Mr Vuthy']);

    const low = panel('Running low')!;
    expect(rows(low)).toEqual([
      ['Angle grinder 100mm 570W TL-0118', '0 Piece', '5'],
      ['Impact drill 13mm 710W TL-0101', '7 Piece', '20'],
    ]);
    expect(low.querySelector('tbody td:nth-child(2)')!.classList).toContain('neg');
    expect(texts(low, '.panel-note')).toEqual(['And 4 more below their reorder level.']);

    const owed = panel('Money owed to the shop')!;
    expect(rows(owed)).toEqual([
      ['Sok Shop', '$52.00', '$69.00', '$0.00', '$98.00', '$219.00'],
      ['Dara Grocery', '$0.00', '$0.00', '$84.00', '$0.00', '$84.00'],
    ]);
    expect(rows(owed, 'tfoot tr')).toEqual([
      ['Everyone who owes', '$152.00', '$69.00', '$84.00', '$98.00', '$403.00'],
    ]);
    expect(texts(owed, '.panel-note')).toEqual([
      'And 1 more customer who owes — the total covers everyone.',
    ]);

    expect(Array.from(screen.querySelectorAll('a.linkish'), (a) => a.getAttribute('href'))).toEqual(
      ['/reports/daily-sales', '/sales', '/reports/stock-on-hand', '/reports/receivables'],
    );
  });

  it('shows a Seller their own sales, with no profit, cash, money owed or stock value', async () => {
    await open(SELLER, DASHBOARD_SELLER);
    expect(texts(screen, '.band .lead small, .band .usd')).toEqual(['Your sales today', '$361.45']);
    expect(texts(screen, '.band .split small')).toEqual(['Transactions', 'Average sale']);
    const all = screen.querySelectorAll('.tiles');
    expect(all.length).toBe(1);
    expect(all[0].classList).not.toContain('three');
    expect(tiles(all[0]).map((t) => t[0])).toEqual([
      'Below reorder level',
      'Held sales',
      'Quotations to follow up',
      'Open warranty claims',
    ]);
    expect(texts(screen, '.panel h3')).toEqual([
      'Sales, last 7 days',
      'Sales by category, today',
      'Your recent sales',
      'Running low',
    ]);
  });

  it('says so when nothing has happened yet', async () => {
    const sales = DASHBOARD.sales!;
    await open(ADMIN, {
      ...DASHBOARD,
      sales: {
        ...sales,
        last_7_days: sales.last_7_days.map((d) => ({ ...d, sales: '0.00', share: '0.0' })),
        by_category: [],
        recent: [],
      },
      stock: { ...DASHBOARD.stock!, below_reorder: 0, out_of_stock: 0, running_low: [], more: 0 },
      owed: { ...DASHBOARD.owed!, owed: '0.00', over_90: '0.00', rows: [], more: 0 },
      held_sales: 0,
      quotations: { sent: 0, expiring: 0, expired: 0 },
      warranty: { open: 0, out_of_warranty: 0 },
    });
    expect(texts(screen, '.tile .sub.ok')).toContain('Nothing over 90 days');
    expect(tiles(screen.querySelectorAll('.tiles')[1])).toEqual([
      ['Held sales', '0', 'None waiting'],
      ['Quotations to follow up', '0', 'None about to expire'],
      ['Open warranty claims', '0', 'None out of warranty'],
    ]);
    expect(screen.querySelectorAll('.tile .sub.alert').length).toBe(0);
    expect(texts(screen, '.panel .muted')).toEqual([
      'No sales yet today.',
      'No sales yet.',
      'Nothing is below its reorder level.',
      'Nobody owes the shop anything.',
    ]);
    expect(screen.querySelectorAll('tfoot, .panel-note').length).toBe(0);
  });

  it('offers to try again when the figures fail to load', async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    const created = RouterTestingHarness.create('/');
    await answer(http, DASHBOARD_URL, null, { status: 500, statusText: 'Server Error' });
    harness = await created;
    answerShell(http);
    await settle();
    screen = harness.routeNativeElement!;
    expect(screen.querySelector('app-load-error')).not.toBeNull();
    press(screen, 'Try again');
    await answerEach(http, DASHBOARD_URL, () => DASHBOARD, 1, seen);
    await settle();
    expect(texts(screen, '.band .usd')).toEqual(['$1,284.50']);
  });

  it('opens a recent sale read only, as from Sales', async () => {
    await open();
    press(panel('Recent sales')!, 'INV-20261007046', '.rowlink');
    await answer(http, `${INVOICE_URL}146/`, { ...COMPLETED, id: 146, number: 'INV-20261007046' });
    await answer(http, RETURN_URL, page([]));
    await settle();
    expect(texts(dialog(), 'h3')[0]).toBe('Sale INV-20261007046');
    press(dialog(), 'Close');
    await settle();
    expect(dialogCount()).toBe(0);
    expect(seen.length).toBe(1);
  });
});
