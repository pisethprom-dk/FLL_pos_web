// v2.0.0 — the sign-in page, in the Workbench frame (core/auth-frame).
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { readApiErrors } from '../../shared/api-errors';
import { PasswordField } from '../../shared/password-field/password-field';
import { AuthFrame } from '../auth-frame/auth-frame';
import { safeReturnUrl } from '../session/guards';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, AuthFrame, PasswordField],
  templateUrl: './login.html',
})
export class Login {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  /** Sent here because the session ran out, not because the user signed out. */
  protected readonly expired = this.query.get('reason') === 'expired';

  protected submit(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    const { username, password } = this.form.getRawValue();
    this.session.login(username, password).subscribe({
      // A new account is turned to the change-password page by the shell's guard.
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.query.get('returnUrl'))),
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.errors.set([...form, ...Object.values(fields).flat()]);
        this.busy.set(false);
      },
    });
  }
}
