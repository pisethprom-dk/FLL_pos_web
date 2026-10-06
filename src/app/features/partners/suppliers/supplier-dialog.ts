// v1.0.0 — add or change a supplier, or deactivate one. A supplier switched
// off is hidden from new stock-ins; past stock-ins keep it.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Supplier } from '../../../api/models/supplier';
import { SupplierTypeEnum } from '../../../api/models/supplier-type-enum';
import { PartnersService } from '../../../api/services/partners.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { ImageChoice, ImageField, KEEP } from '../../../shared/image-field/image-field';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';
import { SUPPLIER_TYPES } from '../partner-labels';

@Component({
  selector: 'app-supplier-dialog',
  imports: [ReactiveFormsModule, ImageField],
  templateUrl: './supplier-dialog.html',
})
export class SupplierDialog {
  private readonly api = inject(PartnersService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly supplier = inject<Supplier | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly types = SUPPLIER_TYPES;

  protected readonly form = this.fb.group({
    // Core
    code: [this.supplier?.code ?? '', Validators.maxLength(20)],
    supplier_type: this.fb.control<SupplierTypeEnum | null>(
      this.supplier?.supplier_type ?? null,
      Validators.required,
    ),
    name: [this.supplier?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    name_kh: [this.supplier?.name_kh ?? '', Validators.maxLength(150)],
    short_name: [this.supplier?.short_name ?? '', Validators.maxLength(60)],
    display_order: [this.supplier?.display_order ?? 1, Validators.required],
    is_active: [this.supplier?.is_active ?? true],
    // Contact
    contact_person: [this.supplier?.contact_person ?? '', Validators.maxLength(100)],
    position: [this.supplier?.position ?? '', Validators.maxLength(100)],
    phone: [this.supplier?.phone ?? '', Validators.maxLength(30)],
    phone_alt: [this.supplier?.phone_alt ?? '', Validators.maxLength(30)],
    telegram: [this.supplier?.telegram ?? '', Validators.maxLength(60)],
    email: [this.supplier?.email ?? '', [Validators.email, Validators.maxLength(254)]],
    website: [this.supplier?.website ?? '', Validators.maxLength(200)],
    // Address
    address: [this.supplier?.address ?? '', Validators.maxLength(250)],
    district: [this.supplier?.district ?? '', Validators.maxLength(100)],
    province: [this.supplier?.province ?? '', Validators.maxLength(100)],
    country: [this.supplier?.country ?? 'Cambodia', Validators.maxLength(60)],
    // Notes
    notes: [this.supplier?.notes ?? ''],
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

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
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
    const v = this.form.getRawValue();
    const body = { ...v, code: v.code.trim(), supplier_type: v.supplier_type! };
    const logo = this.logo();
    const supplier = this.supplier;
    // A file has to go as multipart; taking the logo away is a plain null.
    let request: Observable<Supplier>;
    if (logo.kind === 'replace') {
      const upload = { ...body, logo: logo.file };
      request = supplier
        ? this.api.partnersSuppliersPartialUpdate$FormData({ id: supplier.id, body: upload })
        : this.api.partnersSuppliersCreate$FormData({ body: upload });
    } else if (supplier) {
      request = this.api.partnersSuppliersPartialUpdate$Json({
        id: supplier.id,
        body: logo.kind === 'remove' ? { ...body, logo: null } : body,
      });
    } else {
      request = this.api.partnersSuppliersCreate$Json({ body });
    }
    this.send(request);
  }

  protected deactivate(): void {
    const supplier = this.supplier;
    if (!supplier || this.busy()) return;
    confirm(this.modal, {
      title: `Deactivate ${supplier.name}?`,
      message:
        'They are hidden from new stock-ins; past stock-ins keep them. You can tick Active here ' +
        'to bring them back.',
      confirmLabel: 'Deactivate',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.send(
          this.api.partnersSuppliersPartialUpdate$Json({
            id: supplier.id,
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
