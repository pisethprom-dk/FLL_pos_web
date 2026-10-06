// v1.0.0 — Partners → Suppliers: who the shop buys from. Contact details
// only; what was paid lives on each stock-in. No tiles: the mockup's figures
// need stock-in totals the API does not give (owner's choice, 2026-10-05).
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { PartnersSuppliersList$Params } from '../../../api/fn/partners/partners-suppliers-list';
import { PaginatedSupplierList } from '../../../api/models/paginated-supplier-list';
import { Supplier } from '../../../api/models/supplier';
import { SupplierTypeEnum } from '../../../api/models/supplier-type-enum';
import { PartnersService } from '../../../api/services/partners.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { Modal } from '../../../shared/dialog/modal';
import { LoadError } from '../../../shared/load-error/load-error';
import { Pager } from '../../../shared/pager/pager';
import { SUPPLIER_TYPES, supplierTypeLabel } from '../partner-labels';
import { SupplierDialog } from './supplier-dialog';

type StatusFilter = 'active' | 'inactive' | 'all';

@Component({
  selector: 'app-suppliers',
  imports: [HasScope, LoadError, Pager],
  templateUrl: './suppliers.html',
})
export class Suppliers {
  private readonly api = inject(PartnersService);
  private readonly modal = inject(Modal);

  protected readonly canEdit = inject(SessionStore).hasAnyScope(['partner.edit']);
  protected readonly types = SUPPLIER_TYPES;
  protected readonly typeLabel = supplierTypeLabel;

  protected readonly search = signal('');
  protected readonly type = signal<SupplierTypeEnum | null>(null);
  protected readonly status = signal<StatusFilter>('active');
  protected readonly page = signal(1);
  private readonly typed = new Subject<string>();

  private readonly query = computed<PartnersSuppliersList$Params>(() => ({
    page: this.page(),
    search: this.search() || undefined,
    supplier_type: this.type() ?? undefined,
    active: this.status() === 'all' ? undefined : this.status() === 'active' ? 'true' : 'false',
  }));
  protected readonly suppliers = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.partnersSuppliersList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedSupplierList | undefined,
    PaginatedSupplierList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.suppliers.hasValue() ? this.suppliers.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  constructor() {
    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((words) => {
        this.search.set(words.trim());
        this.page.set(1);
      });
  }

  protected typeSearch(words: string): void {
    this.typed.next(words);
  }

  protected setType(value: string): void {
    this.type.set(value ? (value as SupplierTypeEnum) : null);
    this.page.set(1);
  }

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
    this.page.set(1);
  }

  protected open(supplier: Supplier | null): void {
    this.modal
      .open<'saved', Supplier | null, SupplierDialog>(SupplierDialog, {
        data: supplier,
        wide: true,
        labelledBy: 'supplier-title',
      })
      .closed.subscribe((result) => {
        if (result) this.suppliers.reload();
      });
  }
}
