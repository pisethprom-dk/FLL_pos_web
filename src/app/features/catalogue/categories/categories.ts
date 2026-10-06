// v1.0.0 — Catalogue → Categories. Two levels only: each group followed by
// its sub-categories, indented.
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Category } from '../../../api/models/category';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { LoadError } from '../../../shared/load-error/load-error';
import { CategoryDialog, CategoryDialogData } from './category-dialog';

type Show = 'all' | 'top' | 'inactive';

/** Each top-level category followed by its sub-categories, in the API's order. */
export function asTree(all: readonly Category[]): Category[] {
  const tops = all.filter((c) => c.parent == null);
  const ids = new Set(tops.map((c) => c.id));
  const orphans = all.filter((c) => c.parent != null && !ids.has(c.parent));
  return [...tops.flatMap((top) => [top, ...all.filter((c) => c.parent === top.id)]), ...orphans];
}

@Component({
  selector: 'app-categories',
  imports: [HasScope, LoadError],
  templateUrl: './categories.html',
})
export class Categories {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);

  protected readonly categories = rxResource({
    stream: () => fetchAll((page) => this.api.catalogueCategoriesList({ page })),
  });
  protected readonly canEdit = inject(SessionStore).hasAnyScope(['catalogue.edit']);
  protected readonly show = signal<Show>('all');
  protected readonly search = signal('');

  // value() throws while the resource is in error; hasValue() does not.
  private readonly all = computed(() =>
    this.categories.hasValue() ? this.categories.value() : [],
  );
  protected readonly rows = computed(() => {
    const words = this.search().trim().toLowerCase();
    return asTree(this.all()).filter((c) => {
      if (this.show() === 'top' && c.parent != null) return false;
      if (this.show() === 'inactive' && c.is_active !== false) return false;
      if (!words) return true;
      return [c.code, c.name, c.name_kh ?? '', c.parent_name ?? ''].some((text) =>
        text.toLowerCase().includes(words),
      );
    });
  });
  protected readonly topCount = computed(() => this.all().filter((c) => c.parent == null).length);

  protected open(category: Category | null): void {
    const all = this.all();
    this.modal
      .open<'saved', CategoryDialogData, CategoryDialog>(CategoryDialog, {
        data: {
          category,
          all,
          hasChildren: category ? all.some((c) => c.parent === category.id) : false,
        },
        labelledBy: 'category-title',
      })
      .closed.subscribe((result) => {
        if (result) this.categories.reload();
      });
  }
}
