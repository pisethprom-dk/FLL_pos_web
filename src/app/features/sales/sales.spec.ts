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
import { page } from '../catalogue/catalogue-testing';
import { RETURN_POSTED, RETURN_URL, VOIDED } from '../returns/returns-testing';
import { INVOICE_URL } from '../sell/sell-testing';
import { answerEach } from '../stock/stock-testing';
import { mayVoid } from './sale-rules';
import { ADMIN_CREDIT, SELLER_TODAY, STAFF, USERS_URL } from './sales-testing';

const BAD = { status: 400, statusText: 'Bad Request' };

/** The list on show, or one of today's counts. */
function salesFor(req: TestRequest): object {
  const p = req.request.params;
  if (p.has('page')) return page([SELLER_TODAY, ADMIN_CREDIT, VOIDED]);
  return p.get('status') === 'VOID' ? page([], 1) : page([], 12);
}

describe('Sales', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/sales');
    if (user === ADMIN) await answer(http, USERS_URL, page(STAFF));
    await answerEach(http, INVOICE_URL, salesFor, 3, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const listed = () => seen.filter((r) => r.request.params.has('page')).at(-1)!.request.params;
  const next = () => answerEach(http, INVOICE_URL, salesFor, 1, seen);
  const value = (id: string) => find<HTMLInputElement>(dialog(), id).value;

  /** Opens the row's sale, answering its returns. */
  async function openRow(row: number, returns: object[] = []): Promise<HTMLElement> {
    find<HTMLButtonElement>(screen.querySelectorAll('tbody tr')[row], '.rowlink').click();
    await answer(http, RETURN_URL, page(returns));
    await settle();
    return dialog();
  }

  it("lists today's sales, and filters by dates, status, seller and number", async () => {
    await open();
    expect(['held', 'date_from', 'date_to', 'page'].map((name) => listed().get(name))).toEqual([
      'false',
      today(),
      today(),
      '1',
    ]);
    const rows = Array.from(screen.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td'));
    expect(rows.map((r) => [r[0], ...r.slice(2, 7)])).toEqual([
      [
        'INV-20261006001',
        'Walk-in customer Dara',
        'Sokha Chan',
        'Cash',
        '$361.45 ៛1,481,900',
        'Completed',
      ],
      [
        'INV-20261006002',
        'Sok Shop From QUO-20261001001',
        'Bopha Ly',
        'Cash Credit',
        '$325.00 ៛1,332,500',
        'Completed',
      ],
      [
        'INV-20261001002',
        'Walk-in customer Dara',
        'Sokha Chan',
        'Cash',
        '$361.45 ៛1,481,900',
        'Void',
      ],
    ]);
    expect(rows[0][1]).toMatch(/, 10:15$/);
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b'))).toEqual([
      ['Sales today', '12'],
      ['Voided today', '1'],
    ]);

    choose(screen, 'select[aria-label="Period"]', 'month');
    await next();
    expect([listed().get('date_from'), listed().has('date_to')]).toEqual([
      `${today().slice(0, 7)}-01`,
      false,
    ]);
    choose(screen, 'select[aria-label="Period"]', 'range');
    await next();
    await settle();
    choose(screen, 'input[aria-label="From"]', '2026-10-01');
    await next();
    choose(screen, 'input[aria-label="To"]', '2026-10-03');
    await next();
    expect([listed().get('date_from'), listed().get('date_to')]).toEqual([
      '2026-10-01',
      '2026-10-03',
    ]);

    choose(screen, 'select[aria-label="Status"]', 'VOID');
    await next();
    choose(screen, 'select[aria-label="Sold by"]', 'me');
    await next();
    expect([listed().get('status'), listed().get('seller')]).toEqual(['VOID', '1']);
    expect(texts(screen, 'select[aria-label="Sold by"] option')).toEqual([
      'Everyone',
      'Me',
      'Bopha Ly',
      'Sokha Chan',
    ]);
    choose(screen, 'select[aria-label="Sold by"]', '2');
    await next();
    expect(listed().get('seller')).toBe('2');
    type(screen, 'input[aria-label="Search sales"]', ' INV-2026100 ');
    await next();
    expect([listed().get('search'), listed().get('page')]).toEqual(['INV-2026100', '1']);
  });

  it('opens a sale with its payments, returns, cost and profit; a refused void says why', async () => {
    await open();
    const card = await openRow(1, [
      { ...RETURN_POSTED, invoice: 901, invoice_number: 'INV-20261006002' },
    ]);
    expect(texts(card, 'h3')[0]).toBe('Sale INV-20261006002');
    expect([value('#sv-quote'), value('#sv-credit'), value('#sv-change')]).toEqual([
      'QUO-20261001001',
      '$225.00 · due 5 Nov 2026',
      '—',
    ]);
    expect(value('#sv-khr')).toBe('៛1,332,500 at ៛4,100');
    const tenders = card.querySelectorAll('.lines-wrap')[1];
    expect(Array.from(tenders.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td'))).toEqual([
      ['Cash', '$100.00', '$100.00', '—'],
      ['Credit', '$225.00', '$225.00', '—'],
    ]);
    expect(texts(card, '.hint')).toContain(
      'Cost $262.00 · profit $63.00 — shown to an Admin only.',
    );
    expect(texts(card, '.hint')).toContain(
      'RTN-000018 · 3 Oct 2026 · $51.00 — Over-ordered, 2 sets back',
    );
    expect(seen.length).toBe(3);

    press(card, 'Void…');
    await settle();
    type(dialog(), '#reason-text', 'Wrong customer');
    press(dialog(), 'Void this sale');
    http
      .expectOne(`${INVOICE_URL}901/void/`)
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
    press(dialog(), 'Close');
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('reprints a sale marked as a copy, and never a void one', async () => {
    await open();
    const titles: string[] = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      titles.push(texts(document, '#print-root .inv-title')[0]);
    });
    let card = await openRow(0);
    press(card, 'Print');
    await answer(http, '/api/company/profile/', SHOP_PROFILE);
    await settle();
    expect(titles).toEqual(['Invoice Copy']);
    press(card, 'Close');
    await settle();

    card = await openRow(2);
    expect(texts(card, '.form-foot button')).toEqual(['Close']);
    press(card, 'Close');
    await settle();
    print.mockRestore();
  });

  it('lets a Seller void their own sale from today, and no other', async () => {
    await open(SELLER);
    expect(http.match(USERS_URL)).toEqual([]);
    expect(texts(screen, 'select[aria-label="Sold by"] option')).toEqual(['Everyone', 'Me']);

    let card = await openRow(1);
    expect(texts(card, '.form-foot button')).toEqual(['Print', 'Close']);
    expect(texts(card, '.hint').some((h) => h.startsWith('Cost'))).toBe(false);
    press(card, 'Close');
    await settle();

    card = await openRow(0);
    press(card, 'Void…');
    await settle();
    type(dialog(), '#reason-text', 'Rung up twice by mistake');
    press(dialog(), 'Void this sale');
    const req = http.expectOne(`${INVOICE_URL}900/void/`);
    expect(req.request.body).toEqual({ reason: 'Rung up twice by mistake' });
    req.flush({ ...SELLER_TODAY, status: 'VOID' });
    await answerEach(http, INVOICE_URL, salesFor, 3, seen);
    await settle();
    expect(dialogCount()).toBe(0);

    // Their own, but from an earlier day: the Admin's to void now.
    const can = (scopes: readonly string[]) => scopes.some((s) => SELLER.scopes.includes(s));
    expect(
      mayVoid({ ...SELLER_TODAY, sale_date: '2026-10-01T03:00:00Z' }, SELLER, can, today()),
    ).toBe(false);
  });
});
