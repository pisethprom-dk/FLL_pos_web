// v1.0.0 — add or change a category, or deactivate it. Only a top-level
// category can be a parent; one with sub-categories stays top level.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Category } from '../../../api/models/category';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { ImageChoice, ImageField, KEEP } from '../../../shared/image-field/image-field';
import { forMultipart } from '../../../shared/multipart';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';

export interface CategoryDialogData {
  /** The category to change, or null for a new one. */
  readonly category: Category | null;
  /** Every category, for the parent list. */
  readonly all: readonly Category[];
  /** It has sub-categories, so it must stay top level. */
  readonly hasChildren: boolean;
}

@Component({
  selector: 'app-category-dialog',
  imports: [ReactiveFormsModule, ImageField],
  templateUrl: './category-dialog.html',
})
export class CategoryDialog {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly data = inject<CategoryDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly category = this.data.category;

  /** Active top-level categories, not this one — plus the current parent, whatever its state. */
  protected readonly parents = this.data.all.filter(
    (c) =>
      c.parent == null &&
      c.id !== this.category?.id &&
      (c.is_active !== false || c.id === this.category?.parent),
  );

  protected readonly form = this.fb.group({
    code: [this.category?.code ?? '', [Validators.required, Validators.maxLength(20)]],
    display_order: [this.category?.display_order ?? 1, Validators.required],
    name: [this.category?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    name_kh: [this.category?.name_kh ?? '', Validators.maxLength(100)],
    // A category with sub-categories cannot be moved under another.
    parent: this.fb.control<number | null>({
      value: this.category?.parent ?? null,
      disabled: this.data.hasChildren,
    }),
    description: [this.category?.description ?? '', Validators.maxLength(250)],
    is_active: [this.category?.is_active ?? true],
  });
  protected readonly image = signal<ImageChoice>(KEEP);
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected pickImage(choice: ImageChoice): void {
    this.image.set(choice);
    dropFieldError(this.fieldErrors, 'image');
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue();
    const image = this.image();
    const category = this.category;
    // A file has to go as multipart; taking the image away is a plain null.
    let request: Observable<Category>;
    if (image.kind === 'replace') {
      const upload = { ...forMultipart(body), image: image.file };
      request = category
        ? this.api.catalogueCategoriesPartialUpdate$FormData({ id: category.id, body: upload })
        : this.api.catalogueCategoriesCreate$FormData({ body: upload });
    } else if (category) {
      request = this.api.catalogueCategoriesPartialUpdate$Json({
        id: category.id,
        body: image.kind === 'remove' ? { ...body, image: null } : body,
      });
    } else {
      request = this.api.catalogueCategoriesCreate$Json({ body });
    }
    this.send(request);
  }

  protected deactivate(): void {
    const category = this.category;
    if (!category || this.busy()) return;
    confirm(this.modal, {
      title: `Deactivate ${category.name}?`,
      message:
        'Products in it keep it, but it is no longer offered for new products. ' +
        'Tick Active here to bring it back.',
      confirmLabel: 'Deactivate',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.send(
          this.api.catalogueCategoriesPartialUpdate$Json({
            id: category.id,
            body: { is_active: false },
          }),
        );
      }
    });
  }

  private send(request: Observable<unknown>): void {
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    request.subscribe({
      next: () => this.ref.close('saved'),
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.formErrors.set(form);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }
}
