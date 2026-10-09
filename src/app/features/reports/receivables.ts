// v1.0.0 — Reports → Receivables: what store customers owe and how old it
// is, as at today, aged by the days since each invoice (owner's choice,
// 2026-10-07). Admin only. The figures are the server's (GET
// /api/reports/receivables/); a customer's open invoices come from their
// account, and Record a payment opens the payment dialog with that customer
// already chosen. No statements and no Export for now.
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ReportsReceivablesRetrieve$Params } from '../../api/fn/reports/reports-receivables-retrieve';
import { CustomerLookup } from '../../api/models/customer-lookup';
import { OpenInvoice } from '../../api/models/open-invoice';
import { ReceivableRow } from '../../api/models/receivable-row';
import { Receivables } from '../../api/models/receivables';
import { PartnersService } from '../../api/services/partners.service';
import { ReportsService } from '../../api/services/reports.service';
import { SalesService } from '../../api/services/sales.service';
import { HasScope } from '../../core/session/has-scope';
import { daysBefore, today } from '../../shared/dates';
import { Modal } from '../../shared/dialog/modal';
import { LoadError } from '../../shared/load-error/load-error';
import { compare } from '../../shared/money/exact';
import { KhrPipe, UsdPipe } from '../../shared/money/money-pipes';
import { RecordPayment } from '../payments/record-payment';

type Show = '' | NonNullable<ReportsReceivablesRetrieve$Params['show']>;

const SHOW: readonly { readonly value: Show; readonly label: string }[] = [
  { value: '', label: 'All who owe' },
  { value: 'overdue', label: 'Overdue only' },
  { value: 'over_limit', label: 'Over limit' },
  { value: 'on_hold', label: 'On hold' },
];

@Component({
  selector: 'app-receivables',
  imports: [DatePipe, HasScope, KhrPipe, LoadError, UsdPipe],
  templateUrl: './receivables.html',
})
export class ReceivablesReport {
  private readonly api = inject(ReportsService);
  private readonly sales = inject(SalesService);
  private readonly partners = inject(PartnersService);
  private readonly modal = inject(Modal);
  protected readonly showOptions = SHOW;

  protected readonly show = signal<Show>('');
  protected readonly report = rxResource({
    params: () => ({ show: this.show() || undefined }),
    stream: ({ params }) => this.api.reportsReceivablesRetrieve(params),
  });
  /** The last report loaded, kept on screen while the next one comes. */
  protected readonly last = linkedSignal<Receivables | undefined, Receivables | undefined>({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.report.hasValue() ? this.report.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  /** The customer opened below the table. */
  protected readonly chosen = signal<ReceivableRow | null>(null);
  protected readonly account = rxResource({
    params: () => this.chosen()?.customer,
    stream: ({ params: id }) => this.sales.salesCustomersAccountRetrieve({ id }),
  });
  protected readonly invoices = computed(() =>
    this.account.hasValue() ? this.account.value().open_invoices : [],
  );
  protected readonly opening = signal(false);
  protected readonly negative = (value: string | null | undefined) =>
    !!value && compare(value, '0') === -1;

  protected setShow(value: string): void {
    this.show.set(value as Show);
  }

  protected open(row: ReceivableRow): void {
    this.chosen.set(row);
  }

  /** Open, Part paid, Overdue, or Overdue 90+ — by its due date and its age. */
  protected state(invoice: OpenInvoice): { label: string; tone: string } {
    if (invoice.overdue) {
      const old = invoice.sale_date.slice(0, 10) < daysBefore(today(), 90);
      return { label: old ? 'Overdue 90+' : 'Overdue', tone: 'low' };
    }
    const touched = compare(invoice.paid, '0') === 1 || compare(invoice.credited, '0') === 1;
    return touched ? { label: 'Part paid', tone: 'credit' } : { label: 'Open', tone: 'ok' };
  }

  /** The payment dialog, with the customer already chosen; the report follows what is saved. */
  protected recordPayment(): void {
    const row = this.chosen();
    if (!row || this.opening()) return;
    this.opening.set(true);
    this.partners.partnersCustomersLookupList({ search: row.code }).subscribe({
      next: (found) => {
        this.opening.set(false);
        const customer: CustomerLookup | undefined = found.find((c) => c.id === row.customer);
        this.modal
          .open<'saved', CustomerLookup | null, RecordPayment>(RecordPayment, {
            data: customer ?? null,
            document: true,
            labelledBy: 'pay-title',
          })
          .closed.subscribe((result) => {
            if (!result) return;
            this.report.reload();
            this.account.reload();
          });
      },
      error: () => this.opening.set(false),
    });
  }
}
