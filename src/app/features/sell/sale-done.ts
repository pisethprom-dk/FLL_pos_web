// v1.1.0 — "Sale completed": the invoice as the server made it — its number,
// total and riel, what was paid and what went on credit, and the change to
// hand back. Unlike the mockup it shows the change. Print invoice prints it on
// the receipt paper (shared/print).
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Invoice } from '../../api/models/invoice';
import { readApiErrors } from '../../shared/api-errors';
import { compare } from '../../shared/money/exact';
import { Printer } from '../../shared/print/printer';
import { KhrPipe, RatePipe, UsdPipe } from '../../shared/money/money-pipes';

@Component({
  selector: 'app-sale-done',
  imports: [DatePipe, KhrPipe, RatePipe, UsdPipe],
  templateUrl: './sale-done.html',
})
export class SaleDone {
  protected readonly invoice = inject<Invoice>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly printer = inject(Printer);
  protected readonly printing = signal(false);
  protected readonly printError = signal('');

  protected readonly onCredit = compare(this.invoice.on_credit, '0') === 1;
  protected readonly change = compare(this.invoice.change_due, '0') === 1;

  protected print(): void {
    if (this.printing()) return;
    this.printing.set(true);
    this.printError.set('');
    this.printer.invoice(this.invoice).subscribe({
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

  protected buyer(): string {
    const i = this.invoice;
    return i.walk_in_name ? `${i.customer_name} — ${i.walk_in_name}` : i.customer_name;
  }
}
