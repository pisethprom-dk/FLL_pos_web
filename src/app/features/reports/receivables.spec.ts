// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../core/session/session-store';
import { ADMIN, SELLER, answer, answerShell, signIn } from '../../core/session/session-testing';
import {
  APP_PROVIDERS,
  choose,
  dialog,
  dialogCount,
  find,
  press,
  texts,
  type,
} from '../../shared/screen-testing';
import { page } from '../catalogue/catalogue-testing';
import { PAYMENT_URL, PAY_POSTED, RATES, RATES_URL, SOK_OWING } from '../payments/payments-testing';
import { CUSTOMER_LOOKUP_URL, SOK_LOOKUP, accountOf } from '../sell/sell-testing';
import { answerEach } from '../stock/stock-testing';
import { RECEIVABLES, RECEIVABLES_URL } from './reports-testing';

describe('Receivables', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    const created = RouterTestingHarness.create('/reports/receivables');
    await answerEach(http, RECEIVABLES_URL, () => RECEIVABLES, 1, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const cells = (root: ParentNode, part: string) =>
    Array.from(root.querySelectorAll(part), (tr) => texts(tr, 'td'));

  it('shows what each customer owes, aged, with the totals and who is flagged', async () => {
    await open();
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b, .sub'))).toEqual(
      [
        ['Total owed', '$303.00', "៛1,242,300 at today's rate"],
        ['Past 60 days', '$182.00', '60.1% of the total'],
        ['Collected this month', '$40.00', 'Payments posted'],
        ['Over limit or on hold', '2', 'Sok Shop, Dara Grocery'],
      ],
    );
    expect(cells(screen, 'tbody tr').map((r) => r.slice(1))).toEqual([
      ['$52.00', '$69.00', '$0.00', '$98.00', '$219.00', '$200.00', '−$19.00', 'Open'],
      ['$0.00', '$0.00', '$84.00', '$0.00', '$84.00', '$1,200.00', '$1,116.00', 'Open'],
    ]);
    expect(
      Array.from(screen.querySelectorAll('tbody tr td:first-child'), (td) =>
        texts(td, '.pill, .cell-sub'),
      ),
    ).toEqual([
      ['Over limit', 'CUS-000001'],
      ['On hold', 'CUS-000002'],
    ]);
    expect(cells(screen, 'tfoot tr')).toEqual([
      ['Total', '$52.00', '$69.00', '$84.00', '$98.00', '$303.00', '$1,400.00', '$1,097.00', ''],
    ]);
    choose(screen, 'select[aria-label="Show"]', 'on_hold');
    await answerEach(http, RECEIVABLES_URL, () => RECEIVABLES, 1, seen);
    expect(seen.at(-1)!.request.params.get('show')).toBe('on_hold');
  });

  it("opens a customer's invoices and records a payment with them already chosen", async () => {
    await open();
    find<HTMLButtonElement>(screen.querySelector('tbody tr')!, '.rowlink').click();
    await answer(http, accountOf(2), SOK_OWING);
    await settle();
    const panel = screen.querySelectorAll('.panel')[1] as HTMLElement;
    expect(texts(panel, '.panel-head h3')).toEqual(['Sok Shop — open invoices']);
    expect(cells(panel, 'tbody tr').map((r) => [r[0], r[3], r[6], r[7]])).toEqual([
      ['INV-20260901001', '$300.00', '$300.00', 'Overdue'],
      ['INV-20260920001', '$250.00', '$250.00', 'Open'],
      ['INV-20261006001', '$480.00', '$480.00', 'Open'],
    ]);
    expect(cells(panel, 'tfoot tr')).toEqual([['Balance owed', '$1,030.00', '']]);

    press(panel, 'Record a payment');
    const lookup = http.expectOne((r) => r.url === CUSTOMER_LOOKUP_URL);
    expect(lookup.request.params.get('search')).toBe('CUS-000001');
    lookup.flush([SOK_LOOKUP]);
    await answer(http, RATES_URL, page(RATES));
    await answer(http, accountOf(2), SOK_OWING);
    await settle();
    expect(texts(dialog(), '.picked')[0]).toContain('Sok Shop');
    type(dialog(), '#pay-amount', '300');
    await settle();
    press(dialog(), 'Save payment');
    http.expectOne((r) => r.url === PAYMENT_URL && r.method === 'POST').flush(PAY_POSTED);
    await answerEach(http, RECEIVABLES_URL, () => RECEIVABLES, 1, seen);
    await answer(http, accountOf(2), SOK_OWING);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('is not for a Seller', async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, SELLER);
    harness = await RouterTestingHarness.create('/reports/receivables');
    answerShell(http);
    await harness.fixture.whenStable();
    expect(http.match(RECEIVABLES_URL)).toEqual([]);
    expect(harness.routeNativeElement!.textContent).toContain('Not available');
  });
});
