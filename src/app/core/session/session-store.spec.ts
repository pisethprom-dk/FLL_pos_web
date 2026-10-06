// v1.0.0
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Me } from '../../api/models/me';
import { authInterceptor } from './auth-interceptor';
import { SessionStore } from './session-store';
import { ADMIN, SELLER, UNAUTHORIZED, session, settle, signIn } from './session-testing';

describe('SessionStore', () => {
  let store: SessionStore;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('signs in with the login call and holds the user and token', () => {
    let user: Me | undefined;
    store.login('sokha', 'secret').subscribe((u) => (user = u));

    const req = http.expectOne('/api/auth/login/');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'sokha', password: 'secret' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(session(SELLER, 'A1'));

    expect(user).toEqual(SELLER);
    expect(store.isSignedIn()).toBe(true);
    expect(store.token()).toBe('A1');
  });

  it("answers scope questions from the user's scope list", () => {
    signIn(store, http, SELLER);
    expect(store.hasAnyScope(['sell'])).toBe(true);
    expect(store.hasAnyScope(['stock.view'])).toBe(false);
    expect(store.hasAnyScope(['report.sales.all', 'report.sales.own'])).toBe(true);
    expect(store.hasAnyScope([])).toBe(true);
  });

  it('restores a session from the refresh cookie', async () => {
    const restored = store.restore();
    await settle();
    http.expectOne('/api/auth/refresh/').flush(session(ADMIN, 'A2'));
    await restored;

    expect(store.user()).toEqual(ADMIN);
    expect(store.token()).toBe('A2');
  });

  it('stays signed out when there is no live cookie', async () => {
    const restored = store.restore();
    await settle();
    http.expectOne('/api/auth/refresh/').flush({ detail: 'Not signed in.' }, UNAUTHORIZED);
    await restored;

    expect(store.isSignedIn()).toBe(false);
  });

  it('sends one refresh however many callers ask at once', async () => {
    const tokens: string[] = [];
    store.refresh().subscribe((token) => tokens.push(token));
    store.refresh().subscribe((token) => tokens.push(token));
    await settle();
    http.expectOne('/api/auth/refresh/').flush(session(SELLER, 'A3'));
    await settle();

    expect(tokens).toEqual(['A3', 'A3']);
  });

  it('signs out on the server, clears the session and goes to sign-in', async () => {
    signIn(store, http, SELLER);
    const done = store.logout();
    http.expectOne('/api/auth/logout/').flush({ detail: 'Signed out.' });
    await done;

    expect(store.isSignedIn()).toBe(false);
    expect(store.token()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('signs out here even when the server cannot be reached', async () => {
    signIn(store, http, SELLER);
    const done = store.logout();
    http.expectOne('/api/auth/logout/').error(new ProgressEvent('error'));
    await done;

    expect(store.isSignedIn()).toBe(false);
  });

  it.runIf(typeof BroadcastChannel !== 'undefined')('signs out when another tab does', async () => {
    signIn(store, http, SELLER);
    const otherTab = new BroadcastChannel('pos-session');
    otherTab.postMessage('signed-out');
    await vi.waitFor(() => expect(store.isSignedIn()).toBe(false));
    otherTab.close();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('changes the password, then re-reads the user', () => {
    signIn(store, http, { ...SELLER, must_change_password: true });
    expect(store.mustChangePassword()).toBe(true);

    store.changePassword('old-one', 'new-secret-1').subscribe();
    const change = http.expectOne('/api/auth/password/');
    expect(change.request.body).toEqual({
      current_password: 'old-one',
      new_password: 'new-secret-1',
    });
    expect(change.request.headers.get('Authorization')).toBe('Bearer access-1');
    change.flush({ detail: 'Password changed.' });
    http.expectOne('/api/auth/me/').flush({ ...SELLER, must_change_password: false });

    expect(store.mustChangePassword()).toBe(false);
  });

  it('on expiry clears the session and sends the user to sign-in with a way back', () => {
    signIn(store, http, SELLER);
    store.expire('/catalogue/products');

    expect(store.isSignedIn()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'expired', returnUrl: '/catalogue/products' },
    });
  });
});
