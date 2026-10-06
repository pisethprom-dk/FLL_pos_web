// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Me } from '../../../api/models/me';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, SELLER, answer, answerShell, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  choose,
  dialog,
  dialogCount,
  find,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';
import { page } from '../../catalogue/catalogue-testing';
import { CUSTOMERS, CUSTOMER_URL, SOK_SHOP, accountUrl } from '../partners-testing';

/** The list carries a page number; the three tile counts do not. */
function bodyFor(req: TestRequest): object {
  const params = req.request.params;
  if (params.has('page')) return page(CUSTOMERS);
  if (params.get('credit') === 'yes') return page([], 11);
  if (params.get('credit') === 'hold') return page([], 1);
  return page([], 22);
}

describe('Customers', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function answerCustomers(count: number): Promise<void> {
    let answered = 0;
    for (let tries = 0; tries < 200 && answered < count; tries++) {
      for (const req of http.match((r) => r.url === CUSTOMER_URL && r.method === 'GET')) {
        seen.push(req);
        req.flush(bodyFor(req));
        answered++;
      }
      if (answered < count) await new Promise((resolve) => setTimeout(resolve, 5));
    }
    if (answered < count) throw new Error(`Expected ${count} customer lists, got ${answered}`);
  }

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/partners/customers');
    await answerCustomers(4);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const lastList = () => seen.filter((r) => r.request.params.has('page')).at(-1)!.request.params;
  const row = (code: string) =>
    Array.from(screen.querySelectorAll('tbody tr')).find(
      (tr) => tr.querySelector('td')!.textContent!.trim() === code,
    )!;

  it('lists customers with price, contact, credit, limit and terms', async () => {
    await open();
    expect(texts(row('CUS-000001'), 'td').slice(0, 9)).toEqual([
      'CUS-000001',
      'Sok Shop ហាង សុខ',
      'Wholesale',
      'Sok Piseth',
      '012 330 441',
      'Yes',
      '$1,500.00',
      '30 days',
      'Active',
    ]);
    expect(texts(row('CUS-000002'), '.pill')[0]).toBe('On hold');
    const cash = texts(row('CUS-000005'), 'td');
    expect([cash[5], cash[6], cash[7]]).toEqual(['No', '—', '—']);
  });

  it('marks the walk-in as a system record, opened to view only', async () => {
    await open();
    const walkIn = row('CUS-000000');
    expect(find(walkIn, '.cell-sub').textContent).toBe('System record');
    find<HTMLButtonElement>(walkIn, '.rowlink').click();
    await settle();
    const card = dialog();
    expect(find(card, '.note').textContent).toContain(
      'cannot be renamed, given credit, or deactivated',
    );
    expect(card.querySelector('button[type=submit]')).toBeNull();
    press(card, 'Close');
    await settle();
  });

  it('counts active customers, those on credit and those on hold', async () => {
    await open();
    const tiles = Array.from(screen.querySelectorAll('.tile'), (tile) => texts(tile, 'small, b'));
    expect(tiles).toEqual([
      ['Active customers', '22'],
      ['Allowed credit', '11'],
      ['On credit hold', '1'],
    ]);
  });

  it('filters on the server, starting again at page 1', async () => {
    await open();
    choose(screen, 'select[aria-label="Credit"]', 'hold');
    await answerCustomers(1);
    expect(lastList().get('credit')).toBe('hold');
    expect(lastList().get('page')).toBe('1');

    choose(screen, 'select[aria-label="Price"]', 'WHOLESALE');
    await answerCustomers(1);
    expect(lastList().get('price_tier')).toBe('WHOLESALE');

    choose(screen, 'select[aria-label="Status"]', 'all');
    await answerCustomers(1);
    expect(lastList().has('active')).toBe(false);

    type(screen, 'input[type=search]', '012 330');
    await answerCustomers(1);
    expect(lastList().get('search')).toBe('012 330');
  });

  it('adds a cash customer, leaving the code to the system', async () => {
    await open();
    press(screen, 'Add customer');
    await settle();
    const card = dialog();
    expect(find<HTMLInputElement>(card, '#c-limit').disabled).toBe(true);
    type(card, '#c-name', 'Chhay Mini Mart');
    type(card, '#c-phone', '010 554 003');
    press(card, 'Save customer');

    const req = http.expectOne((r) => r.url === CUSTOMER_URL && r.method === 'POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        code: '',
        name: 'Chhay Mini Mart',
        phone: '010 554 003',
        price_tier: 'RETAIL',
        allow_credit: false,
        country: 'Cambodia',
      }),
    );
    req.flush({ ...SOK_SHOP, id: 9 });
    await answerCustomers(4);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it("opens the credit fields with credit, and shows the server's refusal", async () => {
    await open();
    press(screen, 'Add customer');
    await settle();
    const card = dialog();
    type(card, '#c-name', 'Kim Long Trading');
    find<HTMLInputElement>(card, 'input[formcontrolname="allow_credit"]').click();
    await settle();
    expect(find<HTMLInputElement>(card, '#c-limit').disabled).toBe(false);
    press(card, 'Save customer');

    http
      .expectOne((r) => r.url === CUSTOMER_URL && r.method === 'POST')
      .flush(
        { credit_limit: ['Set a credit limit above zero, or turn credit off.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    expect(texts(find(card, '#c-limit').closest('.field')!, '.hint.warn')).toEqual([
      'Set a credit limit above zero, or turn credit off.',
    ]);
  });

  it('shows what a customer owes, from their account', async () => {
    await open();
    find<HTMLButtonElement>(row('CUS-000001'), '.rowlink').click();
    await answer(http, accountUrl(2), {
      customer: 2,
      code: 'CUS-000001',
      name: 'Sok Shop',
      credit_status: 'YES',
      credit_limit: '1500.00',
      payment_terms_days: 30,
      balance: '1030.00',
      room_left: '470.00',
      open_invoices: [{}, {}, {}],
    });
    await settle();
    expect(find(dialog(), '.owed').textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Owes $1,030.00 of $1,500.00 · $470.00 room left · 3 open invoices',
    );
    press(dialog(), 'Cancel');
    await settle();
  });

  it('deactivates a customer once confirmed', async () => {
    await open();
    find<HTMLButtonElement>(row('CUS-000005'), '.rowlink').click();
    await answer(http, accountUrl(4), {
      customer: 4,
      code: 'CUS-000005',
      name: 'Bopha',
      credit_status: 'NO',
      credit_limit: '0.00',
      payment_terms_days: 0,
      balance: '0.00',
      room_left: '0.00',
      open_invoices: [],
    });
    await settle();
    expect(find(dialog(), '.owed').textContent!.trim()).toBe('Owes nothing at the moment.');
    press(dialog(), 'Deactivate');
    await settle();
    press(dialog(), 'Deactivate');

    const req = http.expectOne(`${CUSTOMER_URL}4/`);
    expect(req.request.body).toEqual({ is_active: false });
    req.flush({});
    await answerCustomers(4);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('lets a Seller read the list and the walk-in, but change nothing', async () => {
    await open(SELLER);
    expect(screen.querySelector('.filters .btn')).toBeNull();
    expect(texts(screen, 'tbody .rowlink')).toEqual(['View']);
  });
});
