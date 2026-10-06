// v1.0.0 — Catalogue → Brands. A record of its own because customers ask for
// tools by brand.
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Brand } from '../../../api/models/brand';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { LoadError } from '../../../shared/load-error/load-error';
import { BrandDialog } from './brand-dialog';

@Component({
  selector: 'app-brands',
  imports: [HasScope, LoadError],
  templateUrl: './brands.html',
})
export class Brands {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);

  protected readonly brands = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueBrandsList({ page })),
  });
  protected readonly canEdit = inject(SessionStore).hasAnyScope(['catalogue.edit']);
  protected readonly search = signal('');

  // value() throws while the resource is in error; hasValue() does not.
  private readonly all = computed(() => (this.brands.hasValue() ? this.brands.value() : []));
  protected readonly rows = computed(() => {
    const words = this.search().trim().toLowerCase();
    if (!words) return this.all();
    return this.all().filter((b) =>
      [b.name, b.name_kh ?? '', b.country ?? ''].some((text) => text.toLowerCase().includes(words)),
    );
  });
  protected readonly activeCount = computed(
    () => this.all().filter((b) => b.is_active !== false).length,
  );

  protected open(brand: Brand | null): void {
    this.modal
      .open<'saved', Brand | null, BrandDialog>(BrandDialog, {
        data: brand,
        labelledBy: 'brand-title',
      })
      .closed.subscribe((result) => {
        if (result) this.brands.reload();
      });
  }
}
