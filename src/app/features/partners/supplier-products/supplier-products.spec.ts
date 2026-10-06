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
import {
  BRANDS,
  BRAND_URL,
  CATEGORIES,
  CATEGORY_URL,
  UNIT_URL,
  page,
} from '../../catalogue/catalogue-testing';
import {
  DRILL_LINK,
  DRILL_LOOKUP,
  LINK_URL,
  LOOKUP_URL,
  SCREW_LINK,
  STOCK_UNITS,
  answerEach,
  chooseLabel,
  key,
} from '../../stock/stock-testing';
import { LIM_HENG, SUPPLIER_URL, TOTAL_TOOLS } from '../partners-testing';

describe('Supplier products', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;
  const seen: TestRequest[] = [];

  const links = () => answerEach(http, LINK_URL, () => page([SCREW_LINK, DRILL_LINK]), 1, seen);

  async function open(user: Me = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    const created = RouterTestingHarness.create('/partners/supplier-products');
    await answer(http, SUPPLIER_URL, page([TOTAL_TOOLS, LIM_HENG]));
    await answer(http, UNIT_URL, page(STOCK_UNITS));
    await links();
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    screen = harness.routeNativeElement!;
  }

  beforeEach(() => (seen.length = 0));
  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const last = () => seen.at(-1)!.request.params;

  async function addDialog(): Promise<HTMLElement> {
    press(screen, 'Add link');
    await answer(http, BRAND_URL, page(BRANDS));
    await answer(http, CATEGORY_URL, page(CATEGORIES));
    await settle();
    return dialog();
  }

  it("lists which supplier carries what, in each one's usual pack", async () => {
    await open();
    expect(Array.from(screen.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td'))).toEqual([
      [
        'Wood screw 4×40mm FX-0302',
        'Total Tools (Cambodia) Co., Ltd',
        'TT-WS440',
        'Carton of 24',
        'Preferred',
        'Edit',
      ],
      ['Impact drill 13mm 710W TL-0101', 'Lim Heng Import Export', '—', 'Piece', '', 'Edit'],
    ]);
  });

  it('filters by supplier and by preferred, starting again at page 1', async () => {
    await open();
    choose(screen, 'select[aria-label="Supplier"]', '1');
    await links();
    expect([last().get('supplier'), last().get('page')]).toEqual(['1', '1']);
    choose(screen, 'select[aria-label="Preferred"]', 'preferred');
    await links();
    expect(last().get('preferred')).toBe('true');
  });

  it('links a product found by its code, in a pack the supplier sells', async () => {
    await open();
    const card = await addDialog();
    press(card, 'Save link');
    await settle();
    expect(find(card, '.field .hint.warn').textContent).toContain('Find it above');

    const box = find<HTMLInputElement>(card, 'input[aria-label="Barcode or code"]');
    box.value = 'TL-0101';
    key(box, 'Enter');
    await answer(http, LOOKUP_URL, [DRILL_LOOKUP]);
    await settle();
    expect(card.querySelector('app-product-picker')).toBeNull();
    expect(texts(card, '.picked b, .picked span, .picked button')).toEqual([
      'Impact drill 13mm 710W',
      'TL-0101 · sold by the Piece',
      'Change',
    ]);

    const size = () => find<HTMLInputElement>(card, '#l-size');
    expect([size().value, size().disabled]).toEqual(['1', true]);
    chooseLabel(card, '#l-supplier', 'Lim Heng');
    chooseLabel(card, '#l-unit', 'Carton');
    await settle();
    expect(size().disabled).toBe(false);
    type(card, '#l-size', '10');
    type(card, '#l-sku', 'LH-GSB550');
    find<HTMLInputElement>(card, 'input[formcontrolname="is_preferred"]').click();
    press(card, 'Save link');

    const req = http.expectOne((r) => r.url === LINK_URL && r.method === 'POST');
    expect(req.request.body).toEqual({
      product: 11,
      supplier: 2,
      supplier_sku: 'LH-GSB550',
      pack_unit: 7,
      pack_size: '10',
      is_preferred: true,
      notes: '',
    });
    req.flush({ ...DRILL_LINK, id: 9 });
    await links();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('changes a pack, keeping the product and supplier fixed', async () => {
    await open();
    find<HTMLButtonElement>(screen.querySelectorAll('tbody tr')[0], '.rowlink').click();
    await settle();
    const card = dialog();
    expect(card.querySelector('app-product-picker')).toBeNull();
    expect(find<HTMLSelectElement>(card, '#l-supplier').disabled).toBe(true);
    expect(find<HTMLInputElement>(card, '#l-size').value).toBe('24');
    chooseLabel(card, '#l-unit', 'Box — one at a time');
    await settle();
    press(card, 'Save link');
    const req = http.expectOne(`${LINK_URL}5/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      supplier_sku: 'TT-WS440',
      pack_unit: null,
      pack_size: '1',
      is_preferred: true,
      notes: '',
    });
    req.flush({ ...SCREW_LINK, pack_unit: null, pack_unit_name: null, pack_size: '1.00' });
    await links();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it("says so, in the server's words, when the pair is already linked", async () => {
    await open();
    const card = await addDialog();
    const box = find<HTMLInputElement>(card, 'input[aria-label="Barcode or code"]');
    box.value = 'TL-0101';
    key(box, 'Enter');
    await answer(http, LOOKUP_URL, [DRILL_LOOKUP]);
    await settle();
    chooseLabel(card, '#l-supplier', 'Lim Heng');
    press(card, 'Save link');
    http
      .expectOne((r) => r.url === LINK_URL && r.method === 'POST')
      .flush(
        { non_field_errors: ['The fields product, supplier must make a unique set.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    expect(texts(card, '.form-error')).toEqual([
      'The fields product, supplier must make a unique set.',
    ]);
  });

  it('removes a link once confirmed', async () => {
    await open();
    find<HTMLButtonElement>(screen.querySelectorAll('tbody tr')[1], '.rowlink').click();
    await settle();
    press(dialog(), 'Remove link');
    await settle();
    expect(find(dialog(), 'h3').textContent).toBe('Remove Lim Heng Import Export for TL-0101?');
    press(dialog(), 'Remove link');
    const req = http.expectOne(`${LINK_URL}6/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await links();
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('lets a Seller read the links but change none', async () => {
    await open(SELLER);
    expect(screen.querySelector('.filters .btn')).toBeNull();
    expect(screen.querySelectorAll('tbody .rowlink').length).toBe(0);
  });
});
