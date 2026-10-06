// v1.0.0 — route guards. They decide what the screen offers; the backend still
// checks every call.
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from './session-store';

/** Signed in, or off to sign-in with a way back. */
export const signedInGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return session.isSignedIn() || router.createUrlTree(['/login'], withReturn(state.url));
};

/** The sign-in page is only for someone signed out. */
export const signedOutGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return !session.isSignedIn() || router.createUrlTree(['/']);
};

/** Until the user has chosen their own password, that is the only page they get. */
export const passwordChangedGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return (
    !session.mustChangePassword() ||
    router.createUrlTree(['/change-password'], withReturn(state.url))
  );
};

/** The route's `data.scopes`: the user needs at least one of them. */
export const scopeGuard: CanActivateFn = (route) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const scopes = (route.data['scopes'] as readonly string[] | undefined) ?? [];
  return session.hasAnyScope(scopes) || router.createUrlTree(['/not-allowed']);
};

/** A `returnUrl` from the address bar, if it stays inside the app; otherwise home. */
export function safeReturnUrl(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/';
}

function withReturn(url: string) {
  return url === '/' ? {} : { queryParams: { returnUrl: url } };
}
