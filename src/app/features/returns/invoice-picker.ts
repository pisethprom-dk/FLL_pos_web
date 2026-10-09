// v1.0.0 — "Choose an invoice", for a return or a void: completed invoices,
// newest first, found by number or walk-in name. A Seller may void only their
// own invoice on the day it was raised, so for them a void lists just those
// (owner's choice, 2026-10-06); the server still decides.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Invoice } from '../../api/models/invoice';
import { SalesService } from '../../api/services/sales.service';
import { SessionStore } from '../../core/session/session-store';
import { today } from '../../shared/dates';
import { LoadError } from '../../shared/load-error/load-error';
import { UsdPipe } from '../../shared/money/money-pipes';

export interface InvoicePickerData {
  readonly purpose: 'return' | 'void';
  /** Only the signed-in seller's invoices from today. */
  readonly ownToday: boolean;
}

@Component({
  selector: 'app-invoice-picker',
  imports: [DatePipe, LoadError, UsdPipe],
  templateUrl: './invoice-picker.html',
})
export class InvoicePicker {
  private readonly api = inject(SalesService);
  private readonly me = inject(SessionStore).user();
  protected readonly data = inject<InvoicePickerData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Invoice>>(DialogRef);

  private readonly search = signal('');
  private readonly typed = new Subject<string>();
  protected readonly invoices = rxResource({
    params: () => this.search(),
    stream: ({ params }) =>
      this.api.salesInvoicesList({
        status: 'COMPLETED',
        search: params || undefined,
        ...(this.data.ownToday ? { seller: this.me?.id, date_from: today() } : {}),
      }),
  });

  constructor() {
    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((words) => this.search.set(words.trim()));
  }

  protected type(words: string): void {
    this.typed.next(words);
  }
}
