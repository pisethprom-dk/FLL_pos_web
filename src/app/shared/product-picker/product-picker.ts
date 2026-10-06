// v1.0.0 — choosing a product for a document line: the mockup's Brand →
// Category → Product bar, plus a box that takes a scanned barcode or a typed
// code and adds the product on Enter (the backend's known gap: no barcode
// entry on stock-in). Brand and category each narrow the list, alone or
// together. Only active products are offered; with stockOnly, only those that
// track stock.
import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ProductLookup } from '../../api/models/product-lookup';
import { CatalogueService } from '../../api/services/catalogue.service';
import { asTree } from '../../features/catalogue/categories/categories';
import { readApiErrors } from '../api-errors';
import { fetchAll } from '../fetch-all';

/** The lookup stops at 50; a full list means there may be more. */
const LOOKUP_LIMIT = 50;

@Component({
  selector: 'app-product-picker',
  templateUrl: './product-picker.html',
})
export class ProductPicker {
  private readonly api = inject(CatalogueService);

  /** Only products that track stock — what a stock document can hold. */
  readonly stockOnly = input(true);
  readonly disabled = input(false);
  /** Why the picker is off, e.g. "Choose the supplier first." */
  readonly hint = input('');
  readonly addLabel = input('Add product');
  readonly picked = output<ProductLookup>();

  protected readonly brands = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueBrandsList({ page, active: 'true' })),
  });
  protected readonly categories = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueCategoriesList({ page, active: 'true' })),
  });
  protected readonly categoryOptions = computed(() =>
    asTree(this.categories.hasValue() ? this.categories.value() : []).map((c) => ({
      id: c.id,
      label: c.parent == null ? c.name : `— ${c.name}`,
    })),
  );

  protected readonly brand = signal<number | null>(null);
  protected readonly category = signal<number | null>(null);
  /** What a search found when it matched no single product exactly. */
  protected readonly found = signal<ProductLookup[] | null>(null);
  protected readonly message = signal('');
  protected readonly searching = signal(false);

  private readonly narrowed = rxResource({
    params: () =>
      this.brand() === null && this.category() === null
        ? undefined
        : { brand: this.brand() ?? undefined, category: this.category() ?? undefined },
    stream: ({ params }) => this.api.catalogueProductsLookupList(params),
  });

  private readonly fetched = computed(
    () => this.found() ?? (this.narrowed.hasValue() ? this.narrowed.value() : []),
  );
  protected readonly options = computed(() =>
    this.stockOnly() ? this.fetched().filter((p) => p.track_stock !== false) : this.fetched(),
  );
  protected readonly capped = computed(() => this.fetched().length >= LOOKUP_LIMIT);
  /** The product chosen in the list; a new list starts with none. */
  protected readonly chosen = linkedSignal<ProductLookup[], number | null>({
    source: this.options,
    computation: () => null,
  });

  protected label(product: ProductLookup): string {
    return [product.name, product.model_no, product.code].filter(Boolean).join(' · ');
  }

  protected setBrand(value: string): void {
    this.brand.set(value ? Number(value) : null);
    this.found.set(null);
    this.message.set('');
  }

  protected setCategory(value: string): void {
    this.category.set(value ? Number(value) : null);
    this.found.set(null);
    this.message.set('');
  }

  protected choose(value: string): void {
    this.chosen.set(value ? Number(value) : null);
  }

  protected add(): void {
    const product = this.options().find((p) => p.id === this.chosen());
    if (!product || this.disabled()) return;
    this.picked.emit(product);
    this.chosen.set(null);
  }

  /** Enter in the code box: an exact barcode or code adds the product at once. */
  protected scan(box: HTMLInputElement): void {
    const text = box.value.trim();
    if (!text || this.disabled() || this.searching()) return;
    this.searching.set(true);
    this.message.set('');
    this.api.catalogueProductsLookupList({ search: text }).subscribe({
      next: (list) => {
        this.searching.set(false);
        const exact = list.find(
          (p) => p.barcode === text || p.code.toUpperCase() === text.toUpperCase(),
        );
        if (exact && this.stockOnly() && exact.track_stock === false) {
          this.message.set(`${exact.code} ${exact.name} does not track stock.`);
          return;
        }
        if (exact) {
          this.picked.emit(exact);
          this.found.set(null);
          box.value = '';
          return;
        }
        const usable = this.stockOnly() ? list.filter((p) => p.track_stock !== false) : list;
        if (usable.length === 0) {
          this.found.set(null);
          this.message.set(`Nothing matches “${text}”.`);
          return;
        }
        this.found.set(list);
        this.message.set(
          usable.length === 1
            ? `One product matches “${text}” — choose it from the list.`
            : `${usable.length} products match “${text}” — choose one from the list.`,
        );
      },
      error: (error: unknown) => {
        this.searching.set(false);
        this.message.set(readApiErrors(error).form[0] ?? 'The search failed. Try again.');
      },
    });
  }
}
