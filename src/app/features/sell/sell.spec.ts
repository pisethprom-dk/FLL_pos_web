// v1.3.0
import { HttpTestingController } from '@angular/common/http/testing';
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
import { BRANDS, BRAND_URL, CATEGORIES, CATEGORY_URL, page } from '../catalogue/catalogue-testing';
import { QUOTE_URL, QUO_ACCEPTED } from '../quotations/quotations-testing';
import { DASHBOARD, DASHBOARD_URL } from '../reports/reports-testing';
import { LOOKUP_URL, answerEach, key } from '../stock/stock-testing';
import {
  COMPLETED,
  CUSTOMER_LOOKUP_URL,
  DARA_ACCOUNT,
  DARA_LOOKUP,
  DRILL_PRICED,
  HELD,
  HELD_LABELLED,
  INVOICE_URL,
  LEVEL,
  SOK_ACCOUNT,
  SOK_LOOKUP,
  WALK_IN_LOOKUP,
  accountOf,
} from './sell-testing';

const CUSTOMERS = [WALK_IN_LOOKUP, SOK_LOOKUP, DARA_LOOKUP];

describe('Sell', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;

  /** What the till asks for as it opens: customers, held sales, and the picker's lists. */
  async function answerOpening(held = 0): Promise<void> {
    await answer(http, CUSTOMER_LOOKUP_URL, CUSTOMERS);
    await answerEach(http, INVOICE_URL, () => page([], held), 1);
    await answer(http, BRAND_URL, page(BRANDS));
    await answer(http, CATEGORY_URL, page(CATEGORIES));
  }

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/sell');
    await answerOpening();
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => sessionStorage.clear());
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const spans = () => texts(screen, 'app-sale-money .sumline span');
  const lineCells = () =>
    Array.from(screen.querySelectorAll('app-sale-lines tbody tr'), (tr) => texts(tr, 'td'));
  const qtyOf = (code: string) =>
    find<HTMLInputElement>(screen, `input[aria-label="Quantity, ${code}"]`);
  const completeButton = () =>
    Array.from(screen.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === 'Complete sale',
    )!;

  async function scan(code: string, found: object[]): Promise<void> {
    const box = find<HTMLInputElement>(screen, 'input[aria-label="Barcode or code"]');
    box.value = code;
    key(box, 'Enter');
    await answer(http, LOOKUP_URL, found);
    await settle();
  }

  async function pay(amount: string, kind = 'CASH'): Promise<void> {
    press(screen, 'Add payment');
    await settle();
    const card = dialog();
    choose(card, '#tender-kind', kind);
    type(card, '#tender-amount', amount);
    press(card, 'Add payment');
    await settle();
  }

  /** Clicks a buyer card, as a person would. Its dialog's search is answered by the test. */
  function buyer(index: number): void {
    screen.querySelectorAll<HTMLInputElement>('input[name=buyer]')[index].click();
  }

  it('starts on a walk-in at retail, adds one more on a rescan, and shows the riel', async () => {
    await open();
    const cards = screen.querySelectorAll<HTMLInputElement>('input[name=buyer]');
    expect(Array.from(cards, (c) => c.checked)).toEqual([true, false, false]);
    await scan('TL-0101', [DRILL_PRICED]);
    await scan('8850000000101', [DRILL_PRICED]);
    expect(qtyOf('TL-0101').value).toBe('2');
    expect(lineCells()[0][0]).toBe('Impact drill 13mm 710W TL-0101 · Bosch GSB 550 · Piece');
    expect(lineCells()[0].slice(2, 5)).toEqual(['$78.00', '%$', '$156.00']);
    expect(spans()).toEqual([
      'Subtotal',
      '$156.00',
      'Discount given',
      '—',
      'To pay',
      '$156.00',
      'In riel at ៛4,100',
      '៛639,600',
      'Paid now',
      '$0.00',
      'On credit',
      '—',
      'Still to cover',
      '$156.00',
      'Change due',
      '$0.00',
    ]);
    expect(completeButton().disabled).toBe(true);
  });

  it('refuses over 15% on the line, and warns when the shelf is short', async () => {
    await open();
    await scan('TL-0101', [DRILL_PRICED]);
    type(screen, 'input[aria-label="Discount, TL-0101"]', '16');
    type(screen, 'input[aria-label="Quantity, TL-0101"]', '20');
    await settle();
    expect(texts(screen, 'app-sale-lines .cell-note')).toEqual([
      'Only 14 on hand',
      'Over the 15% limit — refused.',
    ]);
    expect(texts(screen, '.panel-note').at(-1)).toBe('Put right the lines marked in red.');
    expect(completeButton().disabled).toBe(true);
  });

  it('takes cash, gives change in dollars and riel, and completes the sale', async () => {
    await open();
    type(screen, '#walkin-name', 'Dara');
    await scan('TL-0283', [LEVEL]);
    type(screen, 'input[aria-label="Quantity, TL-0283"]', '5');
    await settle();
    press(screen, 'Add payment');
    await settle();
    expect(find<HTMLInputElement>(dialog(), '#tender-amount').value).toBe('361.45');
    type(dialog(), '#tender-amount', '400');
    press(dialog(), 'Add payment');
    await settle();
    expect(texts(screen, 'app-sale-money tbody td')).toEqual([
      'Cash · USD',
      '$400.00',
      '$400.00',
      '×',
    ]);
    expect(spans().slice(-4)).toEqual(['Change due', '$38.55', 'Change given', '$38.00 + ៛2,300']);

    press(screen, 'Complete sale');
    const create = http.expectOne((r) => r.url === INVOICE_URL && r.method === 'POST');
    expect(create.request.body).toEqual({
      customer: 1,
      quotation: null,
      hold_label: '',
      walk_in_name: 'Dara',
      walk_in_phone: '',
      lines: [{ product: 31, quantity: '5', discount_type: '', discount_value: '0' }],
    });
    create.flush(HELD);
    const complete = http.expectOne(`${INVOICE_URL}900/complete/`);
    expect(complete.request.body).toEqual({
      tenders: [{ kind: 'CASH', currency: 'USD', amount: '400' }],
    });
    complete.flush(COMPLETED);
    await answerEach(http, INVOICE_URL, () => page([], 0), 1);
    await settle();

    const done = dialog();
    expect(find<HTMLInputElement>(done, '#done-number').value).toBe('INV-20261006001');
    expect(find<HTMLInputElement>(done, '#done-khr').value).toBe('៛1,481,900');
    expect(find<HTMLInputElement>(done, '#done-change').value).toBe('$38.55 — $38.00 and ៛2,300');

    // Print invoice loads the shop's details and opens the browser's print.
    const titles: string[] = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      titles.push(texts(document, '#print-root .inv-title')[0]);
    });
    press(done, 'Print invoice');
    await answer(http, '/api/company/profile/', SHOP_PROFILE);
    await settle();
    expect(titles).toEqual(['Invoice']);
    print.mockRestore();
    press(done, 'New sale');
    await settle();
    expect(lineCells()).toEqual([['No lines yet. Scan a barcode or type a code above.']]);
    expect(sessionStorage.getItem('pos-sale')).toBeNull();
  });

  it('deletes the held invoice again when completing is refused', async () => {
    await open();
    await scan('TL-0283', [LEVEL]);
    await pay('72.29');
    press(screen, 'Complete sale');
    http.expectOne((r) => r.url === INVOICE_URL && r.method === 'POST').flush(HELD);
    http
      .expectOne(`${INVOICE_URL}900/complete/`)
      .flush(
        { detail: 'Not enough TL-0283 Spirit level 600mm: 0.00 on hand, 1.00 needed.' },
        { status: 400, statusText: 'Bad Request' },
      );
    const cleanup = http.expectOne(`${INVOICE_URL}900/`);
    expect(cleanup.request.method).toBe('DELETE');
    cleanup.flush(null);
    await settle();
    expect(texts(screen, '.form-error')).toEqual([
      'Not enough TL-0283 Spirit level 600mm: 0.00 on hand, 1.00 needed.',
    ]);
    expect(lineCells()).toHaveLength(1);
  });

  it('offers credit only to a store customer allowed it, and says what it does', async () => {
    await open();
    buyer(1);
    await answer(http, CUSTOMER_LOOKUP_URL, CUSTOMERS);
    await settle();
    expect(texts(dialog(), 'tbody td:first-child')).toEqual([
      'Sok Shop CUS-000001 · 012 330 441',
      'Dara Grocery CUS-000002',
    ]);
    expect(texts(dialog(), 'tbody tr:nth-child(2) .cell-sub')).toContain('Cash only');
    press(dialog(), 'Select');
    await answer(http, accountOf(2), SOK_ACCOUNT);
    await settle();
    expect(texts(screen, '.who .meta')).toEqual([
      'CUS-000001 · 012 330 441 · owes $1,030.00 of $1,500.00',
    ]);

    await scan('TL-0101', [DRILL_PRICED]);
    expect(lineCells()[0][2]).toBe('$69.00');
    press(screen, 'Add payment');
    await settle();
    expect(texts(dialog(), '#tender-kind option')).toEqual(['Cash', 'KHQR', 'Credit · Sok Shop']);
    choose(dialog(), '#tender-kind', 'CREDIT');
    press(dialog(), 'Add payment');
    await settle();
    expect(texts(screen, 'app-sale-money .note')[0]).toMatch(
      /^Credit of \$69\.00 takes Sok Shop to \$1,099\.00 against a \$1,500\.00 limit\. Due /,
    );
    expect(completeButton().disabled).toBe(false);

    // A customer on hold: chosen, but no credit — and the earlier payments are dropped.
    press(screen, 'Change customer');
    await answer(http, CUSTOMER_LOOKUP_URL, CUSTOMERS);
    await settle();
    find<HTMLButtonElement>(dialog(), 'tbody tr:nth-child(2) .rowlink').click();
    await answer(http, accountOf(3), DARA_ACCOUNT);
    await settle();
    expect(texts(screen, '.who .meta')[0]).toContain('on credit hold — cash only');
    press(screen, 'Add payment');
    await settle();
    expect(texts(dialog(), '#tender-kind option')).toEqual(['Cash', 'KHQR']);
    press(dialog(), 'Cancel');
    await settle();
  });

  it('sells from a quotation: its own lines, at the agreed prices, no more than remains', async () => {
    await open();
    buyer(2);
    await answerEach(http, QUOTE_URL, () => page([QUO_ACCEPTED]), 1);
    await settle();
    press(dialog(), 'Select anyway');
    await answer(http, accountOf(2), SOK_ACCOUNT);
    await settle();
    expect(find<HTMLInputElement>(screen, 'input[aria-label="Barcode or code"]').disabled).toBe(
      true,
    );
    expect(lineCells().map((cells) => [cells[0], cells[1], cells[2], cells[4]])).toEqual([
      ['Impact drill 13mm 710W TL-0101 · Piece', '', '$69.00', '$65.55'],
      ['Angle grinder 100mm 570W TL-0118 · Piece', '', '$52.00', '$52.00'],
    ]);
    expect(find<HTMLInputElement>(screen, 'input[aria-label="Discount, TL-0101"]').disabled).toBe(
      true,
    );
    type(screen, 'input[aria-label="Quantity, TL-0101"]', '2');
    await settle();
    expect(texts(screen, 'app-sale-lines .cell-note')[0]).toBe('Only 1 left on the quotation.');
    type(screen, 'input[aria-label="Quantity, TL-0101"]', '1');
    await settle();

    await pay('117.55');
    press(screen, 'Complete sale');
    const create = http.expectOne((r) => r.url === INVOICE_URL && r.method === 'POST');
    expect(create.request.body).toEqual(
      expect.objectContaining({
        customer: 2,
        quotation: 42,
        lines: [
          { quote_line: 502, quantity: '1' },
          { quote_line: 503, quantity: '1' },
        ],
      }),
    );
    create.flush({ ...HELD, customer: 2, quotation: 42 });
    http
      .expectOne(`${INVOICE_URL}900/complete/`)
      .flush({ ...COMPLETED, customer: 2, customer_name: 'Sok Shop', walk_in_name: '' });
    await answerEach(http, INVOICE_URL, () => page([], 0), 1);
    await settle();
    press(dialog(), 'New sale');
    await settle();
  });

  it('holds a sale under a label, and completes it once resumed', async () => {
    await open();
    type(screen, '#walkin-name', 'Dara');
    await scan('TL-0283', [LEVEL]);
    press(screen, 'Hold sale');
    await settle();
    type(dialog(), '#hold-label', 'Blue pickup');
    press(dialog(), 'Hold');
    const hold = http.expectOne((r) => r.url === INVOICE_URL && r.method === 'POST');
    expect(hold.request.body).toEqual(
      expect.objectContaining({ hold_label: 'Blue pickup', walk_in_name: 'Dara' }),
    );
    hold.flush(HELD_LABELLED);
    await answerEach(http, INVOICE_URL, () => page([HELD_LABELLED], 1), 1);
    await settle();
    expect(texts(screen, '.note')).toContain(
      'Sale held as “Blue pickup”. Find it again under Held sales.',
    );
    expect(lineCells()).toEqual([['No lines yet. Scan a barcode or type a code above.']]);

    press(screen, 'Held sales (1)');
    await answerEach(http, INVOICE_URL, () => page([HELD_LABELLED], 1), 1);
    await settle();
    expect(texts(dialog(), 'tbody td').slice(0, 4)).toEqual([
      'Blue pickup',
      'Walk-in customer — Dara',
      '1',
      '$361.45',
    ]);
    press(dialog(), 'Resume');
    await answerEach(http, INVOICE_URL, () => page([HELD_LABELLED], 1), 1);
    await settle();
    expect(qtyOf('TL-0283').value).toBe('5');
    expect(find<HTMLInputElement>(screen, '#walkin-name').value).toBe('Dara');

    await pay('400');
    press(screen, 'Complete sale');
    const update = http.expectOne(`${INVOICE_URL}901/`);
    expect(update.request.method).toBe('PATCH');
    update.flush(HELD_LABELLED);
    http.expectOne(`${INVOICE_URL}901/complete/`).flush({ ...COMPLETED, id: 901 });
    await answerEach(http, INVOICE_URL, () => page([], 0), 1);
    await settle();
    press(dialog(), 'New sale');
    await settle();
  });

  it('keeps the sale through a reload of the page', async () => {
    await open();
    await scan('TL-0283', [LEVEL]);
    expect(sessionStorage.getItem('pos-sale')).toContain('TL-0283');
    const away = harness.navigateByUrl('/');
    await answer(http, DASHBOARD_URL, DASHBOARD);
    await away;
    const back = harness.navigateByUrl('/sell');
    await answerOpening();
    await back;
    await settle();
    screen = harness.routeNativeElement!;
    expect(qtyOf('TL-0283').value).toBe('1');
  });

  it('lets a Seller sell', async () => {
    await open(SELLER);
    expect(completeButton()).toBeTruthy();
    expect(dialogCount()).toBe(0);
  });
});
