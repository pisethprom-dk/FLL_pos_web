// v1.0.0 — add or change a product, or deactivate it. Stock and average cost
// are shown, never typed: they belong to the stock ledger. Prices are typed
// and sent as text; nothing here does arithmetic on money.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Brand } from '../../../api/models/brand';
import { Category } from '../../../api/models/category';
import { Product } from '../../../api/models/product';
import { ProductRequest } from '../../../api/models/product-request';
import { Unit } from '../../../api/models/unit';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { ImageChoice, ImageField, KEEP } from '../../../shared/image-field/image-field';
import { QtyPipe, UsdPipe } from '../../../shared/money/money-pipes';
import { forMultipart } from '../../../shared/multipart';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';
import { asTree } from '../categories/categories';

export interface ProductDialogData {
  /** The product to change, or null for a new one. */
  readonly product: Product | null;
  readonly categories: readonly Category[];
  readonly brands: readonly Brand[];
  readonly units: readonly Unit[];
  /** Admin only: the average cost is shown. */
  readonly canSeeCost: boolean;
}

/** Dollars and cents, no sign and no commas — what the backend stores. */
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;
/** A quantity: up to two decimals. */
const QTY = /^\d{1,10}(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;

/** "6.00" → "6", for typing over; the server sends the full scale. */
function plain(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

@Component({
  selector: 'app-product-dialog',
  imports: [ReactiveFormsModule, ImageField, QtyPipe, UsdPipe],
  templateUrl: './product-dialog.html',
})
export class ProductDialog {
  private readonly api = inject(CatalogueService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly data = inject<ProductDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly product = this.data.product;

  // Choices: the active ones, plus whatever the product has now even if it has
  // since been switched off, so opening it never quietly changes it.
  protected readonly categoryOptions = asTree(this.data.categories)
    .filter((c) => c.is_active !== false || c.id === this.product?.category)
    .map((c) => ({ id: c.id, label: c.full_name }));
  protected readonly brandOptions = this.data.brands.filter(
    (b) => b.is_active !== false || b.id === this.product?.brand,
  );
  protected readonly unitOptions = this.data.units.filter(
    (u) => u.is_active !== false || u.id === this.product?.unit,
  );

  protected readonly form = this.fb.group({
    // Identity
    code: [this.product?.code ?? '', [Validators.required, Validators.maxLength(30)]],
    barcode: [this.product?.barcode ?? '', Validators.maxLength(30)],
    name: [this.product?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    name_kh: [this.product?.name_kh ?? '', Validators.maxLength(200)],
    short_name: [this.product?.short_name ?? '', Validators.maxLength(60)],
    category: this.fb.control<number | null>(this.product?.category ?? null, Validators.required),
    brand: this.fb.control<number | null>(this.product?.brand ?? null),
    model_no: [this.product?.model_no ?? '', Validators.maxLength(60)],
    description: [this.product?.description ?? ''],
    // Selling
    unit: this.fb.control<number | null>(
      this.product?.unit ?? this.unitOptions[0]?.id ?? null,
      Validators.required,
    ),
    retail_price: [
      this.product?.retail_price ?? '0.00',
      [Validators.required, Validators.pattern(MONEY)],
    ],
    wholesale_price: [
      this.product?.wholesale_price ?? '0.00',
      [Validators.required, Validators.pattern(MONEY)],
    ],
    is_price_fixed: [this.product?.is_price_fixed ?? false],
    // Stock
    track_stock: [this.product?.track_stock ?? true],
    reorder_level: [
      plain(this.product?.reorder_level ?? '0'),
      [Validators.required, Validators.pattern(QTY)],
    ],
    reorder_qty: [
      plain(this.product?.reorder_qty ?? '0'),
      [Validators.required, Validators.pattern(QTY)],
    ],
    shelf_location: [this.product?.shelf_location ?? '', Validators.maxLength(20)],
    // Tool details
    warranty_months: [
      this.product?.warranty_months ?? 0,
      [Validators.required, Validators.pattern(WHOLE)],
    ],
    origin_country: [this.product?.origin_country ?? '', Validators.maxLength(60)],
    // Other
    notes: [this.product?.notes ?? ''],
    is_active: [this.product?.is_active ?? true],
  });
  protected readonly image = signal<ImageChoice>(KEEP);
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
    // A product that does not track stock has no reorder level: the backend
    // refuses one, so the fields go to zero and lock.
    this.applyTracking(this.form.controls.track_stock.value);
    this.form.controls.track_stock.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((track) => this.applyTracking(track));
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
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
    const v = this.form.getRawValue();
    const body: ProductRequest = {
      ...v,
      category: v.category!,
      unit: v.unit!,
      barcode: v.barcode.trim() || null,
      warranty_months: Number(v.warranty_months),
    };
    const image = this.image();
    const product = this.product;
    // A file has to go as multipart; taking the image away is a plain null.
    let request: Observable<Product>;
    if (image.kind === 'replace') {
      const upload = { ...forMultipart(body), image: image.file };
      request = product
        ? this.api.catalogueProductsPartialUpdate$FormData({ id: product.id, body: upload })
        : this.api.catalogueProductsCreate$FormData({ body: upload });
    } else if (product) {
      request = this.api.catalogueProductsPartialUpdate$Json({
        id: product.id,
        body: image.kind === 'remove' ? { ...body, image: null } : body,
      });
    } else {
      request = this.api.catalogueProductsCreate$Json({ body });
    }
    this.send(request);
  }

  protected deactivate(): void {
    const product = this.product;
    if (!product || this.busy()) return;
    confirm(this.modal, {
      title: `Deactivate ${product.name}?`,
      message:
        'It can no longer be sold or put on a new document. Its history stays, and you can ' +
        'tick Active here to bring it back.',
      confirmLabel: 'Deactivate',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.send(
          this.api.catalogueProductsPartialUpdate$Json({
            id: product.id,
            body: { is_active: false },
          }),
        );
      }
    });
  }

  private applyTracking(track: boolean): void {
    for (const field of ['reorder_level', 'reorder_qty'] as const) {
      const control = this.form.controls[field];
      if (track) {
        control.enable({ emitEvent: false });
      } else {
        control.setValue('0', { emitEvent: false });
        control.disable({ emitEvent: false });
      }
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
