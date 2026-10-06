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
  pickFile,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';
import {
  BRANDS,
  BRAND_URL,
  CATEGORIES,
  CATEGORY_URL,
  DRILL,
  GRINDER,
  KEY_CUTTING,
  PRODUCT_URL,
  UNITS,
  UNIT_URL,
  page,
} from '../catalogue-testing';

const LIST = page([DRILL, GRINDER, KEY_CUTTING], 87);
const SELLER_LIST = page(
  [DRILL, GRINDER, KEY_CUTTING].map((p) => ({ ...p, avg_cost: null, stock_value: null })),
  87,
);

/** The list itself carries a page number; the three tile counts do not. */
function bodyFor(req: TestRequest, list = LIST): object {
  const params = req.request.params;
  if (params.has('page')) return list;
  if (params.get('below_reorder') === 'true') return page([], 6);
  if (params.get('out_of_stock') === 'true') return page([], 2);
  return page([], 84);
}

describe('Products', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  /** Answers product-list calls as they arrive, until `count` have been answered. */
  async function answerProducts(count: number, list = LIST): Promise<void> {
    let answered = 0;
    for (let tries = 0; tries < 200 && answered < count; tries++) {
      for (const req of http.match((r) => r.url === PRODUCT_URL && r.method === 'GET')) {
        seen.push(req);
        req.flush(bodyFor(req, list));
        answered++;
      }
      if (answered < count) await new Promise((resolve) => setTimeout(resolve, 5));
    }
    if (answered < count) throw new Error(`Expected ${count} product lists, got ${answered}`);
  }

  async function open(user: Me = ADMIN, list = LIST): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/catalogue/products');
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await answer(http, BRAND_URL, page(BRANDS));
    await answer(http, UNIT_URL, page(UNITS));
    // The page itself, and the three counts behind the tiles.
    await answerProducts(4, list);
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

  it('lists products with stock, cost, prices and state', async () => {
    await open();
    expect(texts(screen, 'thead th')).toContain('Avg cost');
    expect(texts(row('TL-0101'), 'td').slice(0, 10)).toEqual([
      'TL-0101',
      'Impact drill 13mm 710W GSB 550 · 12 months warranty',
      'Power tools → Drills',
      'Bosch',
      'Piece',
      '14',
      '$52.40',
      '$78.00',
      '$69.00',
      'Active',
    ]);
    expect(texts(row('TL-0118'), '.pill')).toEqual(['Reorder']);
    const service = texts(row('SV-0001'), 'td');
    expect(service[5]).toBe('—');
    expect(service[6]).toBe('—');
    expect(service[9]).toBe('Not tracked');
  });

  it('counts active products, those to reorder and those out of stock', async () => {
    await open();
    const tiles = Array.from(screen.querySelectorAll('.tile'), (tile) => texts(tile, 'small, b'));
    expect(tiles).toEqual([
      ['Active products', '84'],
      ['Below reorder level', '6'],
      ['Out of stock', '2'],
    ]);
  });

  it('asks for active products, first page, to begin with', async () => {
    await open();
    expect(lastList().get('active')).toBe('true');
    expect(lastList().get('page')).toBe('1');
  });

  it('filters on the server, starting again at page 1', async () => {
    await open();
    press(screen, 'Next', 'button');
    await answerProducts(1);
    expect(lastList().get('page')).toBe('2');

    choose(screen, 'select[aria-label="Category"]', '1');
    await answerProducts(1);
    expect(lastList().get('category')).toBe('1');
    expect(lastList().get('page')).toBe('1');

    choose(screen, 'select[aria-label="Stock"]', 'reorder');
    await answerProducts(1);
    expect(lastList().get('below_reorder')).toBe('true');

    choose(screen, 'select[aria-label="Status"]', 'all');
    await answerProducts(1);
    expect(lastList().has('active')).toBe(false);
  });

  it('searches once the user pauses typing', async () => {
    await open();
    type(screen, 'input[type=search]', 'drill');
    await answerProducts(1);
    expect(lastList().get('search')).toBe('drill');
  });

  it('pages through the list', async () => {
    await open();
    expect(find(screen, '.pager-range').textContent).toBe('1–50 of 87');
    expect(find<HTMLButtonElement>(screen, '.pager button').disabled).toBe(true);
  });

  it('offers the category filter in tree order, sub-categories marked', async () => {
    await open();
    expect(texts(screen, 'select[aria-label="Category"] option')).toEqual([
      'All categories',
      'Power tools',
      '— Drills',
      'Hand tools',
      '— Wrenches',
    ]);
  });

  it('adds a product, sending prices as text', async () => {
    await open();
    press(screen, 'Add product');
    await settle();
    const card = dialog();
    type(card, '#p-code', 'TL-0102');
    type(card, '#p-name', 'Impact drill 16mm');
    const category = find<HTMLSelectElement>(card, '#p-category');
    category.value = Array.from(category.options).find(
      (o) => o.text.trim() === 'Power tools → Drills',
    )!.value;
    category.dispatchEvent(new Event('change'));
    type(card, '#p-retail', '95.50');
    type(card, '#p-wholesale', '88');
    press(card, 'Save product');

    const req = http.expectOne((r) => r.url === PRODUCT_URL && r.method === 'POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        code: 'TL-0102',
        name: 'Impact drill 16mm',
        category: 2,
        brand: null,
        unit: 1,
        barcode: null,
        retail_price: '95.50',
        wholesale_price: '88',
        track_stock: true,
        reorder_level: '0',
        warranty_months: 0,
        is_active: true,
      }),
    );
    req.flush({ ...DRILL, id: 99 });
    await answerProducts(4);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('will not send a price with a comma', async () => {
    await open();
    press(screen, 'Add product');
    await settle();
    const card = dialog();
    type(card, '#p-retail', '1,200.00');
    press(card, 'Save product');
    await settle();
    expect(texts(card, '.hint.warn')).toContain('A price in dollars and cents, no commas.');
    press(card, 'Cancel');
    await settle();
  });

  it('edits a product, showing stock and cost read-only', async () => {
    await open();
    row('TL-0101').querySelector<HTMLButtonElement>('.rowlink')!.click();
    await settle();
    const card = dialog();
    expect(find<HTMLInputElement>(card, '#p-onhand').value).toBe('14 Piece');
    expect(find<HTMLInputElement>(card, '#p-avgcost').value).toBe('$52.40');
    expect(find<HTMLInputElement>(card, '#p-reorder').value).toBe('6');
    type(card, '#p-shelf', 'b2-4');
    press(card, 'Save product');

    const req = http.expectOne(`${PRODUCT_URL}11/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        shelf_location: 'b2-4',
        reorder_level: '6',
        retail_price: '78.00',
      }),
    );
    req.flush(DRILL);
    await answerProducts(4);
    await settle();
  });

  it("shows the server's refusal beside the field", async () => {
    await open();
    row('TL-0101').querySelector<HTMLButtonElement>('.rowlink')!.click();
    await settle();
    const card = dialog();
    find<HTMLInputElement>(card, 'input[formcontrolname="track_stock"]').click();
    press(card, 'Save product');
    http
      .expectOne(`${PRODUCT_URL}11/`)
      .flush(
        { track_stock: ['This product has stock history, so it must keep tracking stock.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    expect(texts(card, '.field .hint.warn')).toContain(
      'This product has stock history, so it must keep tracking stock.',
    );
  });

  it('locks the reorder fields at zero when stock is not tracked', async () => {
    await open();
    press(screen, 'Add product');
    await settle();
    const card = dialog();
    type(card, '#p-reorder', '5');
    find<HTMLInputElement>(card, 'input[formcontrolname="track_stock"]').click();
    await settle();
    const reorder = find<HTMLInputElement>(card, '#p-reorder');
    expect(reorder.disabled).toBe(true);
    expect(reorder.value).toBe('0');
    press(card, 'Cancel');
    await settle();
  });

  it('sends an image as multipart, a missing brand as empty text', async () => {
    await open();
    row('SV-0001').querySelector<HTMLButtonElement>('.rowlink')!.click();
    await settle();
    const card = dialog();
    const photo = new File(['jpg'], 'keys.jpg', { type: 'image/jpeg' });
    pickFile(card, '#p-image', photo);
    press(card, 'Save product');

    const req = http.expectOne(`${PRODUCT_URL}13/`);
    const body = req.request.body as FormData;
    expect(body.get('image')).toBe(photo);
    expect(body.get('brand')).toBe('');
    expect(body.get('track_stock')).toBe('false');
    req.flush(KEY_CUTTING);
    await answerProducts(4);
    await settle();
  });

  it('deactivates a product once confirmed', async () => {
    await open();
    row('TL-0118').querySelector<HTMLButtonElement>('.rowlink')!.click();
    await settle();
    press(dialog(), 'Deactivate');
    await settle();
    expect(find(dialog(), 'h3').textContent).toBe('Deactivate Angle grinder 100mm 570W?');
    press(dialog(), 'Deactivate');

    const req = http.expectOne(`${PRODUCT_URL}12/`);
    expect(req.request.body).toEqual({ is_active: false });
    req.flush({ ...GRINDER, is_active: false });
    await answerProducts(4);
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('shows a Seller no cost, and nothing to change', async () => {
    await open(SELLER, SELLER_LIST);
    expect(texts(screen, 'thead th')).not.toContain('Avg cost');
    expect(texts(row('TL-0101'), 'td')).not.toContain('$52.40');
    expect(screen.querySelector('tbody .rowlink')).toBeNull();
    expect(texts(screen, '.filters .btn')).toEqual([]);
  });
});
