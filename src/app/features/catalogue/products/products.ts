// v1.0.0 — Catalogue → Products: everything the shop sells. Filters and
// paging run on the server; average cost shows only to cost.view (Admin) —
// for anyone else the API sends it as null.
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { CatalogueProductsList$Params } from '../../../api/fn/catalogue/catalogue-products-list';
import { PaginatedProductList } from '../../../api/models/paginated-product-list';
import { Product } from '../../../api/models/product';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { LoadError } from '../../../shared/load-error/load-error';
import { QtyPipe, UsdPipe } from '../../../shared/money/money-pipes';
import { Pager } from '../../../shared/pager/pager';
import { asTree } from '../categories/categories';
import { ProductDialog, ProductDialogData } from './product-dialog';

type StockFilter = 'all' | 'reorder' | 'out';
type StatusFilter = 'active' | 'inactive' | 'all';

export interface ProductStatus {
  readonly label: string;
  readonly tone: 'ok' | 'low' | 'credit';
}

/** The one word the list shows for a product's state, most urgent first. */
export function statusOf(product: Product): ProductStatus {
  if (product.is_active === false) return { label: 'Inactive', tone: 'credit' };
  if (product.track_stock === false) return { label: 'Not tracked', tone: 'credit' };
  if (product.is_out_of_stock) return { label: 'Out of stock', tone: 'low' };
  if (product.needs_reorder) return { label: 'Reorder', tone: 'low' };
  return { label: 'Active', tone: 'ok' };
}

@Component({
  selector: 'app-products',
  imports: [HasScope, LoadError, Pager, QtyPipe, UsdPipe],
  templateUrl: './products.html',
})
export class Products {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);
  private readonly session = inject(SessionStore);

  protected readonly canEdit = this.session.hasAnyScope(['catalogue.edit']);
  protected readonly canSeeCost = this.session.hasAnyScope(['cost.view']);

  // The reference lists, for the filters and the form.
  protected readonly categories = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueCategoriesList({ page })),
  });
  protected readonly brands = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueBrandsList({ page })),
  });
  protected readonly units = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueUnitsList({ page })),
  });
  protected readonly listsReady = computed(
    () => this.categories.hasValue() && this.brands.hasValue() && this.units.hasValue(),
  );

  protected readonly search = signal('');
  protected readonly category = signal<number | null>(null);
  protected readonly brand = signal<number | null>(null);
  protected readonly stock = signal<StockFilter>('all');
  protected readonly status = signal<StatusFilter>('active');
  protected readonly page = signal(1);
  private readonly typed = new Subject<string>();

  private readonly query = computed<CatalogueProductsList$Params>(() => ({
    page: this.page(),
    search: this.search() || undefined,
    category: this.category() ?? undefined,
    brand: this.brand() ?? undefined,
    active: this.status() === 'all' ? undefined : this.status() === 'active' ? 'true' : 'false',
    below_reorder: this.stock() === 'reorder' ? 'true' : undefined,
    out_of_stock: this.stock() === 'out' ? 'true' : undefined,
  }));
  protected readonly products = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.catalogueProductsList(params),
  });
  /** The last page loaded, kept on screen while the next one comes, so the table does not flash. */
  protected readonly shown = linkedSignal<
    PaginatedProductList | undefined,
    PaginatedProductList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.products.hasValue() ? this.products.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        active: this.api.catalogueProductsList({ active: 'true' }),
        reorder: this.api.catalogueProductsList({ active: 'true', below_reorder: 'true' }),
        out: this.api.catalogueProductsList({ active: 'true', out_of_stock: 'true' }),
      }).pipe(map((r) => ({ active: r.active.count, reorder: r.reorder.count, out: r.out.count }))),
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

  constructor() {
    // Search as the user types, once they pause.
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

  protected setCategory(value: string): void {
    this.category.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected setBrand(value: string): void {
    this.brand.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected setStock(value: string): void {
    this.stock.set(value as StockFilter);
    this.page.set(1);
  }

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
    this.page.set(1);
  }

  protected statusOf(product: Product): ProductStatus {
    return statusOf(product);
  }

  /** The muted second line: model number and warranty, when there are any. */
  protected detail(product: Product): string {
    return [
      product.model_no,
      product.warranty_months ? `${product.warranty_months} months warranty` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected open(product: Product | null): void {
    if (!this.listsReady()) return;
    this.modal
      .open<'saved', ProductDialogData, ProductDialog>(ProductDialog, {
        data: {
          product,
          categories: this.categories.value()!,
          brands: this.brands.value()!,
          units: this.units.value()!,
          canSeeCost: this.canSeeCost,
        },
        wide: true,
        labelledBy: 'product-title',
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.products.reload();
        this.counts.reload();
      });
  }
}
