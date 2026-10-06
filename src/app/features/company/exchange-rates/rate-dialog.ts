// v1.0.0 — set a new exchange rate, or change one no sale has used yet.
// Closes with the saved rate.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExchangeRate } from '../../../api/models/exchange-rate';
import { CompanyService } from '../../../api/services/company.service';
import { readApiErrors } from '../../../shared/api-errors';
import { today } from '../../../shared/dates';
import { clearOnEdit } from '../../../shared/server-errors';

export interface RateDialogData {
  /** The rate to change, or null for a new one. */
  readonly rate: ExchangeRate | null;
}

/** Above zero, at most six decimals — what the backend stores. */
const RATE = /^(?=.*[1-9])\d{1,12}(\.\d{1,6})?$/;

@Component({
  selector: 'app-rate-dialog',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './rate-dialog.html',
})
export class RateDialog {
  private readonly api = inject(CompanyService);
  protected readonly data = inject<RateDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ExchangeRate>>(DialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    effective_date: [this.data.rate?.effective_date ?? today(), Validators.required],
    rate: [plain(this.data.rate?.rate ?? ''), [Validators.required, Validators.pattern(RATE)]],
    note: [this.data.rate?.note ?? '', Validators.maxLength(250)],
  });
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
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
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    const body = this.form.getRawValue();
    const editing = this.data.rate;
    const request = editing
      ? this.api.companyExchangeRatesPartialUpdate$Json({ id: editing.id, body })
      : this.api.companyExchangeRatesCreate$Json({ body });
    request.subscribe({
      next: (saved) => this.ref.close(saved),
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.formErrors.set(form);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }
}

/** "4100.000000" → "4100", for typing over. */
function plain(rate: string): string {
  return rate.includes('.') ? rate.replace(/\.?0+$/, '') : rate;
}
