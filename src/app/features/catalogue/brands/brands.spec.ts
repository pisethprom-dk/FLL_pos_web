// v1.0.0
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { SessionStore } from '../../../core/session/session-store';
import { ADMIN, answer, signIn } from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  dialog,
  find,
  openScreen,
  pickFile,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';
import { BRANDS, BRAND_URL, page } from '../catalogue-testing';

describe('Brands', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let screen: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    harness = await openScreen(http, '/catalogue/brands', [{ url: BRAND_URL, body: page(BRANDS) }]);
    screen = harness.routeNativeElement!;
  });

  afterEach(() => http.verify());

  const settle = () => harness.fixture.whenStable();
  const reloaded = async () => {
    await answer(http, BRAND_URL, page(BRANDS));
    await settle();
  };

  it('lists brands with logo, Khmer name, country and state', () => {
    const rows = Array.from(screen.querySelectorAll('tbody tr'));
    expect(rows.map((tr) => texts(tr, 'td').slice(1, 4))).toEqual([
      ['Germany', '1', 'Active'],
      ['Japan', '2', 'Active'],
      ['—', '9', 'Inactive'],
    ]);
    expect(find(rows[1], 'img.thumb').getAttribute('src')).toBe('/media/brands/makita.png');
    expect(find(rows[1], '.cell-sub').textContent).toBe('ម៉ាគីតា');
  });

  it('adds a brand with a logo, as multipart', async () => {
    press(screen, 'Add brand');
    await settle();
    const card = dialog();
    const logo = new File(['png'], 'stanley.png', { type: 'image/png' });
    type(card, '#brand-name', 'Stanley');
    type(card, '#brand-country', 'United States');
    pickFile(card, '#brand-logo', logo);
    press(card, 'Save brand');

    const req = http.expectOne(BRAND_URL);
    const body = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(body.get('name')).toBe('Stanley');
    expect(body.get('logo')).toBe(logo);
    req.flush({ id: 4, name: 'Stanley' });
    await reloaded();
  });

  it('takes a logo away with a null', async () => {
    screen.querySelectorAll<HTMLButtonElement>('tbody .rowlink')[1].click();
    await settle();
    const card = dialog();
    expect(find(card, 'h3').textContent).toBe('Edit Makita');
    press(card, 'remove it');
    await settle();
    press(card, 'Save brand');

    const req = http.expectOne(`${BRAND_URL}2/`);
    expect(req.request.body).toEqual(expect.objectContaining({ name: 'Makita', logo: null }));
    req.flush({ ...BRANDS[1], logo: null });
    await reloaded();
  });

  it('offers no Deactivate on a brand already inactive', async () => {
    screen.querySelectorAll<HTMLButtonElement>('tbody .rowlink')[2].click();
    await settle();
    expect(texts(dialog(), '.form-foot button')).toEqual(['Save brand', 'Cancel']);
    press(dialog(), 'Cancel');
    await settle();
  });
});
