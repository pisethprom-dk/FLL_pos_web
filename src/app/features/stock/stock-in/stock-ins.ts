// v1.0.1 — Stock → Stock in: goods received from a supplier. Admin only
// (stock.view; stock.post to change anything). The tiles are counts the list
// can answer; the mockup's money tiles wait for the reports API (owner's
// choice, 2026-10-05).
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { InventoryStockInsList$Params } from '../../../api/fn/inventory/inventory-stock-ins-list';
import { PaginatedStockInList } from '../../../api/models/paginated-stock-in-list';
import { StockIn } from '../../../api/models/stock-in';
import { InventoryService } from '../../../api/services/inventory.service';
import { PartnersService } from '../../../api/services/partners.service';
import { HasScope } from '../../../core/session/has-scope';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { LoadError } from '../../../shared/load-error/load-error';
import { UsdPipe } from '../../../shared/money/money-pipes';
import { Pager } from '../../../shared/pager/pager';
import { PERIODS, Period, StatusFilter, docState, periodStart } from '../stock-common';
import { StockInDialog, StockInResult } from './stock-in-dialog';

@Component({
  selector: 'app-stock-ins',
  imports: [DatePipe, HasScope, LoadError, Pager, UsdPipe],
  templateUrl: './stock-ins.html',
})
export class StockIns {
  private readonly api = inject(InventoryService);
  private readonly partners = inject(PartnersService);
  private readonly modal = inject(Modal);

  protected readonly periods = PERIODS;
  protected readonly docState = docState;

  // Every supplier for the filter, retired ones too: their stock-ins stay.
  protected readonly suppliers = rxResource({
    stream: () => fetchAll((page) => this.partners.partnersSuppliersList({ page })),
  });

  protected readonly period = signal<Period>('month');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly supplier = signal<number | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  private readonly typed = new Subject<string>();

  private readonly query = computed<InventoryStockInsList$Params>(() => ({
    page: this.page(),
    search: this.search() || undefined,
    status: this.status() === 'all' ? undefined : (this.status() as 'DRAFT' | 'POSTED'),
    supplier: this.supplier() ?? undefined,
    date_from: periodStart(this.period()),
  }));
  protected readonly docs = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.inventoryStockInsList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedStockInList | undefined,
    PaginatedStockInList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.docs.hasValue() ? this.docs.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        posted: this.api.inventoryStockInsList({
          status: 'POSTED',
          date_from: periodStart('month'),
        }),
        drafts: this.api.inventoryStockInsList({ status: 'DRAFT' }),
      }).pipe(map((r) => ({ posted: r.posted.count, drafts: r.drafts.count }))),
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

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
    this.page.set(1);
  }

  protected setSupplier(value: string): void {
    this.supplier.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected open(doc: StockIn | null): void {
    this.modal
      .open<StockInResult, StockIn | null, StockInDialog>(StockInDialog, {
        data: doc,
        document: true,
        labelledBy: 'grn-title',
        guarded: true,
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.docs.reload();
        this.counts.reload();
        if (result !== 'saved') this.open(result.open);
      });
  }
}
