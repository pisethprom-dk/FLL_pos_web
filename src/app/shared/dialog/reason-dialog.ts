// v1.0.0 — asks for a reason before an action the server records with one:
// rejecting a quotation now, voiding an invoice or a payment later. The
// dialog sends the action itself, shows a refusal in the server's words, and
// closes with what the server returned.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { readApiErrors } from '../api-errors';
import { Modal } from './modal';

export interface ReasonData<T> {
  readonly title: string;
  /** What the action does, in a sentence or two. */
  readonly message: string;
  readonly label: string;
  readonly placeholder?: string;
  /** The button that goes ahead, e.g. "Reject quotation". */
  readonly confirmLabel: string;
  readonly send: (reason: string) => Observable<T>;
}

@Component({
  selector: 'app-reason-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './reason-dialog.html',
})
export class ReasonDialog<T> {
  protected readonly data = inject<ReasonData<T>>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<T>>(DialogRef);
  protected readonly reason = inject(NonNullableFormBuilder).control('', [
    Validators.required,
    Validators.pattern(/\S/),
  ]);
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);

  protected go(): void {
    if (this.busy()) return;
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    this.data.send(this.reason.value.trim()).subscribe({
      next: (result) => this.ref.close(result),
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.errors.set([...form, ...Object.values(fields).flat()]);
        this.busy.set(false);
      },
    });
  }
}

/** Opens the dialog; it closes with the server's answer once the action is done. */
export function askReason<T>(modal: Modal, data: ReasonData<T>): DialogRef<T, ReasonDialog<T>> {
  return modal.open<T, ReasonData<T>, ReasonDialog<T>>(ReasonDialog, {
    data,
    labelledBy: 'reason-title',
  });
}
