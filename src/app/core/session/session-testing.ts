// v1.2.0 — for specs: the two roles as /api/auth/ returns them (scopes copied
// from the backend's users/scopes.py), and a way to sign one in.
import { HttpTestingController } from '@angular/common/http/testing';
import { CompanyBrand } from '../../api/models/company-brand';
import { CompanyProfile } from '../../api/models/company-profile';
import { CurrentRate } from '../../api/models/current-rate';
import { Me } from '../../api/models/me';
import { Session } from '../../api/models/session';
import { SessionStore } from './session-store';

export const SELLER: Me = {
  id: 2,
  username: 'sokha',
  full_name: 'Sokha Chan',
  role: 'SELLER',
  must_change_password: false,
  scopes: [
    'sell',
    'quotation.view',
    'quotation.edit',
    'payment.view',
    'payment.record',
    'return.view',
    'return.create',
    'invoice.void.own',
    'warranty.view',
    'warranty.edit',
    'catalogue.view',
    'partner.view',
    'report.sales.own',
    'report.stock',
  ],
};

export const ADMIN: Me = {
  id: 1,
  username: 'bopha',
  full_name: 'Bopha Ly',
  role: 'ADMIN',
  must_change_password: false,
  scopes: [
    'sell',
    'quotation.view',
    'quotation.edit',
    'payment.view',
    'payment.record',
    'return.view',
    'return.create',
    'invoice.void.any',
    'warranty.view',
    'warranty.edit',
    'stock.view',
    'stock.post',
    'catalogue.view',
    'catalogue.edit',
    'partner.view',
    'partner.edit',
    'company.view',
    'company.edit',
    'user.manage',
    'report.sales.all',
    'report.stock',
    'report.receivables',
    'cost.view',
  ],
};

export const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

export function session(user: Me, access = 'access-1'): Session {
  return { access, user };
}

/** Signs `user` in through the real login call. */
export function signIn(
  store: SessionStore,
  http: HttpTestingController,
  user: Me,
  access = 'access-1',
): void {
  store.login(user.username, 'secret').subscribe();
  http.expectOne('/api/auth/login/').flush(session(user, access));
}

export const SHOP_PROFILE: CompanyProfile = {
  id: 1,
  name: 'Sok Heng Mart',
  address: 'Street 315, Toul Kork, Phnom Penh',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

/** What the sign-in page shows before anyone signs in. */
export const BRAND: CompanyBrand = {
  name: 'FLL',
  name_kh: 'ហាងលក់ឧបករណ៍ជាង',
  address: 'Street 315, Toul Kork, Phnom Penh',
  logo: null,
};

export const TODAY_RATE: CurrentRate = {
  base_currency: 'USD',
  effective_date: '2026-09-01',
  rate: '4100.000000',
  decimals: { USD: 2, KHR: 0 },
  rounding_step: { USD: '0.01', KHR: '100' },
  symbol: { USD: '$', KHR: '៛' },
  notes: {},
};

/** Answers the two calls the shell makes when it opens, if they have been made. */
export function answerShell(http: HttpTestingController): void {
  for (const req of http.match('/api/company/profile/')) req.flush(SHOP_PROFILE);
  for (const req of http.match('/api/company/rate/')) req.flush(TODAY_RATE);
}

/**
 * Answers calls to `url` with `body` as they arrive, until `count` have been
 * answered. Screens load through Angular resources, which hold the page "busy"
 * until answered — so answer first, then wait for the page to settle.
 */
export async function answer(
  http: HttpTestingController,
  url: string,
  body: object | null,
  options: { count?: number; status?: number; statusText?: string } = {},
): Promise<void> {
  const { count = 1, status, statusText = '' } = options;
  const init = status ? { status, statusText } : undefined;
  let answered = 0;
  for (let tries = 0; tries < 200 && answered < count; tries++) {
    for (const req of http.match((r) => r.url === url)) {
      req.flush(body, init);
      answered++;
    }
    if (answered < count) await new Promise((resolve) => setTimeout(resolve, 5));
  }
  if (answered < count) throw new Error(`Expected ${count} call(s) to ${url}, got ${answered}`);
}

/** Lets queued promises run — the refresh goes through one. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
