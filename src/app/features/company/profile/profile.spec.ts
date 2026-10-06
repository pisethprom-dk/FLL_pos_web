// v1.0.0
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { CompanyProfile } from '../../../api/models/company-profile';
import { SessionStore } from '../../../core/session/session-store';
import {
  ADMIN,
  SHOP_PROFILE,
  TODAY_RATE,
  answer,
  signIn,
} from '../../../core/session/session-testing';
import {
  APP_PROVIDERS,
  choose,
  find,
  openScreen,
  pickFile,
  press,
  texts,
  type,
} from '../../../shared/screen-testing';

const PROFILE: CompanyProfile = {
  ...SHOP_PROFILE,
  name_kh: 'ហាង សុខ ហេង',
  phone: '012 345 678',
  vat_tin: 'K001-901234567',
  logo: '/media/company/logo.png',
  receipt_header: 'Sok Heng Mart · Toul Kork',
  receipt_footer: 'Thank you',
  receipt_paper_width: '80mm',
  receipt_language: 'BOTH',
  receipt_show_riel_total: true,
  receipt_show_rate_used: true,
  receipt_show_seller: false,
};

describe('Company profile', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let page: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    // The shell asks for the profile too: answer both.
    harness = await openScreen(http, '/company/profile', [
      { url: '/api/company/profile/', body: PROFILE, count: 2 },
    ]);
    page = harness.routeNativeElement!;
  });

  afterEach(() => http.verify());

  const value = (selector: string) => find<HTMLInputElement>(page, selector).value;
  const checked = (selector: string) => find<HTMLInputElement>(page, selector).checked;
  const settle = () => harness.fixture.whenStable();

  it('fills both panels with what the server holds', () => {
    expect(value('#f-shopname')).toBe('Sok Heng Mart');
    expect(value('#f-shopkh')).toBe('ហាង សុខ ហេង');
    expect(value('#f-tin')).toBe('K001-901234567');
    expect(find<HTMLImageElement>(page, '.image-field img').getAttribute('src')).toBe(
      '/media/company/logo.png',
    );
    expect(value('#f-rhead')).toBe('Sok Heng Mart · Toul Kork');
    expect(find<HTMLSelectElement>(page, '#f-lang').value).toBe('BOTH');
    expect(checked('input[formcontrolname="receipt_show_seller"]')).toBe(false);
  });

  it('saves shop details as JSON with only their own fields, and the sidebar follows', async () => {
    type(page, '#f-shopname', 'Sok Heng Hardware');
    press(page, 'Save changes');

    const req = http.expectOne('/api/company/profile/');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      name: 'Sok Heng Hardware',
      name_kh: 'ហាង សុខ ហេង',
      address: 'Street 315, Toul Kork, Phnom Penh',
      phone: '012 345 678',
      vat_tin: 'K001-901234567',
    });
    req.flush({ ...PROFILE, name: 'Sok Heng Hardware' });
    await settle();

    expect(texts(page, '.form-foot .saved')).toEqual(['Saved.']);
    const sidebar = harness.fixture.nativeElement as HTMLElement;
    expect(find(sidebar, '.brand b').textContent).toBe('Sok Heng Hardware');
  });

  it('sends a new logo as multipart, with the file', async () => {
    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    pickFile(page, '#f-logo', file);
    await settle();
    press(page, 'Save changes');

    const req = http.expectOne('/api/company/profile/');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('logo')).toBe(file);
    expect(body.get('name')).toBe('Sok Heng Mart');
    req.flush(PROFILE);
    await settle();
  });

  it('takes the logo away with a null', async () => {
    press(page, 'remove it');
    await settle();
    expect(texts(page, '.image-field .hint.warn')[0]).toContain('Removed when you save');
    press(page, 'Save changes');

    const req = http.expectOne('/api/company/profile/');
    expect(req.request.body).toEqual(expect.objectContaining({ logo: null }));
    req.flush({ ...PROFILE, logo: null });
    await settle();
    expect(page.querySelector('.image-field img')).toBeNull();
  });

  it("shows the server's refusal beside the field", async () => {
    type(page, '#f-tin', 'K001-901234567-and-much-more');
    press(page, 'Save changes');
    http
      .expectOne('/api/company/profile/')
      .flush(
        { vat_tin: ['Ensure this field has no more than 50 characters.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    const field = find(page, '#f-tin').closest('.field')!;
    expect(texts(field, '.hint.warn')).toEqual([
      'Ensure this field has no more than 50 characters.',
    ]);
  });

  it('needs a shop name before it sends anything', async () => {
    type(page, '#f-shopname', '');
    press(page, 'Save changes');
    await settle();
    expect(texts(page, '.hint.warn')).toContain('Enter the shop name.');
    // http.verify() in afterEach: nothing was sent.
  });

  it('saves the receipt panel alone, leaving unsaved shop edits as typed', async () => {
    type(page, '#f-shopname', 'Not saved yet');
    choose(page, '#f-paper', '58mm');
    find<HTMLInputElement>(page, 'input[formcontrolname="receipt_show_seller"]').click();
    const [, saveReceipt] = Array.from(
      page.querySelectorAll<HTMLButtonElement>('button[type=submit]'),
    );
    saveReceipt.click();

    const req = http.expectOne('/api/company/profile/');
    expect(req.request.body).toEqual({
      receipt_header: 'Sok Heng Mart · Toul Kork',
      receipt_footer: 'Thank you',
      receipt_paper_width: '58mm',
      receipt_language: 'BOTH',
      receipt_show_riel_total: true,
      receipt_show_rate_used: true,
      receipt_show_seller: true,
    });
    req.flush({ ...PROFILE, receipt_paper_width: '58mm', receipt_show_seller: true });
    await settle();

    expect(value('#f-shopname')).toBe('Not saved yet');
  });

  it('Cancel puts back what was saved', async () => {
    type(page, '#f-shopname', 'A typo');
    const [cancelShop] = Array.from(page.querySelectorAll<HTMLButtonElement>('.btn.ghost'));
    cancelShop.click();
    await settle();
    expect(value('#f-shopname')).toBe('Sok Heng Mart');
  });
});

describe('Company profile, when it will not load', () => {
  it("shows the server's words and tries again", async () => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    const http = TestBed.inject(HttpTestingController);
    signIn(TestBed.inject(SessionStore), http, ADMIN);
    const created = RouterTestingHarness.create('/company/profile');
    // The shell's call and the screen's call both fail.
    await answer(
      http,
      '/api/company/profile/',
      { detail: 'Server is down for upkeep.' },
      {
        count: 2,
        status: 503,
        statusText: 'Service Unavailable',
      },
    );
    const harness = await created;
    await answer(http, '/api/company/rate/', TODAY_RATE);
    await harness.fixture.whenStable();
    const page = harness.routeNativeElement!;

    expect(find(page, '.note').textContent).toContain('Server is down for upkeep.');
    press(page, 'Try again');
    await answer(http, '/api/company/profile/', PROFILE);
    await harness.fixture.whenStable();
    expect(find<HTMLInputElement>(page, '#f-shopname').value).toBe('Sok Heng Mart');
    http.verify();
  });
});
