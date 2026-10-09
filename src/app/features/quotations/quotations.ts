// v1.0.0 — Operations → Quotations: prices offered to store customers.
// Nothing moves until an accepted quote is invoiced at the till, in parts if
// need be. Sellers and Admins both raise them (quotation.edit). The tiles are
// counts the list can answer (owner's choice, 2026-10-06).
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { SalesQuotationsList$Params } from '../../api/fn/sales/sales-quotations-list';
import { PaginatedQuotationList } from '../../api/models/paginated-quotation-list';
import { Quotation } from '../../api/models/quotation';
import { QuoteStatusEnum } from '../../api/models/quote-status-enum';
import { PartnersService } from '../../api/services/partners.service';
import { SalesService } from '../../api/services/sales.service';
import { HasScope } from '../../core/session/has-scope';
import { Modal } from '../../shared/dialog/modal';
import { fetchAll } from '../../shared/fetch-all';
import { LoadError } from '../../shared/load-error/load-error';
import { UsdPipe } from '../../shared/money/money-pipes';
import { Pager } from '../../shared/pager/pager';
import { QUOTE_STATUSES, quoteState } from '../../shared/sales/sales-common';
import { QuotationDialog, QuotationDialogData } from './quotation-dialog';

/** "open" is draft, sent or accepted — the server's own filter. */
type StatusFilter = 'open' | 'all' | QuoteStatusEnum;

@Component({
  selector: 'app-quotations',
  imports: [DatePipe, HasScope, LoadError, Pager, UsdPipe],
  templateUrl: './quotations.html',
})
export class Quotations {
  private readonly api = inject(SalesService);
  private readonly partners = inject(PartnersService);
  private readonly modal = inject(Modal);

  protected readonly statuses = QUOTE_STATUSES;
  protected readonly quoteState = quoteState;

  // Every customer for the filter, retired ones too; a quote is never for the walk-in.
  protected readonly customers = rxResource({
    stream: () => fetchAll((page) => this.partners.partnersCustomersList({ page })),
  });
  protected readonly storeCustomers = computed(() =>
    (this.customers.hasValue() ? this.customers.value() : []).filter((c) => !c.is_system),
  );

  protected readonly status = signal<StatusFilter>('open');
  protected readonly customer = signal<number | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  private readonly typed = new Subject<string>();

  private readonly query = computed<SalesQuotationsList$Params>(() => {
    const status = this.status();
    return {
      page: this.page(),
      search: this.search() || undefined,
      customer: this.customer() ?? undefined,
      open: status === 'open' ? 'true' : undefined,
      status: status === 'open' || status === 'all' ? undefined : status,
    };
  });
  protected readonly quotes = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.salesQuotationsList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedQuotationList | undefined,
    PaginatedQuotationList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.quotes.hasValue() ? this.quotes.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        open: this.api.salesQuotationsList({ open: 'true' }),
        sent: this.api.salesQuotationsList({ status: 'SENT' }),
        accepted: this.api.salesQuotationsList({ status: 'ACCEPTED' }),
      }).pipe(map((r) => ({ open: r.open.count, sent: r.sent.count, accepted: r.accepted.count }))),
  });

  constructor() {
    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((words) => {
        this.search.set(words.trim());
        this.page.set(1);
      });
  }

  protected type(words: string): void {
    this.typed.next(words);
  }

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
    this.page.set(1);
  }

  protected setCustomer(value: string): void {
    this.customer.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected open(quote: Quotation | null): void {
    if (!this.customers.hasValue()) return;
    this.modal
      .open<'saved', QuotationDialogData, QuotationDialog>(QuotationDialog, {
        data: {
          quote,
          customers: this.storeCustomers().filter((c) => c.is_active !== false),
        },
        document: true,
        labelledBy: 'quote-title',
        guarded: true,
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.quotes.reload();
        this.counts.reload();
      });
  }
}
