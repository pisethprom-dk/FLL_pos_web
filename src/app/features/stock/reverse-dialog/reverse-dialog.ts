// v1.0.0 — reversing a posted stock document. The backend posts a document of
// the same type that replays every movement with its sign turned, and needs a
// reason. Not in the mockup.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { readApiErrors } from '../../../shared/api-errors';
import { Modal } from '../../../shared/dialog/modal';

export interface ReverseData<T> {
  /** The document being reversed, e.g. "GRN-000312". */
  readonly number: string;
  /** What reversing this one does, in a sentence or two. */
  readonly effect: string;
  readonly send: (note: string) => Observable<T>;
}

@Component({
  selector: 'app-reverse-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './reverse-dialog.html',
})
export class ReverseDialog<T> {
  protected readonly data = inject<ReverseData<T>>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<T>>(DialogRef);
  protected readonly note = inject(NonNullableFormBuilder).control('', [
    Validators.required,
    Validators.pattern(/\S/),
  ]);
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);

  protected reverse(): void {
    if (this.busy()) return;
    if (this.note.invalid) {
      this.note.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.errors.set([]);
    this.data.send(this.note.value.trim()).subscribe({
      next: (reversal) => this.ref.close(reversal),
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.errors.set([...form, ...Object.values(fields).flat()]);
        this.busy.set(false);
      },
    });
  }
}

/** Opens the dialog; it closes with the reversing document once posted. */
export function reverseDialog<T>(
  modal: Modal,
  data: ReverseData<T>,
): DialogRef<T, ReverseDialog<T>> {
  return modal.open<T, ReverseData<T>, ReverseDialog<T>>(ReverseDialog, {
    data,
    labelledBy: 'reverse-title',
  });
}
