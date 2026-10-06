// v1.0.0
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, answer, answerShell, signIn } from '../../../core/session/session-testing';
import { today } from '../../../shared/dates';
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
import {
  BRANDS,
  BRAND_URL,
  CATEGORIES,
  CATEGORY_URL,
  GRINDER,
  PRODUCT_URL,
  page,
} from '../../catalogue/catalogue-testing';
import { LIM_HENG, SUPPLIER_URL, TOTAL_TOOLS } from '../../partners/partners-testing';
import {
  ADJUSTMENT_URL,
  ADJ_DRAFT,
  ADJ_POSTED,
  GRINDER_LOOKUP,
  LOOKUP_URL,
  answerEach,
  chooseLabel,
  key,
} from '../stock-testing';

function listFor(req: TestRequest): object {
  const params = req.request.params;
  if (params.has('page')) return page([ADJ_DRAFT, ADJ_POSTED]);
  if (params.get('status') === 'DRAFT') return page([], 1);
  return page([], 9);
}

describe('Adjustments', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    const created = RouterTestingHarness.create('/stock/adjustments');
    await answerEach(http, ADJUSTMENT_URL, listFor, 3, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const lastList = () => seen.filter((r) => r.request.params.has('page')).at(-1)!.request.params;

  async function startNew(reason: string): Promise<HTMLElement> {
    press(screen, 'New adjustment');
    await answer(http, SUPPLIER_URL, page([TOTAL_TOOLS, LIM_HENG]));
    await answer(http, BRAND_URL, page(BRANDS));
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await settle();
    const card = dialog();
    chooseLabel(card, '#adj-reason', reason);
    await settle();
    return card;
  }

  /** Scans the grinder in: the lookup, then its full record for the average cost. */
  async function addGrinder(card: HTMLElement): Promise<HTMLElement> {
    const box = find<HTMLInputElement>(card, 'input[aria-label="Barcode or code"]');
    box.value = 'TL-0118';
    key(box, 'Enter');
    await answer(http, LOOKUP_URL, [GRINDER_LOOKUP]);
    await answer(http, `${PRODUCT_URL}12/`, GRINDER);
    await settle();
    return find(card, 'tbody tr');
  }

  it('lists adjustments by reason, with the value each moved once posted', async () => {
    await open();
    const rows = Array.from(screen.querySelectorAll('tbody tr'), (tr) =>
      texts(tr, 'td').slice(0, 8),
    );
    expect(rows).toEqual([
      ['ADJ-000020', '30 Sep 2026', 'Damage', '—', 'Boxes split in the rain', '1', '—', 'Draft'],
      [
        'ADJ-000019',
        '26 Sep 2026',
        'Return to supplier',
        'Lim Heng Import Export',
        'Two grinders arrived faulty',
        '1',
        '−$77.80',
        'Posted',
      ],
    ]);
    expect(screen.querySelectorAll('tbody tr')[1].querySelectorAll('td')[6].classList).toContain(
      'neg',
    );
  });

  it('filters by reason on the server', async () => {
    await open();
    choose(screen, 'select[aria-label="Reason"]', 'SUPPLIER_REPLACEMENT');
    await answerEach(http, ADJUSTMENT_URL, listFor, 1, seen);
    expect(lastList().get('reason')).toBe('SUPPLIER_REPLACEMENT');
    expect(lastList().get('page')).toBe('1');
  });

  it('writes off at the average cost, with no supplier and no typed cost', async () => {
    await open();
    const card = await startNew('Damage');
    expect(find<HTMLSelectElement>(card, '#adj-supplier').disabled).toBe(true);
    const row = await addGrinder(card);
    expect(texts(card, 'thead th')[3]).toBe('Out');
    expect(row.querySelector('input[aria-label="Unit cost, TL-0118"]')).toBeNull();
    type(row, 'input[aria-label="Quantity, TL-0118"]', '2');
    await settle();
    expect(texts(row, 'td').slice(0, 6)).toEqual([
      'Angle grinder 100mm 570W TL-0118',
      '—',
      '3',
      '',
      '$38.9000',
      '−$77.80',
    ]);
    expect(texts(card, 'tfoot td')[1]).toBe('−$77.80');

    press(card, 'Save draft');
    const req = http.expectOne((r) => r.url === ADJUSTMENT_URL && r.method === 'POST');
    expect(req.request.body).toEqual({
      reason: 'DAMAGE',
      doc_date: today(),
      supplier: null,
      note: '',
      lines: [{ product: 12, quantity: '2', unit_cost: null }],
    });
    req.flush(ADJ_DRAFT);
    await answerEach(http, ADJUSTMENT_URL, listFor, 3, seen);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('needs the supplier for a return, and offers "Supplier replacement"', async () => {
    await open();
    const card = await startNew('Return to supplier');
    expect(texts(card, '#adj-reason option')).toContain('Supplier replacement — in');
    press(card, 'Save draft');
    await settle();
    expect(texts(find(card, '#adj-supplier').closest('.field')!, '.hint.warn')).toEqual([
      'Choose the supplier.',
    ]);

    chooseLabel(card, '#adj-supplier', 'Lim Heng');
    press(card, 'Save draft');
    const req = http.expectOne((r) => r.url === ADJUSTMENT_URL && r.method === 'POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({ reason: 'RETURN_TO_SUPPLIER', supplier: 2, lines: [] }),
    );
    req.flush(ADJ_POSTED);
    await answerEach(http, ADJUSTMENT_URL, listFor, 3, seen);
    await settle();
  });

  it('types a cost only on an opening balance, and drops it for another reason', async () => {
    await open();
    const card = await startNew('Opening balance');
    const row = await addGrinder(card);
    expect(texts(card, 'thead th')[3]).toBe('In');
    type(row, 'input[aria-label="Quantity, TL-0118"]', '10');
    type(row, 'input[aria-label="Unit cost, TL-0118"]', '36.50');
    await settle();
    expect(texts(row, 'td')[5]).toBe('$365.00');

    chooseLabel(card, '#adj-reason', 'Damage');
    await settle();
    expect(row.querySelector('input[aria-label="Unit cost, TL-0118"]')).toBeNull();
    expect(texts(row, 'td')[5]).toBe('−$389.00');

    chooseLabel(card, '#adj-reason', 'Opening balance');
    await settle();
    expect(find<HTMLInputElement>(row, 'input[aria-label="Unit cost, TL-0118"]').value).toBe('');
    type(row, 'input[aria-label="Unit cost, TL-0118"]', '36.5');
    press(card, 'Save draft');
    const req = http.expectOne((r) => r.url === ADJUSTMENT_URL && r.method === 'POST');
    expect(req.request.body.lines).toEqual([{ product: 12, quantity: '10', unit_cost: '36.5' }]);
    req.flush(ADJ_DRAFT);
    await answerEach(http, ADJUSTMENT_URL, listFor, 3, seen);
    await settle();
  });

  it('shows a posted adjustment with the cost it was stamped with', async () => {
    await open();
    find<HTMLButtonElement>(screen.querySelectorAll('tbody tr')[1], '.rowlink').click();
    await answer(http, SUPPLIER_URL, page([TOTAL_TOOLS, LIM_HENG]));
    await settle();
    const card = dialog();
    expect(card.querySelector('app-product-picker')).toBeNull();
    expect(texts(card, 'tbody td')).toEqual([
      'Angle grinder 100mm 570W TL-0118',
      'A2-1',
      '2',
      '$38.9000',
      '−$77.80',
    ]);
    press(card, 'Reverse…');
    await settle();
    expect(find(dialog(), '.confirm-message').textContent).toContain(
      'brings the stock it took out back in',
    );
    press(dialog(), 'Cancel');
    await settle();
    press(card, 'Close');
    await settle();
    expect(dialogCount()).toBe(0);
  });
});
