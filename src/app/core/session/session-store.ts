// v1.0.0 — who is signed in, what they may do, and the access token, all held
// in memory only.
//
// The refresh token never reaches this code: the backend keeps it in an
// httpOnly cookie on /api/auth/ and rotates it on every use. Each one works
// once, so two refreshes must never run at the same time — not in this tab
// (callers share one request) and not across tabs (a browser lock).
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  defer,
  finalize,
  firstValueFrom,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { Me } from '../../api/models/me';
import { Session } from '../../api/models/session';
import { AuthService } from '../../api/services/auth.service';

const REFRESH_LOCK = 'pos-auth-refresh';
const CHANNEL = 'pos-session';
const SIGNED_OUT = 'signed-out';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly access = signal<string | null>(null);
  private readonly me = signal<Me | null>(null);
  private readonly held = computed(() => new Set(this.me()?.scopes ?? []));
  private refreshing: Observable<string> | null = null;
  private readonly channel = openChannel();

  /** The signed-in user, or null. */
  readonly user = this.me.asReadonly();
  readonly isSignedIn = computed(() => this.me() !== null);
  /** A new account, or one an Admin has reset, must choose its own password first. */
  readonly mustChangePassword = computed(() => this.me()?.must_change_password === true);

  constructor() {
    if (this.channel) {
      // Signing out in another tab spent the shared cookie; this tab is done too.
      this.channel.onmessage = (event: MessageEvent) => {
        if (event.data !== SIGNED_OUT) return;
        this.clear();
        void this.router.navigateByUrl('/login');
      };
      const channel = this.channel;
      inject(DestroyRef).onDestroy(() => channel.close());
    }
  }

  /** The access token for the Authorization header. */
  token(): string | null {
    return this.access();
  }

  /** True when the user holds at least one of `scopes`. An empty list asks for nothing. */
  hasAnyScope(scopes: readonly string[]): boolean {
    if (scopes.length === 0) return true;
    const held = this.held();
    return scopes.some((scope) => held.has(scope));
  }

  login(username: string, password: string): Observable<Me> {
    return this.auth.authLoginCreate$Json({ body: { username, password } }).pipe(
      tap((session) => this.start(session)),
      map((session) => session.user),
    );
  }

  /** Before the first screen: a live refresh cookie signs the user straight back in. */
  restore(): Promise<void> {
    return firstValueFrom(
      this.refresh().pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
      ),
    );
  }

  /** A new access token from the refresh cookie. Callers that arrive while one
   *  is on its way share it. Errors when the cookie is missing or spent. */
  refresh(): Observable<string> {
    this.refreshing ??= defer(() =>
      from(withLock(REFRESH_LOCK, () => firstValueFrom(this.auth.authRefreshCreate()))),
    ).pipe(
      tap((session) => this.start(session)),
      map((session) => session.access),
      finalize(() => (this.refreshing = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshing;
  }

  changePassword(currentPassword: string, newPassword: string): Observable<Me> {
    return this.auth
      .authPasswordCreate$Json({
        body: { current_password: currentPassword, new_password: newPassword },
      })
      .pipe(
        switchMap(() => this.auth.authMeRetrieve()),
        tap((me) => this.me.set(me)),
      );
  }

  /** Signs out here and in every other open tab. */
  async logout(): Promise<void> {
    await firstValueFrom(this.auth.authLogoutCreate().pipe(catchError(() => of(null))));
    this.clear();
    this.channel?.postMessage(SIGNED_OUT);
    await this.router.navigateByUrl('/login');
  }

  /** The refresh cookie is gone or spent: back to sign-in, then on to `returnUrl`. */
  expire(returnUrl: string): void {
    if (!this.isSignedIn()) return;
    this.clear();
    void this.router.navigate(['/login'], { queryParams: { reason: 'expired', returnUrl } });
  }

  private start(session: Session): void {
    this.access.set(session.access);
    this.me.set(session.user);
  }

  private clear(): void {
    this.access.set(null);
    this.me.set(null);
  }
}

/** Runs `task` holding a lock shared by every tab of this origin, so tabs take turns. */
function withLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request(name, task) : task();
}

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
}
