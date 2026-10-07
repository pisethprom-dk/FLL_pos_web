// v1.1.0 — a saved payment, read-only: what was paid and what it paid off. A
// payment is frozen; only an Admin may void it (`payment.void`), with a
// reason, which reopens the invoices it paid. Not in the mockup. Print
// reprints its receipt, marked COPY — never for a void payment.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { CustomerPayment } from '../../api/models/customer-payment';
import { SalesService } from '../../api/services/sales.service';
import { SessionStore } from '../../core/session/session-store';
import { Modal } from '../../shared/dialog/modal';
import { readApiErrors } from '../../shared/api-errors';
import { askReason } from '../../shared/dialog/reason-dialog';
import { Printer } from '../../shared/print/printer';
import { KhrPipe, RatePipe, UsdPipe } from '../../shared/money/money-pipes';
import { tenderLabel } from './payments-common';

@Component({
  selector: 'app-payment-view',
  imports: [DatePipe, KhrPipe, RatePipe, UsdPipe],
  templateUrl: './payment-view.html',
})
export class PaymentView {
  private readonly api = inject(SalesService);
  private readonly modal = inject(Modal);
  protected readonly payment = inject<CustomerPayment>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly canVoid = inject(SessionStore).hasAnyScope(['payment.void']);
  protected readonly tenderLabel = tenderLabel;
  private readonly printer = inject(Printer);
  protected readonly printing = signal(false);
  protected readonly printError = signal('');

  protected print(): void {
    if (this.printing()) return;
    this.printing.set(true);
    this.printError.set('');
    this.printer.payment(this.payment, true).subscribe({
      next: () => this.printing.set(false),
      error: (error: unknown) => {
        this.printing.set(false);
        const [reason] = readApiErrors(error).form;
        this.printError.set(reason ?? "The shop's details could not be loaded; nothing printed.");
      },
    });
  }

  protected voidPayment(): void {
    const payment = this.payment;
    askReason<CustomerPayment>(this.modal, {
      title: `Void ${payment.number}?`,
      message:
        'The payment is kept, marked void, and the invoices it paid are open again for what ' +
        'it had paid off.',
      label: 'Why',
      placeholder: 'Entered against the wrong customer, cheque returned, …',
      confirmLabel: 'Void payment',
      send: (reason) => this.api.salesPaymentsVoidCreate$Json({ id: payment.id, body: { reason } }),
    }).closed.subscribe((voided) => {
      if (voided) this.ref.close('saved');
    });
  }
}
