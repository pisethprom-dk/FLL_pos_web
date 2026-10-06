// v1.0.0
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, SELLER, answer, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  dialog,
  dialogCount,
  find,
  openScreen,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';
import { UNITS, UNIT_URL, page } from '../catalogue-testing';

describe('Units', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;

  async function open(user = ADMIN): Promise<void> {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, user);
    harness = await openScreen(http, '/catalogue/units', [{ url: UNIT_URL, body: page(UNITS) }]);
    screen = harness.routeNativeElement!;
  }

  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const rows = () =>
    Array.from(screen.querySelectorAll('tbody tr'), (tr) => texts(tr, 'td').slice(0, 5));

  it('lists every unit, inactive ones marked', async () => {
    await open();
    expect(rows()).toEqual([
      ['PCS', 'Piece', 'ដុំ', '1', 'Active'],
      ['SET', 'Set', '—', '2', 'Active'],
      ['HR', 'Hour', '—', '9', 'Inactive'],
    ]);
    expect(find(screen, '.panel-note').textContent!.trim()).toBe('3 units · 2 active');
  });

  it('narrows the list as the user searches', async () => {
    await open();
    type(screen, 'input[type=search]', 'se');
    await settle();
    expect(rows().map((r) => r[0])).toEqual(['SET']);
  });

  it('adds a unit', async () => {
    await open();
    press(screen, 'Add unit');
    await settle();
    const card = dialog();
    type(card, '#unit-code', 'BX100');
    type(card, '#unit-name', 'Box of 100');
    press(card, 'Save unit');

    const req = http.expectOne(UNIT_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      code: 'BX100',
      name: 'Box of 100',
      name_kh: '',
      display_order: 1,
      is_active: true,
    });
    req.flush({ id: 4, code: 'BX100', name: 'Box of 100' });
    await answer(http, UNIT_URL, page(UNITS));
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it("shows the server's refusal beside the field", async () => {
    await open();
    press(screen, 'Add unit');
    await settle();
    const card = dialog();
    type(card, '#unit-code', 'PCS');
    type(card, '#unit-name', 'Piece again');
    press(card, 'Save unit');
    http
      .expectOne(UNIT_URL)
      .flush(
        { code: ['unit with this code already exists.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();
    expect(texts(find(card, '#unit-code').closest('.field')!, '.hint.warn')).toEqual([
      'unit with this code already exists.',
    ]);
  });

  it('deactivates a unit only once confirmed', async () => {
    await open();
    screen.querySelector<HTMLButtonElement>('tbody .rowlink')!.click();
    await settle();
    press(dialog(), 'Deactivate');
    await settle();
    expect(find(dialog(), 'h3').textContent).toBe('Deactivate Piece?');
    press(dialog(), 'Deactivate');

    const req = http.expectOne(`${UNIT_URL}1/`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ is_active: false });
    req.flush({ ...UNITS[0], is_active: false });
    await answer(http, UNIT_URL, page(UNITS));
    await settle();
    expect(dialogCount()).toBe(0);
  });

  it('lets a Seller read the list but not change it', async () => {
    await open(SELLER);
    expect(rows().length).toBe(3);
    expect(screen.querySelector('.filters .btn')).toBeNull();
    expect(screen.querySelector('tbody .rowlink')).toBeNull();
  });
});
