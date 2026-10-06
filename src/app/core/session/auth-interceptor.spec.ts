// v1.0.0
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import { SessionStore } from './session-store';
import { SELLER, UNAUTHORIZED, session, settle, signIn } from './session-testing';

describe('authInterceptor', () => {
  let store: SessionStore;
  let http: HttpTestingController;
  let client: HttpClient;
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
    client = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    signIn(store, http, SELLER, 'A1');
  });

  afterEach(() => http.verify());

  it('adds the access token to API calls', () => {
    client.get('/api/catalogue/products/').subscribe();
    const req = http.expectOne('/api/catalogue/products/');
    expect(req.request.headers.get('Authorization')).toBe('Bearer A1');
  });

  it('leaves the cookie endpoints and non-API URLs alone', () => {
    client.post('/api/auth/logout/', null).subscribe();
    expect(http.expectOne('/api/auth/logout/').request.headers.has('Authorization')).toBe(false);

    client.get('/media/logo.png').subscribe();
    expect(http.expectOne('/media/logo.png').request.headers.has('Authorization')).toBe(false);
  });

  it('on a 401 refreshes once and retries with the new token', async () => {
    let body: unknown;
    client.get('/api/partners/customers/').subscribe((b) => (body = b));
    http.expectOne('/api/partners/customers/').flush(null, UNAUTHORIZED);
    await settle();

    const refresh = http.expectOne('/api/auth/refresh/');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(session(SELLER, 'A2'));
    await settle();

    const retry = http.expectOne('/api/partners/customers/');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer A2');
    retry.flush({ results: [] });
    expect(body).toEqual({ results: [] });
  });

  it('shares one refresh between calls that fail together', async () => {
    const urls = ['/api/a/', '/api/b/', '/api/c/'];
    for (const url of urls) client.get(url).subscribe();
    for (const url of urls) http.expectOne(url).flush(null, UNAUTHORIZED);
    await settle();

    http.expectOne('/api/auth/refresh/').flush(session(SELLER, 'A2'));
    await settle();

    for (const url of urls) {
      const retry = http.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer A2');
      retry.flush({});
    }
  });

  it('when the refresh fails too, ends the session and sends the user to sign-in', async () => {
    let failure: HttpErrorResponse | undefined;
    client.get('/api/x/').subscribe({ error: (e: HttpErrorResponse) => (failure = e) });
    http.expectOne('/api/x/').flush(null, UNAUTHORIZED);
    await settle();
    http.expectOne('/api/auth/refresh/').flush({ detail: 'Token is blacklisted' }, UNAUTHORIZED);
    await settle();

    expect(failure?.status).toBe(401);
    expect(store.isSignedIn()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { reason: 'expired', returnUrl: '/' },
    });
  });

  it('refreshes only once for one call: a second 401 is final', async () => {
    let failure: HttpErrorResponse | undefined;
    client.get('/api/x/').subscribe({ error: (e: HttpErrorResponse) => (failure = e) });
    http.expectOne('/api/x/').flush(null, UNAUTHORIZED);
    await settle();
    http.expectOne('/api/auth/refresh/').flush(session(SELLER, 'A2'));
    await settle();
    http.expectOne('/api/x/').flush(null, UNAUTHORIZED);
    await settle();

    expect(failure?.status).toBe(401);
    // http.verify() in afterEach: no second refresh went out.
  });

  it('passes a 403 straight to the caller', () => {
    let failure: HttpErrorResponse | undefined;
    client.get('/api/users/').subscribe({ error: (e: HttpErrorResponse) => (failure = e) });
    http
      .expectOne('/api/users/')
      .flush({ detail: 'Only an Admin may do this.' }, { status: 403, statusText: 'Forbidden' });

    expect(failure?.status).toBe(403);
    expect(store.isSignedIn()).toBe(true);
  });
});
