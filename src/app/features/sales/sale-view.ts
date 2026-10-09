// v1.1.0 — one sale, read only: what was sold, how it was paid, and any
// return against it. Cost and profit show only with `cost.view` (the API sends
// them as null to a Seller). Void… is offered to whoever may void it and asks
// why; the server still refuses one with a payment or a return against it.
// Print reprints the invoice, marked COPY — never for a void sale.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { compare } from '../../shared/money/exact';
import { Invoice } from '../../api/models/invoice';
import { SalesService } from '../../api/services/sales.service';
import { SessionStore } from '../../core/session/session-store';
import { today } from '../../shared/dates';
import { Modal } from '../../shared/dialog/modal';
import { askReason } from '../../shared/dialog/reason-dialog';
import { readApiErrors } from '../../shared/api-errors';
import { Printer } from '../../shared/print/printer';
import { KhrPipe, QtyPipe, RatePipe, UsdPipe, formatMoney } from '../../shared/money/money-pipes';
import { discountText, kindLabel, mayVoid } from './sale-rules';

@Component({
  selector: 'app-sale-view',
  imports: [DatePipe, KhrPipe, QtyPipe, RatePipe, UsdPipe],
  templateUrl: './sale-view.html',
})
export class SaleView {
  private readonly api = inject(SalesService);
  private readonly modal = inject(Modal);
  private readonly session = inject(SessionStore);
  private readonly printer = inject(Printer);
  protected readonly printing = signal(false);
  protected readonly printError = signal('');
  protected readonly sale = inject<Invoice>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly discountText = discountText;
  protected readonly kindLabel = kindLabel;
  protected readonly seesCost = this.session.hasAnyScope(['cost.view']);
  protected readonly canVoid = mayVoid(
    this.sale,
    this.session.user(),
    (scopes) => this.session.hasAnyScope(scopes),
    today(),
  );

  /** Posted returns against this sale. */
  protected readonly returns = rxResource({
    stream: () => this.api.salesReturnsList({ invoice: this.sale.id, status: 'POSTED' }),
  });

  protected isZero(value: string | null | undefined): boolean {
    return !value || compare(value, '0') === 0;
  }

  protected print(): void {
    if (this.printing()) return;
    this.printing.set(true);
    this.printError.set('');
    this.printer.invoice(this.sale, true).subscribe({
      next: () => this.printing.set(false),
      error: (error: unknown) => {
        this.printing.set(false);
        this.printError.set(
          readApiErrors(error).form[0] ??
            "The shop's details could not be loaded; nothing printed.",
        );
      },
    });
  }

  protected voidSale(): void {
    const sale = this.sale;
    askReason<Invoice>(this.modal, {
      title: `Void ${sale.number}?`,
      message:
        `${sale.customer_name}, ${formatMoney(sale.total, '$', 2)}. The stock goes back and ` +
        'the number stays, marked Void. It cannot be undone.',
      label: 'Why',
      placeholder: 'Rung up twice by mistake, wrong customer, …',
      confirmLabel: 'Void this sale',
      send: (reason) => this.api.salesInvoicesVoidCreate$Json({ id: sale.id, body: { reason } }),
    }).closed.subscribe((voided) => {
      if (voided) this.ref.close('saved');
    });
  }
}
