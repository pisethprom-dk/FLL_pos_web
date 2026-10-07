// v1.0.0 — Operations → Customer payment: money collected against invoices
// already raised. Both roles record payments; only an Admin voids one. The
// tiles are counts the list can answer, and there is no search — period,
// customer and status find a payment (owner's choices, 2026-10-06).
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { SalesPaymentsList$Params } from '../../api/fn/sales/sales-payments-list';
import { CustomerPayment } from '../../api/models/customer-payment';
import { PaginatedCustomerPaymentList } from '../../api/models/paginated-customer-payment-list';
import { PartnersService } from '../../api/services/partners.service';
import { SalesService } from '../../api/services/sales.service';
import { HasScope } from '../../core/session/has-scope';
import { Modal } from '../../shared/dialog/modal';
import { fetchAll } from '../../shared/fetch-all';
import { LoadError } from '../../shared/load-error/load-error';
import { KhrPipe, UsdPipe } from '../../shared/money/money-pipes';
import { Pager } from '../../shared/pager/pager';
import { PERIODS, Period, periodStart } from '../stock/stock-common';
import { PaymentView } from './payment-view';
import { tenderLabel } from './payments-common';
import { RecordPayment } from './record-payment';

type StatusFilter = 'all' | 'POSTED' | 'VOID';

@Component({
  selector: 'app-payments',
  imports: [DatePipe, HasScope, KhrPipe, LoadError, Pager, UsdPipe],
  templateUrl: './payments.html',
})
export class Payments {
  private readonly api = inject(SalesService);
  private readonly partners = inject(PartnersService);
  private readonly modal = inject(Modal);
  protected readonly periods = PERIODS;
  protected readonly tenderLabel = tenderLabel;

  protected readonly customers = rxResource({
    stream: () => fetchAll((page) => this.partners.partnersCustomersList({ page })),
  });
  protected readonly storeCustomers = computed(() =>
    (this.customers.hasValue() ? this.customers.value() : []).filter((c) => !c.is_system),
  );

  protected readonly period = signal<Period>('month');
  protected readonly customer = signal<number | null>(null);
  protected readonly status = signal<StatusFilter>('all');
  protected readonly page = signal(1);

  private readonly query = computed<SalesPaymentsList$Params>(() => ({
    page: this.page(),
    customer: this.customer() ?? undefined,
    status: this.status() === 'all' ? undefined : (this.status() as 'POSTED' | 'VOID'),
    date_from: periodStart(this.period()),
  }));
  protected readonly payments = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.salesPaymentsList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedCustomerPaymentList | undefined,
    PaginatedCustomerPaymentList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.payments.hasValue() ? this.payments.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        posted: this.api.salesPaymentsList({ status: 'POSTED', date_from: periodStart('month') }),
        voided: this.api.salesPaymentsList({ status: 'VOID', date_from: periodStart('month') }),
      }).pipe(map((r) => ({ posted: r.posted.count, voided: r.voided.count }))),
  });

  protected setPeriod(value: string): void {
    this.period.set(value as Period);
    this.page.set(1);
  }

  protected setCustomer(value: string): void {
    this.customer.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
    this.page.set(1);
  }

  protected appliedTo(payment: CustomerPayment): string {
    return (payment.allocations ?? []).map((a) => a.invoice_number).join(', ') || '—';
  }

  protected record(): void {
    this.modal
      .open<'saved', unknown, RecordPayment>(RecordPayment, {
        document: true,
        labelledBy: 'pay-title',
      })
      .closed.subscribe((result) => result && this.reload());
  }

  protected open(payment: CustomerPayment): void {
    this.modal
      .open<'saved', CustomerPayment, PaymentView>(PaymentView, {
        data: payment,
        wide: true,
        labelledBy: 'payment-view-title',
      })
      .closed.subscribe((result) => result && this.reload());
  }

  private reload(): void {
    this.payments.reload();
    this.counts.reload();
  }
}
