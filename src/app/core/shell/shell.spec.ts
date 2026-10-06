// v1.6.0
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { authInterceptor } from '../session/auth-interceptor';
import { SessionStore } from '../session/session-store';
import {
  ADMIN,
  BRAND,
  SELLER,
  SHOP_PROFILE,
  answer,
  answerShell,
  signIn,
} from '../session/session-testing';
import { PageTitle } from './page-title';

describe('Shell', () => {
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

  async function open(url = '/'): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create(url);
    answerShell(http);
    await harness.fixture.whenStable();
    return harness.fixture.nativeElement as HTMLElement;
  }

  const texts = (root: HTMLElement, selector: string) =>
    Array.from(root.querySelectorAll(selector), (el) => el.textContent!.trim());

  const menu = (root: HTMLElement) =>
    texts(root, '.nav a, .nav .soon, .nav button.grp').map((t) => t.replace(/\s*▾$/, ''));

  it('shows a Seller only the screens their scopes open', async () => {
    signIn(store, http, SELLER);
    const page = await open();

    expect(texts(page, '.nav h4')).toEqual(['Operations', 'Reports', 'Setup']);
    expect(menu(page)).toEqual([
      'Dashboard',
      'Sell',
      'Quotations',
      'Customer payment',
      'Returns & voids',
      'Warranty claims',
      'Daily sales',
      'Stock on hand',
      'Catalogue',
      'Products',
      'Categories',
      'Brands',
      'Units',
      'Customers',
      'Suppliers',
      'Supplier products',
    ]);
  });

  it('shows an Admin every screen, Users included', async () => {
    signIn(store, http, ADMIN);
    const page = await open();

    expect(menu(page)).toEqual([
      'Dashboard',
      'Sell',
      'Quotations',
      'Customer payment',
      'Returns & voids',
      'Warranty claims',
      'Stock',
      'Stock in',
      'Adjustments',
      'Stock count',
      'Daily sales',
      'Stock on hand',
      'Receivables',
      'Catalogue',
      'Products',
      'Categories',
      'Brands',
      'Units',
      'Customers',
      'Suppliers',
      'Supplier products',
      'Company',
      'Profile',
      'Exchange rate',
      'Payment notes',
      'Rules & numbering',
      'Users',
    ]);
  });

  it('links the screens that are built and greys out the rest', async () => {
    signIn(store, http, SELLER);
    const page = await open();

    const dashboard = page.querySelector<HTMLAnchorElement>('.nav a')!;
    expect(dashboard.textContent!.trim()).toBe('Dashboard');
    expect(dashboard.getAttribute('href')).toBe('/');
    expect(dashboard.getAttribute('aria-current')).toBe('page');
    // A Seller opens the dashboard, the catalogue and the partners; the rest are greyed.
    expect(texts(page, '.nav a')).toEqual([
      'Dashboard',
      'Products',
      'Categories',
      'Brands',
      'Units',
      'Customers',
      'Suppliers',
      'Supplier products',
    ]);
    expect(page.querySelector('.nav .soon')!.getAttribute('aria-disabled')).toBe('true');
  });

  it("shows the shop, the user, the page title and today's rate", async () => {
    signIn(store, http, SELLER);
    const page = await open();

    expect(page.querySelector('.brand b')!.textContent).toBe('Sok Heng Mart');
    // The profile has an address, but the sidebar shows the name only.
    expect(page.querySelector('.brand')!.textContent).not.toContain('Street 315');
    expect(page.querySelector('.side-foot')!.textContent).toContain('Sokha Chan');
    expect(page.querySelector('.side-foot')!.textContent).toContain('Seller');
    expect(page.querySelector('.top h1')!.textContent).toBe('Dashboard');
    expect(texts(page, '.chip')[0].replace(/\s+/g, ' ')).toBe('Rate today ៛4,100 / USD');
  });

  it("puts the shop's logo beside its name in the sidebar", async () => {
    signIn(store, http, SELLER);
    const created = RouterTestingHarness.create('/');
    await answer(http, '/api/company/profile/', {
      ...SHOP_PROFILE,
      logo: '/media/company/fll-logo.jpg',
    });
    harness = await created;
    answerShell(http);
    await harness.fixture.whenStable();
    const page = harness.fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.brand img')!.getAttribute('src')).toBe(
      '/media/company/fll-logo.jpg',
    );
    expect(page.querySelector('.brand b')!.textContent).toBe('Sok Heng Mart');
  });

  it('folds a group away and back', async () => {
    signIn(store, http, SELLER);
    const page = await open();
    const catalogue = page.querySelector<HTMLButtonElement>('.nav button.grp')!;
    const group = page.querySelector<HTMLElement>('#grp-catalogue')!;

    expect(catalogue.getAttribute('aria-expanded')).toBe('true');
    catalogue.click();
    await harness.fixture.whenStable();
    expect(catalogue.getAttribute('aria-expanded')).toBe('false');
    expect(group.hidden).toBe(true);

    catalogue.click();
    await harness.fixture.whenStable();
    expect(group.hidden).toBe(false);
  });

  it('sends a screen the role does not open to the not-allowed page', async () => {
    signIn(store, http, SELLER);
    const page = await open('/not-allowed');

    expect(page.querySelector('.top h1')!.textContent).toBe('Not available');
    expect(page.querySelector('.placeholder')!.textContent).toContain('Not available to your role');
  });

  it('signs out from the footer', async () => {
    signIn(store, http, SELLER);
    const page = await open();

    const signOut = Array.from(page.querySelectorAll<HTMLButtonElement>('.foot-links button')).find(
      (b) => b.textContent!.trim() === 'Sign out',
    )!;
    signOut.click();
    http.expectOne('/api/auth/logout/').flush({ detail: 'Signed out.' });
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login'));
    expect(store.isSignedIn()).toBe(false);
    // The sign-in page asks for the shop's name.
    await answer(http, '/api/company/brand/', BRAND);
  });
});
