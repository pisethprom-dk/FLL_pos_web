// v1.0.0 — Catalogue → Units: piece, set, box of 100, metre. Not in the
// mockup; added with the catalogue (owner's choice, 2026-10-05).
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Unit } from '../../../api/models/unit';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { LoadError } from '../../../shared/load-error/load-error';
import { UnitDialog } from './unit-dialog';

@Component({
  selector: 'app-units',
  imports: [HasScope, LoadError],
  templateUrl: './units.html',
})
export class Units {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);

  protected readonly units = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueUnitsList({ page })),
  });
  protected readonly canEdit = inject(SessionStore).hasAnyScope(['catalogue.edit']);
  protected readonly search = signal('');

  // value() throws while the resource is in error; hasValue() does not.
  private readonly all = computed(() => (this.units.hasValue() ? this.units.value() : []));
  protected readonly rows = computed(() => {
    const words = this.search().trim().toLowerCase();
    if (!words) return this.all();
    return this.all().filter((u) =>
      [u.code, u.name, u.name_kh ?? ''].some((text) => text.toLowerCase().includes(words)),
    );
  });
  protected readonly activeCount = computed(
    () => this.all().filter((u) => u.is_active !== false).length,
  );

  protected open(unit: Unit | null): void {
    this.modal
      .open<'saved', Unit | null, UnitDialog>(UnitDialog, { data: unit, labelledBy: 'unit-title' })
      .closed.subscribe((result) => {
        if (result) this.units.reload();
      });
  }
}
