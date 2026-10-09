// v1.1.0
import { DatePipe } from '@angular/common';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Me } from '../../api/models/me';
import { SessionStore } from '../../core/session/session-store';
import {
  ADMIN,
  SELLER,
  SHOP_PROFILE,
  answer,
  answerShell,
  signIn,
} from '../../core/session/session-testing';
import { today } from '../../shared/dates';
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
import { CUSTOMERS, CUSTOMER_URL } from '../partners/partners-testing';
import { CUSTOMER_LOOKUP_URL, SOK_LOOKUP, accountOf } from '../sell/sell-testing';
import { answerEach } from '../stock/stock-testing';
import { PAYMENT_URL, PAY_POSTED, PAY_VOID, RATES, RATES_URL, SOK_OWING } from './payments-testing';

function listFor(req: TestRequest): object {
  const params = req.request.params;
  if (params.has('page')) return page([PAY_POSTED, PAY_VOID]);
  return params.get('status') === 'VOID' ? page([], 1) : page([], 18);
}

describe('Customer payment', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/payments');
    await answer(http, CUSTOMER_URL, page(CUSTOMERS));
    await answerEach(http, PAYMENT_URL, listFor, 3, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const lastList = () => seen.filter((r) => r.request.params.has('page')).at(-1)!.request.params;
  const rows = () =>
    Array.from(dialog().querySelectorAll('tbody tr'), (tr) => [
      find<HTMLInputElement>(tr, 'input[type=checkbox]').checked,
      ...texts(tr, 'td').slice(1, 4),
      find<HTMLInputElement>(tr, 'input[type=text]').value,
      texts(tr, 'td')[5],
    ]);
  const saveButton = () =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === 'Save payment',
    )!;

  /** Opens Record a payment and chooses Sok Shop, who owes on three invoices. */
  async function recordForSok(): Promise<HTMLElement> {
    press(screen, 'Record a payment');
    await answer(http, RATES_URL, page(RATES));
    await settle();
    press(dialog(), 'Choose customer');
    await answer(http, CUSTOMER_LOOKUP_URL, [SOK_LOOKUP]);
    await settle();
    press(dialog(), 'Select');
    await answer(http, accountOf(2), SOK_OWING);
    await settle();
    return dialog();
  }

  it('lists payments with what each paid off, and counts the month', async () => {
    await open();
    expect(lastList().get('date_from')).toBe(`${today().slice(0, 7)}-01`);
    expect(
      Array.from(screen.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td').slice(0, 8)),
    ).toEqual([
      [
        'PAY-000047',
        '6 Oct 2026',
        'Sok Shop',
        'Cash',
        'INV-20260901001, INV-20260920001',
        '$500.00',
        'Bopha Ly',
        'Posted',
      ],
      [
        'PAY-000046',
        '20 Sep 2026',
        'Sok Shop',
        'KHQR',
        'INV-20260901001',
        '$100.00 ៛410,000',
        'Bopha Ly',
        'Void',
      ],
    ]);
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b'))).toEqual([
      ['Payments this month', '18'],
      ['Voided this month', '1'],
    ]);
    choose(screen, 'select[aria-label="Customer"]', '2');
    await answerEach(http, PAYMENT_URL, listFor, 1, seen);
    choose(screen, 'select[aria-label="Status"]', 'VOID');
    await answerEach(http, PAYMENT_URL, listFor, 1, seen);
    expect([lastList().get('customer'), lastList().get('status'), lastList().get('page')]).toEqual([
      '2',
      'VOID',
      '1',
    ]);
  });

  it('fills the oldest invoices first, and saves the payment applied in full', async () => {
    await open();
    const card = await recordForSok();
    expect(texts(card, '.picked')[0]).toContain('owes $1,030.00');
    type(card, '#pay-amount', '500');
    await settle();
    expect(rows()).toEqual([
      [true, 'INV-20260901001 1 Sep 2026', '15 Sep 2026', '$300.00', '300.00', 'Settled'],
      [true, 'INV-20260920001 1 Sep 2026', '20 Oct 2026', '$250.00', '200.00', '$50.00 left'],
      [false, 'INV-20261006001 1 Sep 2026', '5 Nov 2026', '$480.00', '', 'Untouched'],
    ]);
    expect(card.querySelectorAll('tbody tr')[0].querySelectorAll('td')[2].classList).toContain(
      'neg',
    );
    expect(saveButton().disabled).toBe(false);

    press(card, 'Save payment');
    const req = http.expectOne((r) => r.url === PAYMENT_URL && r.method === 'POST');
    expect(req.request.body).toEqual({
      customer: 2,
      payment_date: today(),
      tender: 'CASH',
      currency: 'USD',
      amount_tendered: '500',
      reference: '',
      note: '',
      allocations: [
        { invoice: 101, amount: '300.00' },
        { invoice: 102, amount: '200.00' },
      ],
    });
    req.flush(PAY_POSTED);
    await answerEach(http, PAYMENT_URL, listFor, 3, seen);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('lets a line be changed by hand, and saves only once nothing is left to apply', async () => {
    await open();
    const card = await recordForSok();
    type(card, '#pay-amount', '500');
    await settle();
    // Leave the overdue one for later; pay the newest instead.
    find<HTMLInputElement>(card, 'input[aria-label="Apply to INV-20260901001"]').click();
    await settle();
    find<HTMLInputElement>(card, 'input[aria-label="Apply to INV-20261006001"]').click();
    await settle();
    expect(rows().map((r) => r[4])).toEqual(['', '200.00', '300.00']);
    type(card, 'input[aria-label="Applying to INV-20260920001"]', '250');
    await settle();
    expect(texts(card, 'tfoot td').at(-1)).toBe('−$50.00 left to apply');
    expect(saveButton().disabled).toBe(true);
    type(card, 'input[aria-label="Applying to INV-20261006001"]', '250');
    await settle();
    expect(saveButton().disabled).toBe(false);

    press(card, 'Save payment');
    const req = http.expectOne((r) => r.url === PAYMENT_URL && r.method === 'POST');
    expect(req.request.body.allocations).toEqual([
      { invoice: 102, amount: '250' },
      { invoice: 103, amount: '250' },
    ]);
    req.flush(PAY_POSTED);
    await answerEach(http, PAYMENT_URL, listFor, 3, seen);
    await settle();
  });

  it("converts riel at the rate of the payment's date", async () => {
    await open();
    const card = await recordForSok();
    choose(card, '#pay-currency', 'KHR');
    type(card, '#pay-amount', '410000');
    type(card, '#pay-date', '2026-09-20');
    await settle();
    expect(
      find(card, '#pay-amount').closest('.field')!.querySelector('.hint')!.textContent!.trim(),
    ).toBe('$100.00 at ៛4,100, the rate on that date.');
    expect(rows()[0].slice(4)).toEqual(['100.00', '$200.00 left']);
    type(card, '#pay-date', today());
    await settle();
    expect(rows()[0][4]).toBe('102.50');
  });

  it('says so before saving more than the customer owes', async () => {
    await open();
    const card = await recordForSok();
    type(card, '#pay-amount', '2000');
    await settle();
    expect(texts(card, '.hint.warn')).toContain('More than the customer owes.');
    expect(saveButton().disabled).toBe(true);
  });

  it('prints the receipt on saving, reprints it as a copy, and never a void one', async () => {
    await open();
    const printed: string[][] = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      printed.push([
        texts(document, '#print-root .inv-title')[0],
        texts(document, '#print-root .inv-owed th, #print-root .inv-owed td').join(' '),
      ]);
    });
    const card = await recordForSok();
    type(card, '#pay-amount', '500');
    await settle();
    press(card, 'Save and print receipt');
    http.expectOne((r) => r.url === PAYMENT_URL && r.method === 'POST').flush(PAY_POSTED);
    await answer(http, '/api/company/profile/', SHOP_PROFILE);
    await answer(http, accountOf(2), { ...SOK_OWING, balance: '530.00' });
    await answerEach(http, PAYMENT_URL, listFor, 3, seen);
    await settle();
    expect(dialogCount()).toBe(0);
    expect(printed).toEqual([
      [
        'Payment receipt',
        `Still owed on ${new DatePipe('en-US').transform(today(), 'd MMM y')} $530.00`,
      ],
    ]);

    find<HTMLButtonElement>(screen.querySelector('tbody tr')!, '.rowlink').click();
    await settle();
    press(dialog(), 'Print');
    await answer(http, '/api/company/profile/', SHOP_PROFILE);
    await answer(http, accountOf(2), SOK_OWING);
    await settle();
    expect(printed.at(-1)![0]).toBe('Payment receipt Copy');
    press(dialog(), 'Close');
    await settle();

    find<HTMLButtonElement>(screen.querySelectorAll('tbody tr')[1], '.rowlink').click();
    await settle();
    expect(texts(dialog(), '.form-foot button')).not.toContain('Print');
    press(dialog(), 'Close');
    await settle();
    print.mockRestore();
  });

  it('lets an Admin void a payment with a reason, and nobody else', async () => {
    await open();
    find<HTMLButtonElement>(screen.querySelector('tbody tr')!, '.rowlink').click();
    await settle();
    expect(texts(dialog(), 'tbody td')).toEqual([
      'INV-20260901001',
      '$300.00',
      'INV-20260920001',
      '$200.00',
    ]);
    press(dialog(), 'Void payment…');
    await settle();
    type(dialog(), '#reason-text', 'Cheque returned');
    press(dialog(), 'Void payment');
    const req = http.expectOne(`${PAYMENT_URL}47/void/`);
    expect(req.request.body).toEqual({ reason: 'Cheque returned' });
    req.flush({ ...PAY_POSTED, status: 'VOID' });
    await answerEach(http, PAYMENT_URL, listFor, 3, seen);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('lets a Seller record payments but not void them', async () => {
    await open(SELLER);
    expect(texts(screen, '.filters .btn')).toEqual(['Record a payment']);
    find<HTMLButtonElement>(screen.querySelector('tbody tr')!, '.rowlink').click();
    await settle();
    expect(texts(dialog(), '.form-foot button')).toEqual(['Print', 'Close']);
    press(dialog(), 'Close');
    await settle();
  });
});
