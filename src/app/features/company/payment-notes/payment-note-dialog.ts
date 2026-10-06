// v1.0.0 — add, change or delete a payment note. Closes with 'saved' or
// 'deleted'; Cancel closes with nothing.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { PaymentNote } from '../../../api/models/payment-note';
import { CompanyService } from '../../../api/services/company.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { ImageChoice, ImageField, KEEP } from '../../../shared/image-field/image-field';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';

export interface PaymentNoteData {
  /** The note to change, or null for a new one. */
  readonly note: PaymentNote | null;
  /** Row order for a new note: after the last one. */
  readonly nextOrder: number;
}

export type PaymentNoteResult = 'saved' | 'deleted';

@Component({
  selector: 'app-payment-note-dialog',
  imports: [ReactiveFormsModule, ImageField],
  templateUrl: './payment-note-dialog.html',
})
export class PaymentNoteDialog {
  private readonly api = inject(CompanyService);
  private readonly modal = inject(Modal);
  protected readonly data = inject<PaymentNoteData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<PaymentNoteResult>>(DialogRef);
  protected readonly note = this.data.note;

  protected readonly form = inject(NonNullableFormBuilder).group({
    payment_type: [this.note?.payment_type ?? '', [Validators.required, Validators.maxLength(150)]],
    payment_info: [this.note?.payment_info ?? ''],
    row_order: [this.note?.row_order ?? this.data.nextOrder, Validators.required],
    is_active: [this.note?.is_active ?? true],
  });
  protected readonly image = signal<ImageChoice>(KEEP);
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
  }

  protected pickImage(choice: ImageChoice): void {
    this.image.set(choice);
    dropFieldError(this.fieldErrors, 'image');
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue();
    const image = this.image();
    const note = this.note;
    // A file has to go as multipart; taking the image away is a plain null.
    let request: Observable<PaymentNote>;
    if (!note) {
      request =
        image.kind === 'replace'
          ? this.api.companyPaymentNotesCreate$FormData({ body: { ...body, image: image.file } })
          : this.api.companyPaymentNotesCreate$Json({ body });
    } else if (image.kind === 'replace') {
      request = this.api.companyPaymentNotesPartialUpdate$FormData({
        id: note.id,
        body: { ...body, image: image.file },
      });
    } else {
      request = this.api.companyPaymentNotesPartialUpdate$Json({
        id: note.id,
        body: image.kind === 'remove' ? { ...body, image: null } : body,
      });
    }
    this.send(request, 'saved');
  }

  protected delete(): void {
    const note = this.note;
    if (!note || this.busy()) return;
    confirm(this.modal, {
      title: `Delete ${note.payment_type}?`,
      message:
        'It comes off new invoices straight away; invoices already printed are unaffected. ' +
        'To stop printing it but keep it, untick "Show on new invoices" instead.',
      confirmLabel: 'Delete note',
      danger: true,
    }).closed.subscribe((confirmed) => {
      if (confirmed) this.send(this.api.companyPaymentNotesDestroy({ id: note.id }), 'deleted');
    });
  }

  private send(request: Observable<unknown>, result: PaymentNoteResult): void {
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    request.subscribe({
      next: () => this.ref.close(result),
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.formErrors.set(form);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }
}
