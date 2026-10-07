// v1.0.0 — Operations → Sell → Sales: every completed or voided sale, today's
// first. Filtered by period or a From–To range, status, who sold it, and an
// invoice number or walk-in name. Both roles see every sale; a Seller cannot
// read the staff list, so "Sold by" offers them Everyone or Me (owner's
// choices, 2026-10-07). Held sales are left out — they have no number or date
// yet and wait in the till's Held sales.
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, of } from 'rxjs';
import { SalesInvoicesList$Params } from '../../api/fn/sales/sales-invoices-list';
import { Invoice } from '../../api/models/invoice';
import { PaginatedInvoiceList } from '../../api/models/paginated-invoice-list';
import { SalesService } from '../../api/services/sales.service';
import { UsersService } from '../../api/services/users.service';
import { SessionStore } from '../../core/session/session-store';
import { today } from '../../shared/dates';
import { Modal } from '../../shared/dialog/modal';
import { fetchAll } from '../../shared/fetch-all';
import { LoadError } from '../../shared/load-error/load-error';
import { KhrPipe, UsdPipe } from '../../shared/money/money-pipes';
import { Pager } from '../../shared/pager/pager';
import { periodStart } from '../stock/stock-common';
import { SaleView } from './sale-view';
import { paidBy } from './sale-rules';

type Period = 'today' | 'month' | 'days30' | 'year' | 'all' | 'range';
type Status = 'all' | 'COMPLETED' | 'VOID';

const PERIODS: readonly { readonly value: Period; readonly label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
  { value: 'days30', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All dates' },
  { value: 'range', label: 'Dates…' },
];

@Component({
  selector: 'app-sales',
  imports: [DatePipe, KhrPipe, LoadError, Pager, UsdPipe],
  templateUrl: './sales.html',
})
export class Sales {
  private readonly api = inject(SalesService);
  private readonly users = inject(UsersService);
  private readonly modal = inject(Modal);
  private readonly session = inject(SessionStore);
  protected readonly periods = PERIODS;
  protected readonly paidBy = paidBy;
  protected readonly today = today();

  protected readonly period = signal<Period>('today');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly status = signal<Status>('all');
  /** '' everyone, 'me', or a member of staff's id. */
  protected readonly soldBy = signal('');
  private readonly search = signal('');
  private readonly typed = new Subject<string>();
  protected readonly page = signal(1);

  /** Every member of staff, for an Admin; a Seller may not read the list. */
  protected readonly staff = rxResource({
    stream: () =>
      this.session.hasAnyScope(['user.manage'])
        ? fetchAll((page) => this.users.usersList({ page }))
        : of([]),
  });

  private readonly query = computed<SalesInvoicesList$Params>(() => {
    const day = this.today;
    const period = this.period();
    const soldBy = this.soldBy();
    return {
      page: this.page(),
      held: 'false',
      status: this.status() === 'all' ? undefined : (this.status() as 'COMPLETED' | 'VOID'),
      seller: soldBy === 'me' ? this.session.user()?.id : soldBy ? Number(soldBy) : undefined,
      search: this.search() || undefined,
      date_from:
        period === 'today'
          ? day
          : period === 'range'
            ? this.from() || undefined
            : period === 'all'
              ? undefined
              : periodStart(period, day),
      date_to: period === 'today' ? day : period === 'range' ? this.to() || undefined : undefined,
    };
  });
  protected readonly sales = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.salesInvoicesList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedInvoiceList | undefined,
    PaginatedInvoiceList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.sales.hasValue() ? this.sales.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () => {
      const day = { date_from: this.today, date_to: this.today };
      return forkJoin({
        sold: this.api.salesInvoicesList({ ...day, status: 'COMPLETED' }),
        voided: this.api.salesInvoicesList({ ...day, status: 'VOID' }),
      }).pipe(map((r) => ({ sold: r.sold.count, voided: r.voided.count })));
    },
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

  protected setPeriod(value: string): void {
    this.period.set(value as Period);
    this.page.set(1);
  }

  protected setFrom(value: string): void {
    this.from.set(value);
    this.page.set(1);
  }

  protected setTo(value: string): void {
    this.to.set(value);
    this.page.set(1);
  }

  protected setStatus(value: string): void {
    this.status.set(value as Status);
    this.page.set(1);
  }

  protected setSoldBy(value: string): void {
    this.soldBy.set(value);
    this.page.set(1);
  }

  protected open(invoice: Invoice): void {
    this.modal
      .open<'saved', Invoice, SaleView>(SaleView, {
        data: invoice,
        wide: true,
        labelledBy: 'sale-view-title',
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.sales.reload();
        this.counts.reload();
      });
  }
}
