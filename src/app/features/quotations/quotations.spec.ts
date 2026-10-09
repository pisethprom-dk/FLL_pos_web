// v1.1.0
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
import { BRANDS, BRAND_URL, CATEGORIES, CATEGORY_URL, page } from '../catalogue/catalogue-testing';
import { BOPHA, CUSTOMER_URL, DARA, SOK_SHOP, WALK_IN } from '../partners/partners-testing';
import { LOOKUP_URL, answerEach, chooseLabel, key } from '../stock/stock-testing';
import {
  CHHAY,
  DRILL_PRICED,
  GRINDER_FIXED,
  QUOTE_URL,
  QUO_ACCEPTED,
  QUO_DRAFT,
  QUO_REJECTED,
} from './quotations-testing';

function listFor(req: TestRequest): object {
  const params = req.request.params;
  if (params.has('page')) return page([QUO_DRAFT, QUO_ACCEPTED, QUO_REJECTED]);
  if (params.get('open') === 'true') return page([], 3);
  if (params.get('status') === 'SENT') return page([], 1);
  return page([], 2);
}

describe('Quotations', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/quotations');
    await answer(http, CUSTOMER_URL, page([WALK_IN, SOK_SHOP, DARA, BOPHA, CHHAY]));
    await answerEach(http, QUOTE_URL, listFor, 4, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const lastList = () => seen.filter((r) => r.request.params.has('page')).at(-1)!.request.params;
  const reloaded = () => answerEach(http, QUOTE_URL, listFor, 4, seen);

  /** The picker's brands and categories, which an editable quotation loads. */
  async function answerPicker(): Promise<void> {
    await answer(http, BRAND_URL, page(BRANDS));
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await settle();
  }

  async function openRow(number: string, editable: boolean): Promise<HTMLElement> {
    const row = Array.from(screen.querySelectorAll('tbody tr')).find((tr) =>
      tr.querySelector('td')!.textContent!.includes(number),
    )!;
    find<HTMLButtonElement>(row, '.rowlink').click();
    if (editable) await answerPicker();
    else await settle();
    return dialog();
  }

  async function scan(card: HTMLElement, code: string, found: object[]): Promise<void> {
    const box = find<HTMLInputElement>(card, 'input[aria-label="Barcode or code"]');
    box.value = code;
    key(box, 'Enter');
    await answer(http, LOOKUP_URL, found);
    await settle();
  }

  async function startNew(customer: string): Promise<HTMLElement> {
    press(screen, 'New quotation');
    await answerPicker();
    const card = dialog();
    chooseLabel(card, '#quote-customer', customer);
    await settle();
    return card;
  }

  it('lists quotations with what is invoiced and left, and marks the expired', async () => {
    await open();
    const rows = Array.from(screen.querySelectorAll('tbody tr'), (tr) => [
      ...texts(tr, 'td').slice(0, 7),
      texts(tr, 'td:nth-child(8) .pill, td:nth-child(8) .cell-sub').join(' · '),
    ]);
    expect(rows).toEqual([
      [
        'QUO-20261006001',
        '6 Oct 2026',
        'Sok Shop',
        '5 Nov 2026',
        '$138.00',
        '$0.00',
        '$138.00',
        'Draft',
      ],
      [
        'QUO-20260929001',
        '29 Sep 2026',
        'Sok Shop',
        '1 Oct 2026',
        '$183.10',
        '$65.55',
        '$117.55',
        'Accepted · Expired · part invoiced',
      ],
      [
        'QUO-20260925001',
        '25 Sep 2026',
        'Sok Shop',
        '25 Oct 2026',
        '$138.00',
        '$0.00',
        '—',
        'Rejected',
      ],
    ]);
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b'))).toEqual([
      ['Open quotes', '3'],
      ['Sent, waiting on the customer', '1'],
      ['Accepted, still to invoice', '2'],
    ]);
    // The walk-in is never a quotation's customer.
    expect(texts(screen, 'select[aria-label="Customer"] option')).not.toContain('Walk-in');
  });

  it('shows open quotes first, and filters on the server from page 1', async () => {
    await open();
    expect(lastList().get('open')).toBe('true');

    choose(screen, 'select[aria-label="Status"]', 'SENT');
    await answerEach(http, QUOTE_URL, listFor, 1, seen);
    expect([lastList().get('status'), lastList().has('open'), lastList().get('page')]).toEqual([
      'SENT',
      false,
      '1',
    ]);

    choose(screen, 'select[aria-label="Status"]', 'all');
    await answerEach(http, QUOTE_URL, listFor, 1, seen);
    expect([lastList().has('status'), lastList().has('open')]).toEqual([false, false]);

    choose(screen, 'select[aria-label="Customer"]', '2');
    await answerEach(http, QUOTE_URL, listFor, 1, seen);
    expect(lastList().get('customer')).toBe('2');

    type(screen, 'input[type=search]', 'QUO-2026');
    await answerEach(http, QUOTE_URL, listFor, 1, seen);
    expect(lastList().get('search')).toBe('QUO-2026');
  });

  it("prices a line at the customer's tier, previews its discount, and saves the draft", async () => {
    await open();
    press(screen, 'New quotation');
    await answerPicker();
    const card = dialog();
    expect(texts(card, '.scan-note')).toEqual([
      'Choose the customer first — their price tier sets the prices.',
    ]);
    expect(texts(card, '#quote-customer option')).toEqual([
      'Choose a store customer…',
      'Sok Shop',
      'Dara Grocery',
      'Bopha (Street 315)',
      'Chhay Mini Mart',
    ]);
    chooseLabel(card, '#quote-customer', 'Sok Shop');
    await settle();
    expect(find<HTMLInputElement>(card, '#quote-tier').value).toBe('Wholesale');
    await scan(card, 'TL-0101', [DRILL_PRICED]);

    const row = find(card, 'tbody tr');
    type(row, 'input[aria-label="Quantity, TL-0101"]', '2');
    type(row, 'input[aria-label="Discount, TL-0101"]', '5');
    await settle();
    expect(texts(row, 'td').slice(2, 6)).toEqual(['$69.00', '%$', '$65.55', '$131.10']);
    expect(texts(card, 'tfoot td')[1]).toBe('$131.10');

    press(card, 'Save draft');
    const req = http.expectOne((r) => r.url === QUOTE_URL && r.method === 'POST');
    expect(req.request.body).toEqual({
      customer: 2,
      quote_date: today(),
      terms: '',
      note: '',
      lines: [{ product: 11, quantity: '2', discount_type: 'PERCENT', discount_value: '5' }],
    });
    req.flush(QUO_DRAFT);
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('re-prices a picked line when the customer changes tier', async () => {
    await open();
    const card = await startNew('Sok Shop');
    await scan(card, 'TL-0101', [DRILL_PRICED]);
    expect(texts(card, 'tbody td')[2]).toBe('$69.00');
    chooseLabel(card, '#quote-customer', 'Chhay Mini Mart');
    await settle();
    expect(find<HTMLInputElement>(card, '#quote-tier').value).toBe('Retail');
    expect(texts(card, 'tbody td')[2]).toBe('$78.00');
  });

  it('refuses over 15% and any discount on a fixed price, before saving', async () => {
    await open();
    const card = await startNew('Sok Shop');
    await scan(card, 'TL-0101', [DRILL_PRICED]);
    type(card, 'input[aria-label="Quantity, TL-0101"]', '1');
    type(card, 'input[aria-label="Discount, TL-0101"]', '16');
    await settle();
    expect(texts(card, '.cell-note')).toEqual(['Over the 15% limit — refused.']);
    press(card, 'Save draft');
    await settle();
    // Nothing is sent: afterEach() checks no request is left unanswered.

    // $ off each unit: $10.35 is exactly 15% of $69.00, and passes.
    choose(card, 'select[aria-label="Discount type, TL-0101"]', 'AMOUNT');
    type(card, 'input[aria-label="Discount, TL-0101"]', '10.35');
    await settle();
    expect(texts(card, 'tbody tr td')[4]).toBe('$58.65');

    await scan(card, 'TL-0118', [GRINDER_FIXED]);
    const fixed = card.querySelectorAll('tbody tr')[1];
    expect(find<HTMLInputElement>(fixed, 'input[aria-label="Discount, TL-0118"]').disabled).toBe(
      true,
    );
    expect(texts(fixed, '.cell-note')).toEqual(['Price fixed']);
  });

  it('marks a draft sent, and another accepted once confirmed', async () => {
    await open();
    let card = await openRow('QUO-20261006001', true);
    press(card, 'Mark sent');
    http.expectOne(`${QUOTE_URL}41/send/`).flush({ ...QUO_DRAFT, status: 'SENT' });
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);

    card = await openRow('QUO-20261006001', true);
    press(card, 'Mark accepted');
    await settle();
    expect(find(dialog(), '.confirm-message').textContent).toContain('can no longer be changed');
    press(dialog(), 'Mark accepted');
    const req = http.expectOne(`${QUOTE_URL}41/accept/`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...QUO_DRAFT, status: 'ACCEPTED' });
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('shows an accepted quote read-only, and rejects what is left with a reason', async () => {
    await open();
    const card = await openRow('QUO-20260929001', false);
    expect(card.querySelector('app-product-picker')).toBeNull();
    expect(find(card, '.note').textContent).toContain('expired');
    expect(Array.from(card.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td'))).toEqual([
      [
        'Impact drill 13mm 710W TL-0101 · Piece',
        '2',
        '$69.00',
        '5%',
        '$65.55',
        '$131.10',
        '1',
        '1',
      ],
      [
        'Angle grinder 100mm 570W TL-0118 · Piece',
        '1',
        '$52.00',
        '—',
        '$52.00',
        '$52.00',
        '0',
        '1',
      ],
    ]);

    press(card, 'Reject…');
    await settle();
    expect(find(dialog(), '.confirm-message').textContent).toContain(
      'What has been invoiced stays invoiced',
    );
    press(dialog(), 'Reject quotation');
    await settle();
    expect(texts(dialog(), '.hint.warn')).toEqual([
      'A reason is needed — it is kept with the record.',
    ]);
    type(dialog(), '#reason-text', 'Bought elsewhere');
    press(dialog(), 'Reject quotation');
    const req = http.expectOne(`${QUOTE_URL}42/reject/`);
    expect(req.request.body).toEqual({ note: 'Bought elsewhere' });
    req.flush({ ...QUO_ACCEPTED, status: 'REJECTED' });
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('prints a quotation as saved, not with changes unsaved, and never a rejected one', async () => {
    await open();
    const titles: string[] = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      titles.push(texts(document, '#print-root .inv-title')[0]);
    });
    let card = await openRow('QUO-20261006001', true);
    press(card, 'Print');
    await answer(http, '/api/company/profile/', SHOP_PROFILE);
    await settle();
    expect(titles).toEqual(['Quotation Draft']);

    type(card, '#quote-terms', 'Collection from the shop.');
    await settle();
    press(card, 'Print');
    await settle();
    expect(texts(card, '.form-error')).toEqual([
      'Save the changes first — Print prints the quotation as saved.',
    ]);
    expect(http.match('/api/company/profile/')).toEqual([]);
    card.querySelector<HTMLButtonElement>('.modal-x')!.click();
    await settle();
    press(dialog(), 'Close without saving');
    await settle();

    card = await openRow('QUO-20260925001', false);
    expect(texts(card, '.form-foot button')).not.toContain('Print');
    press(card, 'Close');
    await settle();
    expect(titles).toEqual(['Quotation Draft']);
    print.mockRestore();
  });

  it('deletes a draft once confirmed', async () => {
    await open();
    const card = await openRow('QUO-20261006001', true);
    press(card, 'Delete draft');
    await settle();
    press(dialog(), 'Delete draft');
    const req = http.expectOne(`${QUOTE_URL}41/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('lets a Seller raise quotations too', async () => {
    await open(SELLER);
    expect(texts(screen, '.filters .btn')).toEqual(['New quotation']);
  });
});
