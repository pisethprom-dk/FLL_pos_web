// v1.0.0
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Data,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import {
  passwordChangedGuard,
  safeReturnUrl,
  scopeGuard,
  signedInGuard,
  signedOutGuard,
} from './guards';
import { SessionStore } from './session-store';
import { SELLER, signIn } from './session-testing';

describe('guards', () => {
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
  });

  /** Runs a guard; a redirect comes back as the URL it redirects to. */
  function run(guard: CanActivateFn, url = '/sell', data: Data = {}): unknown {
    const result = TestBed.runInInjectionContext(() =>
      guard({ data } as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return result instanceof UrlTree ? router.serializeUrl(result) : result;
  }

  it('signedInGuard sends a signed-out user to sign-in, with a way back', () => {
    expect(run(signedInGuard, '/catalogue/products')).toBe(
      '/login?returnUrl=%2Fcatalogue%2Fproducts',
    );
    expect(run(signedInGuard, '/')).toBe('/login');

    signIn(store, http, SELLER);
    expect(run(signedInGuard)).toBe(true);
  });

  it('signedOutGuard sends a signed-in user home', () => {
    expect(run(signedOutGuard)).toBe(true);
    signIn(store, http, SELLER);
    expect(run(signedOutGuard)).toBe('/');
  });

  it('passwordChangedGuard holds a new account on the change-password page', () => {
    signIn(store, http, { ...SELLER, must_change_password: true });
    expect(run(passwordChangedGuard, '/sell')).toBe('/change-password?returnUrl=%2Fsell');
  });

  it('passwordChangedGuard lets everyone else through', () => {
    signIn(store, http, SELLER);
    expect(run(passwordChangedGuard)).toBe(true);
  });

  it("scopeGuard needs one of the route's scopes", () => {
    signIn(store, http, SELLER);
    expect(run(scopeGuard, '/stock/in', { scopes: ['stock.view'] })).toBe('/not-allowed');
    expect(
      run(scopeGuard, '/reports/daily-sales', { scopes: ['report.sales.all', 'report.sales.own'] }),
    ).toBe(true);
    expect(run(scopeGuard, '/', { scopes: [] })).toBe(true);
  });

  it('safeReturnUrl keeps the user inside the app', () => {
    expect(safeReturnUrl('/sell?tab=held')).toBe('/sell?tab=held');
    expect(safeReturnUrl('//elsewhere.example')).toBe('/');
    expect(safeReturnUrl('/\\elsewhere.example')).toBe('/');
    expect(safeReturnUrl('https://elsewhere.example')).toBe('/');
    expect(safeReturnUrl(null)).toBe('/');
  });
});
