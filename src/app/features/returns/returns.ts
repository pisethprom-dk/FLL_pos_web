// v1.0.0 — Operations → Returns & voids. A void cancels an invoice raised in
// error; a return takes goods back after the sale. Each is its own document
// and the invoice itself is never edited. The two are separate lists in the
// API, so the screen switches between them rather than mixing them (owner's
// choice, 2026-10-06). The tiles are counts the lists can answer.
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import { Invoice } from '../../api/models/invoice';
import { PaginatedInvoiceList } from '../../api/models/paginated-invoice-list';
import { PaginatedSalesReturnList } from '../../api/models/paginated-sales-return-list';
import { SalesReturn } from '../../api/models/sales-return';
import { PartnersService } from '../../api/services/partners.service';
import { SalesService } from '../../api/services/sales.service';
import { HasScope } from '../../core/session/has-scope';
import { SessionStore } from '../../core/session/session-store';
import { Modal } from '../../shared/dialog/modal';
import { askReason } from '../../shared/dialog/reason-dialog';
import { fetchAll } from '../../shared/fetch-all';
import { LoadError } from '../../shared/load-error/load-error';
import { UsdPipe, formatMoney } from '../../shared/money/money-pipes';
import { Pager } from '../../shared/pager/pager';
import { PERIODS, Period, StatusFilter, periodStart } from '../stock/stock-common';
import { InvoicePicker, InvoicePickerData } from './invoice-picker';
import { ReturnDialog } from './return-dialog';
import { settledBy } from './returns-common';
import { VoidedInvoice } from './voided-invoice';

type Kind = 'returns' | 'voids';

/** The last page loaded, kept on screen while the next one comes. */
function lastPage<T>(load: { hasValue(): boolean; value(): T | undefined }) {
  return linkedSignal<T | undefined, T | undefined>({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (load.hasValue() ? load.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });
}

@Component({
  selector: 'app-returns',
  imports: [DatePipe, HasScope, LoadError, Pager, UsdPipe],
  templateUrl: './returns.html',
})
export class Returns {
  private readonly api = inject(SalesService);
  private readonly partners = inject(PartnersService);
  private readonly modal = inject(Modal);
  private readonly session = inject(SessionStore);
  protected readonly periods = PERIODS;
  protected readonly settledBy = settledBy;

  protected readonly customers = rxResource({
    stream: () => fetchAll((page) => this.partners.partnersCustomersList({ page })),
  });

  protected readonly kind = signal<Kind>('returns');
  protected readonly period = signal<Period>('month');
  protected readonly customer = signal<number | null>(null);
  protected readonly status = signal<StatusFilter>('all');
  protected readonly page = signal(1);

  private readonly filters = computed(() => ({
    page: this.page(),
    customer: this.customer() ?? undefined,
    date_from: periodStart(this.period()),
  }));
  protected readonly returns = rxResource({
    params: () =>
      this.kind() === 'returns'
        ? {
            ...this.filters(),
            status: this.status() === 'all' ? undefined : (this.status() as 'DRAFT' | 'POSTED'),
          }
        : undefined,
    stream: ({ params }) => this.api.salesReturnsList(params),
  });
  protected readonly voids = rxResource({
    params: () =>
      this.kind() === 'voids' ? { ...this.filters(), status: 'VOID' as const } : undefined,
    stream: ({ params }) => this.api.salesInvoicesList(params),
  });
  protected readonly shownReturns = lastPage<PaginatedSalesReturnList>(this.returns);
  protected readonly shownVoids = lastPage<PaginatedInvoiceList>(this.voids);
  protected readonly current = computed(() =>
    this.kind() === 'returns' ? this.returns : this.voids,
  );

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        returns: this.api.salesReturnsList({ status: 'POSTED', date_from: periodStart('month') }),
        voids: this.api.salesInvoicesList({ status: 'VOID', date_from: periodStart('month') }),
      }).pipe(map((r) => ({ returns: r.returns.count, voids: r.voids.count }))),
  });

  protected setKind(value: string): void {
    this.kind.set(value as Kind);
    this.page.set(1);
  }

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

  protected newReturn(): void {
    this.openReturn(null);
  }

  protected openReturn(ret: SalesReturn | null): void {
    this.modal
      .open<'saved', SalesReturn | null, ReturnDialog>(ReturnDialog, {
        data: ret,
        document: true,
        guarded: true,
        labelledBy: 'return-title',
      })
      .closed.subscribe((result) => result && this.reload());
  }

  protected openVoid(invoice: Invoice): void {
    this.modal.open<void, Invoice, VoidedInvoice>(VoidedInvoice, {
      data: invoice,
      wide: true,
      labelledBy: 'voided-title',
    });
  }

  /** Choose the invoice, then say why; the voided list then shows it. */
  protected voidInvoice(): void {
    this.modal
      .open<Invoice, InvoicePickerData, InvoicePicker>(InvoicePicker, {
        data: { purpose: 'void', ownToday: !this.session.hasAnyScope(['invoice.void.any']) },
        wide: true,
        labelledBy: 'pick-invoice-title',
      })
      .closed.subscribe((invoice) => {
        if (!invoice) return;
        askReason<Invoice>(this.modal, {
          title: `Void ${invoice.number}?`,
          message:
            `${invoice.customer_name}, ${formatMoney(invoice.total, '$', 2)}. The stock goes ` +
            'back and the number stays, marked Void. It cannot be undone.',
          label: 'Why',
          placeholder: 'Rung up twice by mistake, wrong customer, …',
          confirmLabel: 'Void this invoice',
          send: (reason) =>
            this.api.salesInvoicesVoidCreate$Json({ id: invoice.id, body: { reason } }),
        }).closed.subscribe((voided) => {
          if (!voided) return;
          // Switching lists loads the voids afresh; already on them, reload.
          if (this.kind() === 'voids') this.voids.reload();
          else this.setKind('voids');
          this.counts.reload();
        });
      });
  }

  private reload(): void {
    this.current().reload();
    this.counts.reload();
  }
}
