// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Me } from '../../api/models/me';
import { SessionStore } from '../../core/session/session-store';
import { ADMIN, SELLER, answer, answerShell, signIn } from '../../core/session/session-testing';
import { daysBefore, today } from '../../shared/dates';
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
import { DRILL_LOOKUP, LOOKUP_URL, answerEach, key } from '../stock/stock-testing';
import { CLAIM_URL, DRILL_CLAIM, DRIVER_CLAIM, GRINDER_CLAIM } from './warranty-testing';

const BAD = { status: 400, statusText: 'Bad Request' };

/** The list on show, or one of the tiles' counts. */
function claimsFor(req: TestRequest): object {
  const p = req.request.params;
  if (p.has('page')) return page([DRILL_CLAIM, GRINDER_CLAIM, DRIVER_CLAIM]);
  if (p.get('out_of_warranty') === 'true') return page([], 1);
  if (p.get('status') === 'SENT_FOR_REPAIR' || p.get('status') === 'READY') return page([], 2);
  return page([], 4);
}

describe('Warranty claims', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/warranty');
    await answerEach(http, CLAIM_URL, claimsFor, 5, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const listed = () => seen.filter((r) => r.request.params.has('page')).at(-1)!.request.params;
  const value = (id: string) => find<HTMLInputElement>(dialog(), id).value;
  /** After a save: the list and the four counts load again. */
  const reloaded = async () => {
    await answerEach(http, CLAIM_URL, claimsFor, 5, seen);
    await settle();
  };

  /** Opens a claim's dialog — new, or the row's — answering the picker's lists. */
  async function openDialog(row?: number): Promise<HTMLElement> {
    if (row === undefined) press(screen, 'New claim');
    else find<HTMLButtonElement>(screen.querySelectorAll('tbody tr')[row], '.rowlink').click();
    await answer(http, BRAND_URL, page(BRANDS));
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await settle();
    return dialog();
  }

  it('lists open claims with who to call, counts them, and filters and searches', async () => {
    await open();
    expect([listed().get('open'), listed().get('page')]).toEqual(['true', '1']);
    expect(
      Array.from(screen.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td').slice(0, 7)),
    ).toEqual([
      [
        'WR-2026-0148',
        'Impact drill 13mm 710W TL-0101',
        '12 months',
        '30 Sep 2027',
        'Sok Shop 012 330 441',
        'Will not start. Customer called 30 Sep.',
        'Received',
      ],
      [
        'WR-2026-0121',
        'Angle grinder 100mm 570W TL-0118',
        '6 months',
        '18 Mar 2027',
        '—',
        'Sparks from motor. Sent to Makita 22 Sep, job MSC-7741.',
        'Sent for repair',
      ],
      [
        'WR-2026-0041',
        'Cordless driver 12V TL-0150',
        '12 months',
        '12 Jul 2026',
        'Dara 097 555 120',
        'Out of warranty. Customer agreed to pay $18.00 for the repair.',
        'Ready for collection',
      ],
    ]);
    const expires = Array.from(screen.querySelectorAll('tbody tr'), (tr) =>
      tr.querySelectorAll('td')[3].classList.contains('neg'),
    );
    expect(expires).toEqual([false, false, true]);
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b'))).toEqual([
      ['Open claims', '4'],
      ['Sent for repair', '2'],
      ['Ready for collection', '2'],
      ['Out of warranty', '1'],
    ]);

    choose(screen, 'select[aria-label="Status"]', 'all');
    await answerEach(http, CLAIM_URL, claimsFor, 1, seen);
    expect([listed().has('open'), listed().has('status')]).toEqual([false, false]);
    choose(screen, 'select[aria-label="Status"]', 'READY');
    await answerEach(http, CLAIM_URL, claimsFor, 1, seen);
    expect([listed().get('status'), listed().has('open')]).toEqual(['READY', false]);
    type(screen, 'input[aria-label="Search claims"]', ' 012 330 ');
    await answerEach(http, CLAIM_URL, claimsFor, 1, seen);
    expect([listed().get('search'), listed().get('page')]).toEqual(['012 330', '1']);
  });

  it('logs a new claim from a scanned product, once it has a number and a name', async () => {
    await open();
    const card = await openDialog();
    press(card, 'Save claim');
    await settle();
    expect(http.match((r) => r.method === 'POST')).toEqual([]);
    expect(texts(card, '.hint.warn')).toEqual([
      'The number on the warranty card.',
      'Say what the item is.',
    ]);

    const box = find<HTMLInputElement>(card, 'input[aria-label="Barcode or code"]');
    box.value = 'TL-0101';
    key(box, 'Enter');
    await answer(http, LOOKUP_URL, [{ ...DRILL_LOOKUP, warranty_months: 12 }]);
    await settle();
    expect([value('#claim-code'), value('#claim-product'), value('#claim-months')]).toEqual([
      'TL-0101',
      'Impact drill 13mm 710W',
      '12',
    ]);

    type(card, '#claim-number', 'WR-2026-0149');
    type(card, '#claim-expiry', daysBefore(today(), 1));
    await settle();
    expect(texts(card, '.hint.warn')).toEqual([
      'Out of warranty: it ended before the claim was logged.',
    ]);
    type(card, '#claim-expiry', '2027-10-05');
    type(card, '#claim-customer', 'Sok Shop');
    type(card, '#claim-phone', '012 330 441');
    type(card, '#claim-note', 'Will not start.');
    press(card, 'Save claim');
    const req = http.expectOne((r) => r.url === CLAIM_URL && r.method === 'POST');
    expect(req.request.body).toEqual({
      warranty_number: 'WR-2026-0149',
      product_code: 'TL-0101',
      product_name: 'Impact drill 13mm 710W',
      warranty_months: 12,
      expiry_date: '2027-10-05',
      customer_name: 'Sok Shop',
      customer_phone: '012 330 441',
      status: 'RECEIVED',
      note: 'Will not start.',
    });
    req.flush({ ...DRILL_CLAIM, id: 149 });
    await reloaded();
    expect(dialogCount()).toBe(0);
  });

  it("moves a claim along, says who logged it, and shows a refusal in the server's words", async () => {
    await open();
    const card = await openDialog(1);
    expect(texts(card, 'h3')[0]).toBe('Claim on WR-2026-0121');
    expect(texts(card, '.note')[0]).toMatch(
      /^Logged 22 Sep 2026, \d\d:00 by Sokha Chan · last changed 1 Oct 2026, \d\d:00 by Bopha Ly$/,
    );
    choose(card, '#claim-status', 'READY');
    type(card, '#claim-expiry', '');
    press(card, 'Save claim');
    let req = http.expectOne((r) => r.url === `${CLAIM_URL}121/` && r.method === 'PATCH');
    expect([req.request.body.status, req.request.body.expiry_date]).toEqual(['READY', null]);
    expect(req.request.body.warranty_months).toBe(6);
    req.flush({ customer_phone: ['Ensure this field has no more than 30 characters.'] }, BAD);
    await settle();
    expect(texts(card, '.form-error')).toEqual([
      'Ensure this field has no more than 30 characters.',
    ]);

    press(card, 'Save claim');
    req = http.expectOne((r) => r.url === `${CLAIM_URL}121/` && r.method === 'PATCH');
    req.flush({ ...GRINDER_CLAIM, status: 'READY' });
    await reloaded();
    expect(dialogCount()).toBe(0);
  });

  it('lets an Admin delete a claim', async () => {
    await open();
    const card = await openDialog(0);
    press(card, 'Delete');
    await settle();
    expect(texts(dialog(), 'h3')[0]).toBe('Delete the claim on WR-2026-0148?');
    press(dialog(), 'Delete claim');
    http.expectOne((r) => r.url === `${CLAIM_URL}148/` && r.method === 'DELETE').flush(null);
    await reloaded();
    expect(dialogCount()).toBe(0);
  });

  it('gives a Seller no Delete', async () => {
    await open(SELLER);
    const card = await openDialog(0);
    expect(texts(card, '.form-foot button')).toEqual(['Save claim', 'Cancel']);
    press(card, 'Cancel');
    await settle();
  });
});
