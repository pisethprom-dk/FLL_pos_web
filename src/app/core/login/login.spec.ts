// v2.1.0
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PROVIDERS } from '../../shared/screen-testing';
import { BRAND, SELLER, answer, answerShell, session } from '../session/session-testing';

describe('Login', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: APP_PROVIDERS });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Opens `url` and answers the frame's call for the shop's name. */
  async function open(
    url: string,
    brand: object | null = BRAND,
    status?: number,
  ): Promise<HTMLElement> {
    const created = RouterTestingHarness.create(url);
    await answer(http, '/api/company/brand/', brand, status ? { status } : {});
    harness = await created;
    await harness.fixture.whenStable();
    return harness.fixture.nativeElement as HTMLElement;
  }

  function type(page: HTMLElement, id: string, value: string): void {
    const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function submit(page: HTMLElement): Promise<void> {
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await harness.fixture.whenStable();
  }

  const url = () => TestBed.inject(Router).url;

  it("shows the shop's name, Khmer name and address before anyone signs in", async () => {
    const page = await open('/login');
    expect(page.querySelector('.signin-name')!.textContent).toBe('FLL');
    expect(page.querySelector('.signin-name-kh')!.textContent).toBe('ហាងលក់ឧបករណ៍ជាង');
    expect(page.querySelector('.signin-name-kh')!.getAttribute('lang')).toBe('km');
    expect(page.querySelector('.signin-addr')!.textContent).toBe(
      'Street 315, Toul Kork, Phnom Penh',
    );
    expect(page.querySelector('.signin-title')!.textContent).toBe('Sign in');
  });

  it("shows the shop's logo beside its name, without reading the name twice", async () => {
    const page = await open('/login', { ...BRAND, logo: '/media/company/fll-logo.jpg' });
    const logo = page.querySelector<HTMLImageElement>('.signin-id .signin-logo')!;
    expect(logo.getAttribute('src')).toBe('/media/company/fll-logo.jpg');
    expect(logo.getAttribute('alt')).toBe('');
    expect(page.querySelector('.signin-id .signin-name')!.textContent).toBe('FLL');
  });

  it('shows no logo when the shop has none', async () => {
    const page = await open('/login');
    expect(page.querySelector('.signin-logo')).toBeNull();
  });

  it('names the app instead when the shop cannot be read', async () => {
    const page = await open('/login', null, 503);
    expect(page.querySelector('.signin-name')!.textContent).toBe('POS back office');
    expect(page.querySelector('.signin-name-kh')).toBeNull();
  });

  it('shows and hides the password', async () => {
    const page = await open('/login');
    const input = page.querySelector<HTMLInputElement>('#password')!;
    const toggle = page.querySelector<HTMLButtonElement>('.pw-toggle')!;
    expect(input.type).toBe('password');
    expect(toggle.textContent!.trim()).toBe('Show');

    toggle.click();
    await harness.fixture.whenStable();
    expect(input.type).toBe('text');
    expect(toggle.textContent!.trim()).toBe('Hide');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(input);

    toggle.click();
    await harness.fixture.whenStable();
    expect(input.type).toBe('password');
  });

  it('warns while Caps Lock is on', async () => {
    const page = await open('/login');
    const input = page.querySelector<HTMLInputElement>('#password')!;
    const key = (capsLock: boolean) => {
      const event = new KeyboardEvent('keyup', { key: 'a', bubbles: true });
      Object.defineProperty(event, 'getModifierState', {
        value: (name: string) => name === 'CapsLock' && capsLock,
      });
      input.dispatchEvent(event);
    };

    key(true);
    await harness.fixture.whenStable();
    expect(page.querySelector('app-password-field .hint.warn')!.textContent).toBe(
      'Caps Lock is on.',
    );
    key(false);
    await harness.fixture.whenStable();
    expect(page.querySelector('app-password-field .hint.warn')).toBeNull();
  });

  it('signs in and goes on to where the user was heading', async () => {
    const page = await open('/login?returnUrl=%2Fnot-allowed');
    type(page, 'username', 'sokha');
    type(page, 'password', 'secret');
    await submit(page);

    const req = http.expectOne('/api/auth/login/');
    expect(req.request.body).toEqual({ username: 'sokha', password: 'secret' });
    req.flush(session(SELLER));
    await vi.waitFor(() => expect(url()).toBe('/not-allowed'));
    answerShell(http);
  });

  it("shows the server's refusal and lets the user try again", async () => {
    const page = await open('/login');
    type(page, 'username', 'sokha');
    type(page, 'password', 'wrong');
    await submit(page);

    http
      .expectOne('/api/auth/login/')
      .flush(
        { non_field_errors: ['Username or password is not correct.'] },
        { status: 400, statusText: 'Bad Request' },
      );
    await harness.fixture.whenStable();

    expect(page.querySelector('.form-error')!.textContent).toBe(
      'Username or password is not correct.',
    );
    expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(url()).toBe('/login');
  });

  it('asks for both fields before sending anything', async () => {
    const page = await open('/login');
    await submit(page);

    expect(Array.from(page.querySelectorAll('.hint.warn'), (el) => el.textContent)).toEqual([
      'Enter your username.',
      'Enter your password.',
    ]);
    // http.verify() in afterEach: nothing was sent.
  });

  it('says why when the session ran out', async () => {
    const page = await open('/login?reason=expired');
    expect(page.querySelector('.note')!.textContent).toBe('Your session ended — sign in again.');
  });

  it('sends a new account to choose its password first', async () => {
    const page = await open('/login');
    type(page, 'username', 'sokha');
    type(page, 'password', 'given-by-admin');
    await submit(page);

    http.expectOne('/api/auth/login/').flush(session({ ...SELLER, must_change_password: true }));
    await vi.waitFor(() => expect(url()).toBe('/change-password'));
    // The change-password page sits in the same frame.
    await answer(http, '/api/company/brand/', BRAND);
  });
});
