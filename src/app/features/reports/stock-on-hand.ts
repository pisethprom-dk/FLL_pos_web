// v1.0.0 — Reports → Stock on hand: what is on the shelf and its value at
// average cost, as at today, every matching product on one page (owner's
// choices, 2026-10-07). The figures are the server's (GET
// /api/reports/stock-on-hand/); the tiles cover all stock, the table what the
// filters keep. A Seller sees quantities but no cost or value.
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ReportsStockOnHandRetrieve$Params } from '../../api/fn/reports/reports-stock-on-hand-retrieve';
import { StockOnHand } from '../../api/models/stock-on-hand';
import { StockStatusEnum } from '../../api/models/stock-status-enum';
import { CatalogueService } from '../../api/services/catalogue.service';
import { ReportsService } from '../../api/services/reports.service';
import { SessionStore } from '../../core/session/session-store';
import { fetchAll } from '../../shared/fetch-all';
import { LoadError } from '../../shared/load-error/load-error';
import { QtyPipe, UsdPipe } from '../../shared/money/money-pipes';
import { asTree } from '../catalogue/categories/categories';
import { costPlaces } from '../stock/stock-common';

type Shown = '' | NonNullable<ReportsStockOnHandRetrieve$Params['status']>;

const SHOWN: readonly { readonly value: Shown; readonly label: string }[] = [
  { value: '', label: 'All products' },
  { value: 'below_reorder', label: 'Below reorder level' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'no_movement', label: 'No movement 90 days' },
];

const STATUS: Record<StockStatusEnum, { readonly label: string; readonly tone: string }> = {
  OUT: { label: 'Out of stock', tone: 'low' },
  REORDER: { label: 'Reorder', tone: 'credit' },
  IDLE: { label: 'No movement 90 days', tone: 'credit' },
  OK: { label: 'OK', tone: 'ok' },
};

@Component({
  selector: 'app-stock-on-hand',
  imports: [DatePipe, LoadError, QtyPipe, UsdPipe],
  templateUrl: './stock-on-hand.html',
})
export class StockOnHandReport {
  private readonly api = inject(ReportsService);
  private readonly catalogue = inject(CatalogueService);
  protected readonly seesCost = inject(SessionStore).hasAnyScope(['cost.view']);
  protected readonly shownOptions = SHOWN;
  protected readonly status = STATUS;
  protected readonly costPlaces = costPlaces;

  protected readonly shown = signal<Shown>('');
  protected readonly category = signal<number | null>(null);
  protected readonly brand = signal<number | null>(null);
  private readonly search = signal('');
  private readonly typed = new Subject<string>();

  private readonly categories = rxResource({
    stream: () => fetchAll((page) => this.catalogue.catalogueCategoriesList({ page })),
  });
  private readonly brands = rxResource({
    stream: () => fetchAll((page) => this.catalogue.catalogueBrandsList({ page })),
  });
  /** Active categories in tree order, sub-categories marked under their group. */
  protected readonly categoryOptions = computed(() =>
    asTree(this.categories.hasValue() ? this.categories.value() : [])
      .filter((c) => c.is_active !== false)
      .map((c) => ({ id: c.id, label: c.parent == null ? c.name : `— ${c.name}` })),
  );
  protected readonly brandOptions = computed(() =>
    (this.brands.hasValue() ? this.brands.value() : []).filter((b) => b.is_active !== false),
  );

  private readonly query = computed<ReportsStockOnHandRetrieve$Params>(() => ({
    status: this.shown() || undefined,
    category: this.category() ?? undefined,
    brand: this.brand() ?? undefined,
    search: this.search() || undefined,
  }));
  protected readonly report = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.reportsStockOnHandRetrieve(params),
  });
  /** The last report loaded, kept on screen while the next one comes. */
  protected readonly last = linkedSignal<StockOnHand | undefined, StockOnHand | undefined>({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.report.hasValue() ? this.report.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  constructor() {
    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((words) => this.search.set(words.trim()));
  }

  protected type(words: string): void {
    this.typed.next(words);
  }

  protected setShown(value: string): void {
    this.shown.set(value as Shown);
  }

  protected setCategory(value: string): void {
    this.category.set(value ? Number(value) : null);
  }

  protected setBrand(value: string): void {
    this.brand.set(value ? Number(value) : null);
  }
}
