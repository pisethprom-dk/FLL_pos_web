// v1.0.0 — Partners → Supplier products: which supplier carries which product,
// under their own code and their usual pack. Not in the mockup; built with the
// stock screens (owner's choice, 2026-10-05), because a stock-in from that
// supplier fills its pack in from here. No prices: what was paid lives on each
// stock-in line.
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PartnersProductSuppliersList$Params } from '../../../api/fn/partners/partners-product-suppliers-list';
import { PaginatedProductSupplierList } from '../../../api/models/paginated-product-supplier-list';
import { ProductSupplier } from '../../../api/models/product-supplier';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { PartnersService } from '../../../api/services/partners.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { LoadError } from '../../../shared/load-error/load-error';
import { formatQty } from '../../../shared/money/money-pipes';
import { Pager } from '../../../shared/pager/pager';
import { ProductSupplierDialog, ProductSupplierDialogData } from './product-supplier-dialog';

/** "Carton of 24"; a product bought one at a time in its own unit shows that unit. */
export function packLabel(link: ProductSupplier): string {
  if (link.pack_unit_name) return `${link.pack_unit_name} of ${formatQty(link.pack_size ?? '1')}`;
  return link.unit_name;
}

@Component({
  selector: 'app-supplier-products',
  imports: [HasScope, LoadError, Pager],
  templateUrl: './supplier-products.html',
})
export class SupplierProducts {
  private readonly api = inject(PartnersService);
  private readonly catalogue = inject(CatalogueService);
  private readonly modal = inject(Modal);

  protected readonly canEdit = inject(SessionStore).hasAnyScope(['partner.edit']);
  protected readonly packLabel = packLabel;

  // Every supplier for the filter, retired ones too: their links stay.
  protected readonly suppliers = rxResource({
    stream: () => fetchAll((page) => this.api.partnersSuppliersList({ page })),
  });
  protected readonly units = rxResource({
    stream: () => fetchAll((page) => this.catalogue.catalogueUnitsList({ page, active: 'true' })),
  });
  protected readonly listsReady = computed(
    () => this.suppliers.hasValue() && this.units.hasValue(),
  );

  protected readonly supplier = signal<number | null>(null);
  protected readonly preferredOnly = signal(false);
  protected readonly page = signal(1);

  private readonly query = computed<PartnersProductSuppliersList$Params>(() => ({
    page: this.page(),
    supplier: this.supplier() ?? undefined,
    preferred: this.preferredOnly() ? 'true' : undefined,
  }));
  protected readonly links = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.partnersProductSuppliersList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedProductSupplierList | undefined,
    PaginatedProductSupplierList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.links.hasValue() ? this.links.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected setSupplier(value: string): void {
    this.supplier.set(value ? Number(value) : null);
    this.page.set(1);
  }

  protected setPreferred(value: string): void {
    this.preferredOnly.set(value === 'preferred');
    this.page.set(1);
  }

  protected open(link: ProductSupplier | null): void {
    if (!this.listsReady()) return;
    this.modal
      .open<'saved', ProductSupplierDialogData, ProductSupplierDialog>(ProductSupplierDialog, {
        data: {
          link,
          // A new link may only name an active supplier; the filter's choice comes first.
          suppliers: this.suppliers.value()!.filter((s) => s.is_active !== false),
          units: this.units.value()!,
          supplier: this.supplier(),
        },
        wide: true,
        labelledBy: 'link-title',
      })
      .closed.subscribe((result) => {
        if (result) this.links.reload();
      });
  }
}
