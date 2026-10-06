// v1.0.0 — add or change one supplier–product link, or remove it. A link
// carries no history, so unlike a supplier or a product it can be deleted.
// Its pack (unit and size) is what a stock-in line from this supplier starts
// with; the line keeps its own copy, so changing it here alters no document.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ProductLookup } from '../../../api/models/product-lookup';
import { ProductSupplier } from '../../../api/models/product-supplier';
import { Supplier } from '../../../api/models/supplier';
import { Unit } from '../../../api/models/unit';
import { PartnersService } from '../../../api/services/partners.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { plainDecimal } from '../../../shared/money/decimal';
import { ProductPicker } from '../../../shared/product-picker/product-picker';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';
import { QTY, positive } from '../../stock/stock-common';

export interface ProductSupplierDialogData {
  readonly link: ProductSupplier | null;
  /** Active suppliers: a new link may only name one of these. */
  readonly suppliers: readonly Supplier[];
  readonly units: readonly Unit[];
  /** The supplier the list is filtered to, chosen first for a new link. */
  readonly supplier: number | null;
}

interface ChosenProduct {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly unit_name: string;
}

@Component({
  selector: 'app-product-supplier-dialog',
  imports: [ReactiveFormsModule, ProductPicker],
  templateUrl: './product-supplier-dialog.html',
})
export class ProductSupplierDialog {
  private readonly api = inject(PartnersService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly data = inject<ProductSupplierDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly link = this.data.link;

  protected readonly product = signal<ChosenProduct | null>(
    this.link
      ? {
          id: this.link.product,
          code: this.link.product_code,
          name: this.link.product_name,
          unit_name: this.link.unit_name,
        }
      : null,
  );
  protected readonly productMissing = signal(false);

  private readonly startSupplier =
    this.link?.supplier ??
    (this.data.suppliers.some((s) => s.id === this.data.supplier) ? this.data.supplier : null);

  protected readonly form = this.fb.group({
    supplier: this.fb.control<number | null>(this.startSupplier, Validators.required),
    supplier_sku: [this.link?.supplier_sku ?? '', Validators.maxLength(60)],
    pack_unit: this.fb.control<number | null>(this.link?.pack_unit ?? null),
    pack_size: [plainDecimal(this.link?.pack_size ?? '1'), positive(QTY)],
    is_preferred: [this.link?.is_preferred ?? false],
    notes: [this.link?.notes ?? ''],
  });
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
    // The pair is fixed once linked: to move a product, remove the link and add another.
    if (this.link) this.form.controls.supplier.disable({ emitEvent: false });
    this.applyPack(this.form.controls.pack_unit.value, false);
    this.form.controls.pack_unit.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((unit) => this.applyPack(unit, true));
  }

  /** The units a pack can be: any but the product's own, which is the "one at a time" choice. */
  protected packUnits(): readonly Unit[] {
    const own = this.product()?.unit_name;
    return this.data.units.filter((u) => u.name !== own);
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected pick(product: ProductLookup): void {
    this.product.set({
      id: product.id,
      code: product.code,
      name: product.name,
      unit_name: product.unit_name,
    });
    this.productMissing.set(false);
    dropFieldError(this.fieldErrors, 'product');
  }

  protected save(): void {
    if (this.busy()) return;
    const product = this.product();
    this.productMissing.set(!product);
    if (this.form.invalid || !product) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const fields = {
      supplier_sku: v.supplier_sku.trim(),
      pack_unit: v.pack_unit,
      pack_size: v.pack_size,
      is_preferred: v.is_preferred,
      notes: v.notes,
    };
    const link = this.link;
    this.send(
      link
        ? this.api.partnersProductSuppliersPartialUpdate$Json({ id: link.id, body: fields })
        : this.api.partnersProductSuppliersCreate$Json({
            body: { ...fields, product: product.id, supplier: v.supplier! },
          }),
    );
  }

  protected remove(): void {
    const link = this.link;
    if (!link || this.busy()) return;
    confirm(this.modal, {
      title: `Remove ${link.supplier_name} for ${link.product_code}?`,
      message:
        'Past stock-ins keep the pack they were received in. A new stock-in from this supplier ' +
        'will no longer fill a pack in for this product.',
      confirmLabel: 'Remove link',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) this.send(this.api.partnersProductSuppliersDestroy({ id: link.id }));
    });
  }

  /** One at a time in the product's own unit means a pack of exactly one. */
  private applyPack(unit: number | null, byUser: boolean): void {
    const size = this.form.controls.pack_size;
    if (unit === null) {
      if (byUser || size.value === '1') {
        size.setValue('1', { emitEvent: false });
        size.disable({ emitEvent: false });
      }
    } else {
      size.enable({ emitEvent: false });
    }
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
