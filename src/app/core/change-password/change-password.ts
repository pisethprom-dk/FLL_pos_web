// v1.2.0 — change your own password, in the Workbench frame (core/auth-frame).
// A new account, or one an Admin has reset, lands here first and cannot leave
// until it has chosen one (passwordChangedGuard). The backend does not enforce
// that yet; this page does.
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { readApiErrors } from '../../shared/api-errors';
import { PasswordField } from '../../shared/password-field/password-field';
import { clearOnEdit } from '../../shared/server-errors';
import { AuthFrame } from '../auth-frame/auth-frame';
import { safeReturnUrl } from '../session/guards';
import { SessionStore } from '../session/session-store';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, AuthFrame, PasswordField],
  templateUrl: './change-password.html',
})
export class ChangePassword {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly returnUrl = safeReturnUrl(
    inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'),
  );

  protected readonly form = inject(NonNullableFormBuilder).group({
    current_password: ['', Validators.required],
    new_password: ['', Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  /** True until the user has chosen their own password: no way out but signing out. */
  protected readonly forced = this.session.mustChangePassword;

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected submit(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    const { current_password, new_password } = this.form.getRawValue();
    this.session.changePassword(current_password, new_password).subscribe({
      next: () => void this.router.navigateByUrl(this.returnUrl),
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.formErrors.set(form);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }

  protected cancel(): void {
    void this.router.navigateByUrl(this.returnUrl);
  }

  protected signOut(): void {
    void this.session.logout();
  }
}
