// v1.2.0
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { authInterceptor } from '../session/auth-interceptor';
import { SessionStore } from '../session/session-store';
import { BRAND, SELLER, answer, answerShell, signIn } from '../session/session-testing';
import { PageTitle } from '../shell/page-title';

describe('ChangePassword', () => {
  let store: SessionStore;
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageTitle },
      ],
    });
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Opens `url` and answers the frame's call for the shop's name. */
  async function open(url: string): Promise<HTMLElement> {
    const created = RouterTestingHarness.create(url);
    await answer(http, '/api/company/brand/', BRAND);
    harness = await created;
    await harness.fixture.whenStable();
    return harness.fixture.nativeElement as HTMLElement;
  }

  function type(page: HTMLElement, id: string, value: string): void {
    const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const buttons = (page: HTMLElement) =>
    Array.from(page.querySelectorAll('.signin-actions button'), (b) => b.textContent!.trim());

  const url = () => TestBed.inject(Router).url;

  it('holds a new account here, with signing out the only other way', async () => {
    signIn(store, http, { ...SELLER, must_change_password: true });
    const page = await open('/not-allowed');

    expect(url()).toBe('/change-password?returnUrl=%2Fnot-allowed');
    expect(page.querySelector('.note')!.textContent).toContain('needs a new password');
    expect(buttons(page)).toEqual(['Change password', 'Sign out']);
  });

  it('changes the password, then carries on to where the user was going', async () => {
    signIn(store, http, { ...SELLER, must_change_password: true });
    const page = await open('/not-allowed');
    type(page, 'current-password', 'given-by-admin');
    type(page, 'new-password', 'a-better-one-2026');
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    const change = http.expectOne('/api/auth/password/');
    expect(change.request.body).toEqual({
      current_password: 'given-by-admin',
      new_password: 'a-better-one-2026',
    });
    change.flush({ detail: 'Password changed.' });
    http.expectOne('/api/auth/me/').flush({ ...SELLER, must_change_password: false });

    await vi.waitFor(() => expect(url()).toBe('/not-allowed'));
    answerShell(http);
  });

  it("shows the server's reasons beside the field they are about", async () => {
    signIn(store, http, { ...SELLER, must_change_password: true });
    const page = await open('/change-password');
    type(page, 'current-password', 'given-by-admin');
    type(page, 'new-password', 'short');
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    http.expectOne('/api/auth/password/').flush(
      {
        new_password: [
          'This password is too short. It must contain at least 8 characters.',
          'This password is too common.',
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();

    const field = page.querySelector('#new-password')!.closest('.field')!;
    expect(Array.from(field.querySelectorAll('.hint.warn'), (el) => el.textContent)).toEqual([
      'This password is too short. It must contain at least 8 characters.',
      'This password is too common.',
    ]);
    expect(store.mustChangePassword()).toBe(true);

    // Typing a new one takes the old reasons away.
    type(page, 'new-password', 'a-much-longer-one-2026');
    await harness.fixture.whenStable();
    expect(field.querySelectorAll('.hint.warn').length).toBe(0);
  });

  it('offers Cancel when the change is the user’s own idea', async () => {
    signIn(store, http, SELLER);
    const page = await open('/change-password');

    expect(page.querySelector('.note')).toBeNull();
    expect(buttons(page)).toEqual(['Change password', 'Cancel']);

    page.querySelector<HTMLButtonElement>('.signin-actions .btn.ghost')!.click();
    await vi.waitFor(() => expect(url()).toBe('/'));
    answerShell(http);
  });
});
