// v1.0.0 — add or change a unit, or switch it off. Closes with 'saved'.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Unit } from '../../../api/models/unit';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { clearOnEdit } from '../../../shared/server-errors';

@Component({
  selector: 'app-unit-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './unit-dialog.html',
})
export class UnitDialog {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);
  protected readonly unit = inject<Unit | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    code: [this.unit?.code ?? '', [Validators.required, Validators.maxLength(20)]],
    name: [this.unit?.name ?? '', [Validators.required, Validators.maxLength(50)]],
    name_kh: [this.unit?.name_kh ?? '', Validators.maxLength(50)],
    display_order: [this.unit?.display_order ?? 1, Validators.required],
    is_active: [this.unit?.is_active ?? true],
  });
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue();
    this.send(
      this.unit
        ? this.api.catalogueUnitsPartialUpdate$Json({ id: this.unit.id, body })
        : this.api.catalogueUnitsCreate$Json({ body }),
    );
  }

  protected deactivate(): void {
    const unit = this.unit;
    if (!unit || this.busy()) return;
    confirm(this.modal, {
      title: `Deactivate ${unit.name}?`,
      message:
        'It stays on the products and documents that use it, but is no longer offered for new ' +
        'products. Tick Active here to bring it back.',
      confirmLabel: 'Deactivate',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.send(
          this.api.catalogueUnitsPartialUpdate$Json({ id: unit.id, body: { is_active: false } }),
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
