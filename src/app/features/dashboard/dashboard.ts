// v1.1.0 — the Dashboard: today at a glance (owner's choices, 2026-10-07).
// Every figure is the server's (GET /api/reports/dashboard/), worked out each
// time the page opens; a part the user may not see comes back null and is left
// out. A Seller's sales are their own, with no profit, cash, money owed or
// stock value. "Cash taken today" is not a drawer count — there is no float.
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PaidByEnum } from '../../api/models/paid-by-enum';
import { QuotationsDue } from '../../api/models/quotations-due';
import { RecentSale } from '../../api/models/recent-sale';
import { ReportsService } from '../../api/services/reports.service';
import { SalesService } from '../../api/services/sales.service';
import { Modal } from '../../shared/dialog/modal';
import { LoadError } from '../../shared/load-error/load-error';
import { KhrPipe, QtyPipe, UsdPipe } from '../../shared/money/money-pipes';
import { SaleView } from '../sales/sale-view';

const PAID_BY: Record<PaidByEnum, { readonly label: string; readonly tone: string }> = {
  CASH: { label: 'Cash', tone: 'paid' },
  KHQR: { label: 'KHQR', tone: 'paid' },
  CREDIT: { label: 'Credit', tone: 'credit' },
  MIXED: { label: 'Mixed', tone: 'credit' },
};

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, KhrPipe, LoadError, NgTemplateOutlet, QtyPipe, RouterLink, UsdPipe],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly api = inject(ReportsService);
  private readonly sales = inject(SalesService);
  private readonly modal = inject(Modal);
  protected readonly paidBy = PAID_BY;

  protected readonly dash = rxResource({
    stream: () => this.api.reportsDashboardRetrieve(),
  });
  protected readonly opening = signal(false);

  /** What a sent quotation is waiting on: how many run out this week, how many already have. */
  protected followUp(q: QuotationsDue): string {
    const parts: string[] = [];
    if (q.expiring) parts.push(`${q.expiring} expiring within 7 days`);
    if (q.expired) parts.push(`${q.expired} expired`);
    return parts.join(' · ') || 'None about to expire';
  }

  /** The sale read only, as from Sales; a void there reloads the figures. */
  protected openSale(row: RecentSale): void {
    if (this.opening()) return;
    this.opening.set(true);
    this.sales.salesInvoicesRetrieve({ id: row.id }).subscribe({
      next: (invoice) => {
        this.opening.set(false);
        this.modal
          .open<'saved', typeof invoice, SaleView>(SaleView, {
            data: invoice,
            wide: true,
            labelledBy: 'sale-view-title',
          })
          .closed.subscribe((result) => {
            if (result) this.dash.reload();
          });
      },
      error: () => this.opening.set(false),
    });
  }
}
