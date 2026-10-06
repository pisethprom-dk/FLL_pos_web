// v1.0.0 — puts the access token on API calls. On a 401 it refreshes once and
// retries; if the refresh fails too, the session is over and the user goes
// back to sign-in.
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../api/services/auth.service';
import { SessionStore } from './session-store';

/** These run on the refresh cookie, not the access token. */
const COOKIE_PATHS: readonly string[] = [
  AuthService.AuthLoginCreatePath,
  AuthService.AuthRefreshCreatePath,
  AuthService.AuthLogoutCreatePath,
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || COOKIE_PATHS.includes(req.url)) return next(req);

  const session = inject(SessionStore);
  const router = inject(Router);

  return next(withToken(req, session.token())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return session.refresh().pipe(
        catchError(() => {
          session.expire(router.url);
          return throwError(() => error);
        }),
        // The retry goes straight on down the chain: a second 401 is final.
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};

function withToken<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
