// v1.0.1
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Me } from '../../api/models/me';
import { SessionStore } from '../../core/session/session-store';
import { ADMIN, SELLER, answer, answerShell, signIn } from '../../core/session/session-testing';
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
import { COMPLETED, INVOICE_URL, accountOf } from '../sell/sell-testing';
import { answerEach } from '../stock/stock-testing';
import {
  RETURN_CREDITED,
  RETURN_DRAFT,
  RETURN_POSTED,
  RETURN_URL,
  SOK_OWES_20,
  SOLD,
  VOIDED,
} from './returns-testing';

const BAD = { status: 400, statusText: 'Bad Request' };

function returnsFor(req: TestRequest): object {
  if (req.request.params.has('page')) return page([RETURN_POSTED, RETURN_DRAFT, RETURN_CREDITED]);
  return page([], 4);
}

function voidsFor(req: TestRequest): object {
  return req.request.params.has('page') ? page([VOIDED]) : page([], 2);
}

/** A Seller's own sale from this morning — the only kind they may void. */
const TODAY_SALE = { ...COMPLETED, seller: 2, seller_name: 'Sokha Chan' };

describe('Returns & voids', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/returns');
    await answer(http, CUSTOMER_URL, page(CUSTOMERS));
    await answerEach(http, RETURN_URL, returnsFor, 2, seen);
    await answerEach(http, INVOICE_URL, voidsFor, 1, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  /** After a save: the list on show and both counts load again. */
  async function reloaded(returns: number, invoices: number): Promise<void> {
    await answerEach(http, RETURN_URL, returnsFor, returns, seen);
    await answerEach(http, INVOICE_URL, voidsFor, invoices, seen);
    await settle();
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const rowsOf = (root: ParentNode, cells: number) =>
    Array.from(root.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td').slice(0, cells));
  const field = (id: string) => find<HTMLInputElement>(dialog(), id).value;
  const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === text,
    )!;
  const hint = () => texts(dialog(), '.field.wide .hint').at(-1);

  /** New return against Sok Shop's invoice, which still owes $20. */
  async function newReturn(): Promise<HTMLElement> {
    press(screen, 'New return');
    await settle();
    press(dialog(), 'Choose invoice');
    await answerEach(http, INVOICE_URL, () => page([SOLD]), 1, seen);
    await settle();
    press(dialog(), 'Select');
    await answer(http, accountOf(2), SOK_OWES_20);
    await settle();
    return dialog();
  }

  it('lists returns with how each settled, and switches to voided invoices', async () => {
    await open();
    expect(seen[0].request.params.get('date_from')).toBe(`${today().slice(0, 7)}-01`);
    expect(rowsOf(screen, 8)).toEqual([
      [
        'RTN-000018',
        '3 Oct 2026',
        'INV-20260927001',
        'Sok Shop',
        'Over-ordered, 2 sets back',
        '$51.00',
        '$20.00 credited, $31.00 cash refund',
        'Posted',
      ],
      [
        'RTN-000019',
        '6 Oct 2026',
        'INV-20260927001',
        'Sok Shop',
        'Over-ordered, 2 sets back',
        '$51.00',
        '—',
        'Draft',
      ],
      [
        'RTN-000017',
        '2 Oct 2026',
        'INV-20260927001',
        'Sok Shop',
        'Faulty on arrival',
        '$25.50',
        'Credited to the invoice',
        'Posted',
      ],
    ]);
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b'))).toEqual([
      ['Returns this month', '4'],
      ['Voided this month', '2'],
    ]);

    choose(screen, 'select[aria-label="Show"]', 'voids');
    await answerEach(http, INVOICE_URL, voidsFor, 1, seen);
    await settle();
    expect(seen.at(-1)!.request.params.get('status')).toBe('VOID');
    expect(screen.querySelector('select[aria-label="Status"]')).toBeNull();
    expect(rowsOf(screen, 6)).toEqual([
      [
        'INV-20261001002',
        '1 Oct 2026',
        'Dara',
        'Rung up twice by mistake',
        '$361.45',
        expect.stringMatching(/^Bopha Ly 1 Oct 2026, \d\d:30$/),
      ],
    ]);
    press(screen, 'Open');
    await settle();
    expect(field('#vi-reason')).toBe('Rung up twice by mistake');
    expect(rowsOf(dialog(), 4)).toEqual([
      ['Spirit level 600mm TL-0283', '5 Piece', '$72.29', '$361.45'],
    ]);
    press(dialog(), 'Close');
    await settle();
  });

  it('credits what the invoice still owes, refunds the rest, and posts in one go', async () => {
    await open();
    const card = await newReturn();
    expect(rowsOf(card, 8).map((r) => r.slice(1, 5))).toEqual([
      ['Combination spanner set, 14 piece TL-0241', '12', '0', ''],
      ['Impact drill 13mm 710W TL-0101', '1', '1', 'All back'],
      ['Electric wire 2.5mm EL-0025', '10.5', '0', ''],
    ]);
    expect(find<HTMLInputElement>(card, 'input[aria-label="Return TL-0101"]').disabled).toBe(true);

    // Ticking puts in all that is left; 10.5 m at $0.85 is $8.925, rounded half to even.
    find<HTMLInputElement>(card, 'input[aria-label="Return EL-0025"]').click();
    await settle();
    expect(rowsOf(card, 8)[2].slice(4, 7)).toEqual(['', '$0.85', '$8.92']);
    find<HTMLInputElement>(card, 'input[aria-label="Return EL-0025"]').click();
    find<HTMLInputElement>(card, 'input[aria-label="Return TL-0241"]').click();
    await settle();
    expect(find<HTMLInputElement>(card, 'input[aria-label="Returning, TL-0241"]').value).toBe('12');
    type(card, 'input[aria-label="Returning, TL-0241"]', '13');
    await settle();
    expect(texts(card, '.cell-note')).toEqual(['Only 12 can come back.']);
    type(card, 'input[aria-label="Returning, TL-0241"]', '2');
    await settle();
    expect([field('#ret-credited'), field('#ret-refunded')]).toEqual(['$20.00', '$31.00']);
    expect(hint()).toBe('Say why the goods came back.');
    type(card, '#ret-reason', 'Over-ordered, 2 sets back');
    await settle();
    expect(hint()).toBe('Choose how the refund is paid.');
    expect(button('Post return').disabled).toBe(true);
    choose(card, '#ret-refund', 'CASH');
    await settle();
    expect(button('Post return').disabled).toBe(false);

    press(card, 'Post return');
    await settle();
    expect(texts(dialog(), '.confirm-message')[0]).toBe(
      '1 line, $51.00. The goods go back into stock. $20.00 comes off what ' +
        'INV-20260927001 still owes. $31.00 is refunded by Cash. A posted return cannot be undone.',
    );
    press(dialog(), 'Post return');
    const create = http.expectOne((r) => r.url === RETURN_URL && r.method === 'POST');
    expect(create.request.body).toEqual({
      invoice: 120,
      return_date: today(),
      reason: 'Over-ordered, 2 sets back',
      refund_method: 'CASH',
      lines: [{ invoice_line: 501, quantity: '2', fit_to_sell: true }],
    });
    create.flush({ ...RETURN_DRAFT, refund_method: 'CASH' });
    http.expectOne(`${RETURN_URL}19/post/`).flush(RETURN_POSTED);
    await reloaded(2, 1);
    expect(dialogCount()).toBe(0);
  });

  it('reopens a draft, keeps it when posting is refused, and deletes it', async () => {
    await open();
    find<HTMLButtonElement>(screen.querySelectorAll('tbody tr')[1], '.rowlink').click();
    await answer(http, `${INVOICE_URL}120/`, SOLD);
    await answer(http, accountOf(2), SOK_OWES_20);
    await settle();
    const card = dialog();
    expect(texts(card, 'h3')[0]).toBe('Return RTN-000019');
    expect(find<HTMLInputElement>(card, 'input[aria-label="Return TL-0241"]').checked).toBe(true);
    expect(find<HTMLInputElement>(card, 'input[aria-label="Returning, TL-0241"]').value).toBe('2');
    expect(field('#ret-reason')).toBe('Over-ordered, 2 sets back');
    expect(texts(card, 'button').includes('Change')).toBe(false);

    choose(card, 'select[aria-label="Back into stock, TL-0241"]', 'no');
    choose(card, '#ret-refund', 'KHQR');
    await settle();
    press(card, 'Post return');
    await settle();
    expect(texts(dialog(), '.confirm-message')[0]).toBe(
      '1 line, $51.00. Faulty goods do not go back into stock. $20.00 comes off what ' +
        'INV-20260927001 still owes. $31.00 is refunded by KHQR. A posted return cannot be undone.',
    );
    press(dialog(), 'Post return');
    const update = http.expectOne((r) => r.url === `${RETURN_URL}19/` && r.method === 'PATCH');
    expect(update.request.body.lines).toEqual([
      { invoice_line: 501, quantity: '2', fit_to_sell: false },
    ]);
    expect(update.request.body.refund_method).toBe('KHQR');
    update.flush({ ...RETURN_DRAFT, refund_method: 'KHQR' });
    http
      .expectOne(`${RETURN_URL}19/post/`)
      .flush({ detail: 'TL-0241: only 1 can still come back on INV-20260927001.' }, BAD);
    await settle();
    expect(dialogCount()).toBe(1);
    expect(texts(dialog(), '.form-error')).toEqual([
      'TL-0241: only 1 can still come back on INV-20260927001.',
    ]);

    press(dialog(), 'Delete draft');
    await settle();
    press(dialog(), 'Delete draft');
    http.expectOne((r) => r.url === `${RETURN_URL}19/` && r.method === 'DELETE').flush(null);
    await reloaded(2, 1);
    expect(dialogCount()).toBe(0);
  });

  it('opens a posted return read only, with how the server settled it', async () => {
    await open();
    press(screen, 'Open');
    await settle();
    const card = dialog();
    expect(rowsOf(card, 6)).toEqual([
      [
        'Combination spanner set, 14 piece TL-0241',
        '12',
        '2',
        '$25.50',
        '$51.00',
        'Yes — fit to sell',
      ],
    ]);
    expect([field('#ret-credited'), field('#ret-refunded')]).toEqual(['$20.00', '$31.00 · Cash']);
    expect(texts(card, '.form-foot button')).toEqual(['Close']);
    press(card, 'Close');
    await settle();
  });

  it('lets a Seller void only their own invoices from today', async () => {
    await open(SELLER);
    press(screen, 'Void an invoice');
    await answerEach(http, INVOICE_URL, () => page([TODAY_SALE]), 1, seen);
    await settle();
    const params = seen.at(-1)!.request.params;
    expect([params.get('status'), params.get('seller'), params.get('date_from')]).toEqual([
      'COMPLETED',
      '2',
      today(),
    ]);
    press(dialog(), 'Select');
    await settle();
    expect(texts(dialog(), 'h3')[0]).toBe('Void INV-20261006001?');
    type(dialog(), '#reason-text', 'Rung up twice by mistake');
    press(dialog(), 'Void this invoice');
    const req = http.expectOne(`${INVOICE_URL}900/void/`);
    expect(req.request.body).toEqual({ reason: 'Rung up twice by mistake' });
    req.flush({ ...TODAY_SALE, status: 'VOID' });
    await reloaded(1, 2);
    expect(find<HTMLSelectElement>(screen, 'select[aria-label="Show"]').value).toBe('voids');
    expect(texts(screen, 'tbody td')[0]).toBe('INV-20261001002');
  });

  it("lists every invoice for an Admin's void, and shows a refusal in the server's words", async () => {
    await open();
    press(screen, 'Void an invoice');
    await answerEach(http, INVOICE_URL, () => page([SOLD]), 1, seen);
    await settle();
    expect(seen.at(-1)!.request.params.has('seller')).toBe(false);
    press(dialog(), 'Select');
    await settle();
    type(dialog(), '#reason-text', 'Wrong customer');
    press(dialog(), 'Void this invoice');
    http
      .expectOne(`${INVOICE_URL}120/void/`)
      .flush(
        { detail: 'A payment has been applied to this invoice. Void the payment first.' },
        BAD,
      );
    await settle();
    expect(texts(dialog(), '.form-error')).toEqual([
      'A payment has been applied to this invoice. Void the payment first.',
    ]);
    press(dialog(), 'Cancel');
    await settle();
    expect(dialogCount()).toBe(0);
  });
});
