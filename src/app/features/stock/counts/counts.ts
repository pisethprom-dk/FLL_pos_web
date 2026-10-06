// v1.0.0 — Stock → Stock count: one category at a time, blind. Admin only
// (stock.view; stock.post to count). The tiles are counts the list can
// answer; the mockup's net variance waits for the reports API (owner's
// choice, 2026-10-05). No "Print count sheet": a sheet counted on paper and
// typed in later would read the day's sales as shortages.
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { InventoryCountsList$Params } from '../../../api/fn/inventory/inventory-counts-list';
import { Category } from '../../../api/models/category';
import { PaginatedStockCountList } from '../../../api/models/paginated-stock-count-list';
import { StockCount } from '../../../api/models/stock-count';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { InventoryService } from '../../../api/services/inventory.service';
import { HasScope } from '../../../core/session/has-scope';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { LoadError } from '../../../shared/load-error/load-error';
import { UsdPipe } from '../../../shared/money/money-pipes';
import { Pager } from '../../../shared/pager/pager';
import { asTree } from '../../catalogue/categories/categories';
import { PERIODS, Period, StatusFilter, docState, periodStart } from '../stock-common';
import { CountDialog, CountResult } from './count-dialog';
import { StartCountDialog } from './start-count-dialog';

@Component({
  selector: 'app-counts',
  imports: [DatePipe, HasScope, LoadError, Pager, UsdPipe],
  templateUrl: './counts.html',
})
export class Counts {
  private readonly api = inject(InventoryService);
  private readonly catalogue = inject(CatalogueService);
  private readonly modal = inject(Modal);

  protected readonly periods = PERIODS;
  protected readonly docState = docState;

  protected readonly categories = rxResource({
    stream: () => fetchAll((page) => this.catalogue.catalogueCategoriesList({ page })),
  });
  protected readonly categoryOptions = computed(() =>
    asTree(this.categories.hasValue() ? this.categories.value() : []).map((c) => ({
      id: c.id,
      label: c.parent == null ? c.name : `— ${c.name}`,
    })),
  );

  protected readonly period = signal<Period>('year');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly category = signal<number | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  private readonly typed = new Subject<string>();

  private readonly query = computed<InventoryCountsList$Params>(() => ({
    page: this.page(),
    search: this.search() || undefined,
    status: this.status() === 'all' ? undefined : (this.status() as 'DRAFT' | 'POSTED'),
    category: this.category() ?? undefined,
    date_from: periodStart(this.period()),
  }));
  protected readonly docs = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.inventoryCountsList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedStockCountList | undefined,
    PaginatedStockCountList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.docs.hasValue() ? this.docs.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        posted: this.api.inventoryCountsList({ status: 'POSTED', date_from: periodStart('year') }),
        open: this.api.inventoryCountsList({ status: 'DRAFT' }),
      }).pipe(
        map((r) => ({
          posted: r.posted.count,
          open: r.open.count,
          first: r.open.results[0] ?? null,
        })),
      ),
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

  protected setCategory(value: string): void {
    this.category.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected start(): void {
    if (!this.categories.hasValue()) return;
    this.modal
      .open<StockCount, readonly Category[], StartCountDialog>(StartCountDialog, {
        data: this.categories.value(),
        labelledBy: 'start-count-title',
      })
      .closed.subscribe((count) => {
        if (!count) return;
        this.reload();
        this.open(count);
      });
  }

  protected open(count: StockCount): void {
    this.modal
      .open<CountResult, StockCount, CountDialog>(CountDialog, {
        data: count,
        wide: true,
        labelledBy: 'count-title',
        guarded: true,
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.reload();
        if (result !== 'saved') this.open(result.open);
      });
  }

  private reload(): void {
    this.docs.reload();
    this.counts.reload();
  }
}
