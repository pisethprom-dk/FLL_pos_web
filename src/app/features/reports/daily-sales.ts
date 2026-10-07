// v1.0.0 — Reports → Daily sales: completed sales by day, by seller and by
// how they were paid, this month unless another period is chosen. The figures
// are the server's (GET /api/reports/daily-sales/): an Admin sees every
// seller, with cost and profit; a Seller only their own, without. No tender
// filter — the By tender table already splits every sale — and no Export
// (owner's choices, 2026-10-07).
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { ReportsDailySalesRetrieve$Params } from '../../api/fn/reports/reports-daily-sales-retrieve';
import { DailySales } from '../../api/models/daily-sales';
import { ReportsService } from '../../api/services/reports.service';
import { UsersService } from '../../api/services/users.service';
import { SessionStore } from '../../core/session/session-store';
import { daysBefore, today } from '../../shared/dates';
import { fetchAll } from '../../shared/fetch-all';
import { LoadError } from '../../shared/load-error/load-error';
import { KhrPipe, UsdPipe } from '../../shared/money/money-pipes';
import { kindLabel } from '../sales/sale-rules';

type Period = 'month' | 'today' | 'days7' | 'range';

const PERIODS: readonly { readonly value: Period; readonly label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'today', label: 'Today' },
  { value: 'days7', label: 'Last 7 days' },
  { value: 'range', label: 'Dates…' },
];

@Component({
  selector: 'app-daily-sales',
  imports: [DatePipe, KhrPipe, LoadError, UsdPipe],
  templateUrl: './daily-sales.html',
})
export class DailySalesReport {
  private readonly api = inject(ReportsService);
  private readonly users = inject(UsersService);
  private readonly session = inject(SessionStore);
  protected readonly periods = PERIODS;
  protected readonly kindLabel = kindLabel;
  protected readonly today = today();
  /** Every seller's sales, and a choice of whose; a Seller sees only their own. */
  protected readonly seesAll = this.session.hasAnyScope(['report.sales.all']);
  protected readonly seesCost = this.session.hasAnyScope(['cost.view']);

  protected readonly period = signal<Period>('month');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly seller = signal('');

  protected readonly staff = rxResource({
    stream: () =>
      this.seesAll && this.session.hasAnyScope(['user.manage'])
        ? fetchAll((page) => this.users.usersList({ page }))
        : of([]),
  });

  private readonly query = computed<ReportsDailySalesRetrieve$Params>(() => {
    const day = this.today;
    const range: Record<Period, [string | undefined, string | undefined]> = {
      month: [`${day.slice(0, 7)}-01`, day],
      today: [day, day],
      days7: [daysBefore(day, 6), day],
      range: [this.from() || undefined, this.to() || undefined],
    };
    const [date_from, date_to] = range[this.period()];
    return { date_from, date_to, seller: this.seller() ? Number(this.seller()) : undefined };
  });
  protected readonly report = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.reportsDailySalesRetrieve(params),
  });
  /** The last report loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<DailySales | undefined, DailySales | undefined>({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.report.hasValue() ? this.report.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected setPeriod(value: string): void {
    this.period.set(value as Period);
  }

  /** The by-tender figure for the totals row: cash, KHQR or credit. */
  protected tender(report: DailySales, kind: string): string | undefined {
    return report.by_tender.find((t) => t.tender === kind)?.amount;
  }
}
