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
  UNIT_URL,
  page,
} from '../../catalogue/catalogue-testing';
import { LIM_HENG, SUPPLIER_URL, TOTAL_TOOLS } from '../../partners/partners-testing';
import {
  DRILL_LOOKUP,
  GRINDER_LOOKUP,
  GRN_DRAFT,
  GRN_POSTED,
  GRN_REVERSAL,
  GRN_REVERSED,
  KEY_LOOKUP,
  LINK_URL,
  LOOKUP_URL,
  SCREW_LINK,
  SCREW_LOOKUP,
  STOCK_IN_URL,
  STOCK_UNITS,
  answerEach,
  chooseLabel,
  key,
} from '../stock-testing';

/** The list carries a page number; the two tile counts do not. */
function listFor(req: TestRequest): object {
  const params = req.request.params;
  if (params.has('page')) return page([GRN_DRAFT, GRN_POSTED, GRN_REVERSED, GRN_REVERSAL]);
  if (params.get('status') === 'DRAFT') return page([], 2);
  return page([], 23);
}

describe('Stock in', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  async function open(): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    const created = RouterTestingHarness.create('/stock/in');
    await answer(http, SUPPLIER_URL, page([TOTAL_TOOLS, LIM_HENG]));
    await answerEach(http, STOCK_IN_URL, listFor, 3, seen);
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const lastList = () => seen.filter((r) => r.request.params.has('page')).at(-1)!.request.params;
  const reloaded = () => answerEach(http, STOCK_IN_URL, listFor, 3, seen);

  /**
   * A dialog's own calls: suppliers and units; for a draft the picker's brands
   * and categories; and for a saved draft its supplier's links.
   */
  async function answerDialog(draft: boolean, links?: object[]): Promise<void> {
    await answer(http, SUPPLIER_URL, page([TOTAL_TOOLS, LIM_HENG]));
    await answer(http, UNIT_URL, page(STOCK_UNITS));
    if (draft) {
      await answer(http, BRAND_URL, page(BRANDS));
      await answer(http, CATEGORY_URL, page(CATEGORIES));
    }
    if (links) await answer(http, LINK_URL, page(links));
    await settle();
  }

  function openRow(number: string): void {
    const row = Array.from(screen.querySelectorAll('tbody tr')).find((tr) =>
      tr.querySelector('td')!.textContent!.includes(number),
    )!;
    find<HTMLButtonElement>(row, '.rowlink').click();
  }

  /** Types a code into the picker and presses Enter, answering the lookup. */
  async function scan(card: HTMLElement, code: string, found: object[]): Promise<void> {
    const box = find<HTMLInputElement>(card, 'input[aria-label="Barcode or code"]');
    box.value = code;
    key(box, 'Enter');
    await answer(http, LOOKUP_URL, found);
    await settle();
  }

  /** A new stock-in from `supplier`, whose links are `links`. */
  async function startNew(supplier: string, links: object[]): Promise<HTMLElement> {
    press(screen, 'New stock in');
    await answerDialog(true);
    const card = dialog();
    chooseLabel(card, '#grn-supplier', supplier);
    await answer(http, LINK_URL, page(links));
    await settle();
    return card;
  }

  it('lists stock-ins with supplier, reference, lines, value and status', async () => {
    await open();
    const rows = Array.from(screen.querySelectorAll('tbody tr'), (tr) =>
      texts(tr, 'td').slice(0, 7),
    );
    expect(rows[0]).toEqual([
      'GRN-000313',
      '30 Sep 2026',
      'Total Tools (Cambodia) Co., Ltd',
      'TT-88204',
      '1',
      '$52.80',
      'Draft',
    ]);
    expect(rows[2][0]).toBe('GRN-000310 Reversed by GRN-000314');
    expect(rows[2][6]).toBe('Reversed');
    expect(rows[3][0]).toBe('GRN-000314 Reverses GRN-000312');
    expect(Array.from(screen.querySelectorAll('.tile'), (t) => texts(t, 'small, b'))).toEqual([
      ['Posted this month', '23'],
      ['Drafts waiting', '2'],
    ]);
  });

  it('filters on the server, from this month by default, starting again at page 1', async () => {
    await open();
    expect(lastList().get('date_from')).toBe(`${today().slice(0, 7)}-01`);

    choose(screen, 'select[aria-label="Status"]', 'DRAFT');
    await answerEach(http, STOCK_IN_URL, listFor, 1, seen);
    expect(lastList().get('status')).toBe('DRAFT');
    expect(lastList().get('page')).toBe('1');

    choose(screen, 'select[aria-label="Supplier"]', '2');
    await answerEach(http, STOCK_IN_URL, listFor, 1, seen);
    expect(lastList().get('supplier')).toBe('2');

    choose(screen, 'select[aria-label="Period"]', 'all');
    await answerEach(http, STOCK_IN_URL, listFor, 1, seen);
    expect(lastList().has('date_from')).toBe(false);

    type(screen, 'input[type=search]', 'TT-88');
    await answerEach(http, STOCK_IN_URL, listFor, 1, seen);
    expect(lastList().get('search')).toBe('TT-88');
  });

  it("fills a line from the supplier's pack, previews it exactly, and saves the draft", async () => {
    await open();
    press(screen, 'New stock in');
    await answerDialog(true);
    const card = dialog();
    expect(texts(card, '.scan-note')).toEqual([
      'Choose the supplier first — their usual packs fill the lines in.',
    ]);
    expect(find<HTMLInputElement>(card, 'input[aria-label="Barcode or code"]').disabled).toBe(true);
    expect(find<HTMLInputElement>(card, '#grn-number').value).toBe('Given on first save');

    chooseLabel(card, '#grn-supplier', 'Total Tools');
    await answer(http, LINK_URL, page([SCREW_LINK]));
    await settle();
    await scan(card, '8850000000302', [SCREW_LOOKUP]);

    const row = find(card, 'tbody tr');
    expect(find<HTMLSelectElement>(row, 'select').selectedOptions[0].text.trim()).toBe('Carton');
    expect(find<HTMLInputElement>(row, 'input[aria-label="Per pack, FX-0302"]').value).toBe('24');
    type(row, 'input[aria-label="Quantity, FX-0302"]', '2');
    type(row, 'input[aria-label="Cost each pack, FX-0302"]', '26.40');
    await settle();
    expect(texts(row, 'td').slice(5, 8)).toEqual(['48 Box', '$1.1000', '$52.80']);
    expect(texts(card, 'tfoot td')).toEqual(['1 line', '48', '', '$52.80', '']);

    type(card, '#grn-ref', 'TT-88204');
    press(card, 'Save draft');
    const req = http.expectOne((r) => r.url === STOCK_IN_URL && r.method === 'POST');
    expect(req.request.body).toEqual({
      supplier: 1,
      doc_date: today(),
      supplier_ref: 'TT-88204',
      note: '',
      lines: [{ product: 21, pack_unit: 7, packs: '2', pack_size: '24', pack_cost: '26.40' }],
    });
    req.flush(GRN_DRAFT);
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it("locks Per pack at 1 for the product's own unit, and frees it for a pack", async () => {
    await open();
    const card = await startNew('Lim Heng', []);
    await scan(card, 'TL-0101', [DRILL_LOOKUP]);
    const row = find(card, 'tbody tr');
    const size = () => find<HTMLInputElement>(row, 'input[aria-label="Per pack, TL-0101"]');
    expect([size().value, size().disabled]).toEqual(['1', true]);

    chooseLabel(row, 'select', 'Carton');
    await settle();
    expect(size().disabled).toBe(false);
    type(row, 'input[aria-label="Per pack, TL-0101"]', '4');
    chooseLabel(row, 'select', 'Piece');
    await settle();
    expect([size().value, size().disabled]).toEqual(['1', true]);
  });

  it('takes a product once, refuses one that tracks no stock, and lists several matches', async () => {
    await open();
    const card = await startNew('Lim Heng', []);
    await scan(card, 'TL-0101', [DRILL_LOOKUP]);
    await scan(card, 'tl-0101', [DRILL_LOOKUP]);
    expect(card.querySelectorAll('tbody tr').length).toBe(1);

    await scan(card, 'SV-0001', [KEY_LOOKUP]);
    expect(texts(card, '.scan-note')).toEqual(['SV-0001 Key cutting does not track stock.']);

    await scan(card, 'grinder', [GRINDER_LOOKUP, KEY_LOOKUP]);
    expect(texts(card, '.scan-note')).toEqual([
      'One product matches “grinder” — choose it from the list.',
    ]);
    chooseLabel(card, 'select[aria-label="Product"]', 'Angle grinder');
    await settle();
    press(card, 'Add product');
    await settle();
    expect(texts(card, 'tbody td:first-child')).toEqual([
      'Impact drill 13mm 710W TL-0101',
      'Angle grinder 100mm 570W TL-0118',
    ]);
  });

  it('saves a new stock-in, then posts it, once confirmed', async () => {
    await open();
    const card = await startNew('Lim Heng', []);
    await scan(card, 'TL-0101', [DRILL_LOOKUP]);
    type(card, 'input[aria-label="Quantity, TL-0101"]', '6');
    type(card, 'input[aria-label="Cost each pack, TL-0101"]', '52.40');
    press(card, 'Post to stock');
    await settle();
    expect(find(dialog(), '.confirm-message').textContent).toContain('1 line, $314.40.');
    press(dialog(), 'Post to stock');

    http
      .expectOne((r) => r.url === STOCK_IN_URL && r.method === 'POST')
      .flush({ ...GRN_DRAFT, id: 315, number: 'GRN-000315' });
    const post = http.expectOne(`${STOCK_IN_URL}315/post/`);
    expect(post.request.method).toBe('POST');
    post.flush(GRN_POSTED);
    await reloaded();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it("shows a refused line in the server's words", async () => {
    await open();
    const card = await startNew('Lim Heng', []);
    await scan(card, 'TL-0101', [DRILL_LOOKUP]);
    type(card, 'input[aria-label="Quantity, TL-0101"]', '6');
    type(card, 'input[aria-label="Cost each pack, TL-0101"]', '52.40');
    press(card, 'Save draft');
    http
      .expectOne((r) => r.url === STOCK_IN_URL && r.method === 'POST')
      .flush(
        {
          lines: [
            {
              pack_cost: ['Ensure that there are no more than 8 digits before the decimal point.'],
            },
          ],
        },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    expect(texts(card, '.form-error')).toEqual([
      'Line 1: Ensure that there are no more than 8 digits before the decimal point.',
    ]);
  });

  it('asks before Escape throws away unsaved work', async () => {
    await open();
    await startNew('Total Tools', []);
    key(document.body, 'Escape');
    await settle();
    expect(find(dialog(), 'h3').textContent).toBe('Close without saving?');
    press(dialog(), 'Cancel');
    await settle();
    expect(dialogCount()).toBe(1);

    key(document.body, 'Escape');
    await settle();
    press(dialog(), 'Close without saving');
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('shows a posted stock-in read-only, and reverses it with a reason', async () => {
    await open();
    openRow('GRN-000312');
    await answerDialog(false);
    const card = dialog();
    expect(card.querySelector('app-product-picker')).toBeNull();
    expect(find<HTMLSelectElement>(card, '#grn-supplier').disabled).toBe(true);
    expect(texts(card, 'tbody td')).toEqual([
      'Impact drill 13mm 710W TL-0101',
      'Piece',
      '6',
      '1',
      '$52.40',
      '6 Piece',
      '$52.4000',
      '$314.40',
    ]);

    press(card, 'Reverse…');
    await settle();
    press(dialog(), 'Reverse GRN-000312');
    await settle();
    expect(texts(dialog(), '.hint.warn')).toEqual([
      'Say why — it is kept on the reversing document.',
    ]);
    type(dialog(), '#reverse-note', 'Keyed twice');
    press(dialog(), 'Reverse GRN-000312');
    const req = http.expectOne(`${STOCK_IN_URL}312/reverse/`);
    expect(req.request.body).toEqual({ note: 'Keyed twice' });
    req.flush(GRN_REVERSAL);

    // The reversal opens in its place.
    await reloaded();
    await answerDialog(false);
    expect(dialogCount()).toBe(1);
    expect(find(dialog(), 'h3').textContent).toBe('Stock in GRN-000314');
    expect(find(dialog(), '.note').textContent).toContain('This reverses GRN-000312');
    expect(texts(dialog(), '.form-foot button')).toEqual(['Close']);
    press(dialog(), 'Close');
    await settle();
  });

  it('imports a checked list into a saved draft', async () => {
    await open();
    openRow('GRN-000313');
    await answerDialog(true, [SCREW_LINK]);
    press(dialog(), 'Import a list…');
    await settle();

    const card = dialog();
    expect(find(card, 'h3').textContent).toBe('Import a product list into GRN-000313');
    pickFile(card, '#import-file', new File(['code,quantity,unit_cost\n'], 'lines.csv'));
    await settle();
    press(card, 'Check the file');
    const check = http.expectOne(`${STOCK_IN_URL}313/import/`);
    const sent = check.request.body as FormData;
    expect([sent.get('commit'), sent.get('replace'), sent.get('has_header')]).toEqual([
      'false',
      'false',
      'true',
    ]);
    const row = { pack_size: null, pack_unit: null };
    check.flush({
      rows: [
        {
          ...row,
          row: 2,
          code: 'TL-0101',
          product: 11,
          product_name: 'Impact drill 13mm 710W',
          quantity: '6',
          unit_cost: '52.40',
          result: 'Matched',
        },
        {
          ...row,
          row: 3,
          code: 'TL-9999',
          product: null,
          product_name: '',
          quantity: '2',
          unit_cost: '12',
          result: 'No such code',
        },
      ],
      ready: 1,
      to_fix: 1,
      imported: 0,
    });
    await settle();
    expect(Array.from(card.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td'))).toEqual([
      ['2', 'TL-0101', 'Impact drill 13mm 710W', '6', '$52.40', 'Matched'],
      ['3', 'TL-9999', 'not found', '2', '$12.00', 'No such code'],
    ]);
    expect(texts(card, 'tfoot td')).toEqual(['2 rows · 1 ready, 1 to fix']);

    press(card, 'Import 1 row');
    const commit = http.expectOne(`${STOCK_IN_URL}313/import/`);
    expect((commit.request.body as FormData).get('commit')).toBe('true');
    commit.flush({ rows: [], ready: 1, to_fix: 1, imported: 1 });
    const fresh = http.expectOne(`${STOCK_IN_URL}313/`);
    fresh.flush({
      ...GRN_DRAFT,
      total: '367.20',
      lines: [...GRN_DRAFT.lines!, ...GRN_POSTED.lines!],
    });
    await settle();
    expect(dialogCount()).toBe(1);
    expect(texts(dialog(), 'tbody td:first-child')).toEqual([
      'Wood screw 4×40mm FX-0302',
      'Impact drill 13mm 710W TL-0101',
    ]);
    expect(texts(dialog(), 'tfoot td').at(-2)).toBe('$367.20');
  });
});
