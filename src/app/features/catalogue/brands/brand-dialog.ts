// v1.0.0 — add or change a brand, or deactivate it. Closes with 'saved'.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Brand } from '../../../api/models/brand';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { ImageChoice, ImageField, KEEP } from '../../../shared/image-field/image-field';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';

@Component({
  selector: 'app-brand-dialog',
  imports: [ReactiveFormsModule, ImageField],
  templateUrl: './brand-dialog.html',
})
export class BrandDialog {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);
  protected readonly brand = inject<Brand | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.brand?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    name_kh: [this.brand?.name_kh ?? '', Validators.maxLength(100)],
    country: [this.brand?.country ?? '', Validators.maxLength(60)],
    display_order: [this.brand?.display_order ?? 1, Validators.required],
    is_active: [this.brand?.is_active ?? true],
  });
  protected readonly logo = signal<ImageChoice>(KEEP);
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected pickLogo(choice: ImageChoice): void {
    this.logo.set(choice);
    dropFieldError(this.fieldErrors, 'logo');
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue();
    const logo = this.logo();
    const brand = this.brand;
    // A file has to go as multipart; taking the logo away is a plain null.
    let request: Observable<Brand>;
    if (logo.kind === 'replace') {
      request = brand
        ? this.api.catalogueBrandsPartialUpdate$FormData({
            id: brand.id,
            body: { ...body, logo: logo.file },
          })
        : this.api.catalogueBrandsCreate$FormData({ body: { ...body, logo: logo.file } });
    } else if (brand) {
      request = this.api.catalogueBrandsPartialUpdate$Json({
        id: brand.id,
        body: logo.kind === 'remove' ? { ...body, logo: null } : body,
      });
    } else {
      request = this.api.catalogueBrandsCreate$Json({ body });
    }
    this.send(request);
  }

  protected deactivate(): void {
    const brand = this.brand;
    if (!brand || this.busy()) return;
    confirm(this.modal, {
      title: `Deactivate ${brand.name}?`,
      message:
        'Products keep their brand, but it is no longer offered for new products. ' +
        'Tick Active here to bring it back.',
      confirmLabel: 'Deactivate',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.send(
          this.api.catalogueBrandsPartialUpdate$Json({ id: brand.id, body: { is_active: false } }),
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
