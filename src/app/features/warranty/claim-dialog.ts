// v1.0.0 — a warranty claim, new or edited. The product picker fills in the
// product's code, name and warranty months from the catalogue; each can then
// be typed over, and all are kept as text, so an item not in the catalogue can
// still be logged. Any status may follow any other. Only an Admin may delete
// a claim (`warranty.delete`); everyone else closes or rejects it instead.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ClaimStatusEnum } from '../../api/models/claim-status-enum';
import { ProductLookup } from '../../api/models/product-lookup';
import { WarrantyClaim } from '../../api/models/warranty-claim';
import { WarrantyService } from '../../api/services/warranty.service';
import { SessionStore } from '../../core/session/session-store';
import { readApiErrors } from '../../shared/api-errors';
import { dayOf, today } from '../../shared/dates';
import { confirm } from '../../shared/dialog/confirm-dialog';
import { Modal } from '../../shared/dialog/modal';
import { ProductPicker } from '../../shared/product-picker/product-picker';
import { clearOnEdit } from '../../shared/server-errors';
import { STATUSES } from './warranty-common';

/** Text that is there once trimmed. */
const SAID = Validators.pattern(/\S/);
/** Server refusals shown under their field; any other goes with the form's. */
const SHOWN = ['warranty_number', 'product_name'];

@Component({
  selector: 'app-claim-dialog',
  imports: [DatePipe, ProductPicker, ReactiveFormsModule],
  templateUrl: './claim-dialog.html',
})
export class ClaimDialog {
  private readonly api = inject(WarrantyService);
  private readonly modal = inject(Modal);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly claim = inject<WarrantyClaim | null>(DIALOG_DATA);
  protected readonly canDelete =
    !!this.claim && inject(SessionStore).hasAnyScope(['warranty.delete']);
  protected readonly statuses = STATUSES;

  protected readonly form = inject(NonNullableFormBuilder).group({
    warranty_number: [
      this.claim?.warranty_number ?? '',
      [Validators.required, SAID, Validators.maxLength(40)],
    ],
    product_code: [this.claim?.product_code ?? '', Validators.maxLength(30)],
    product_name: [
      this.claim?.product_name ?? '',
      [Validators.required, SAID, Validators.maxLength(200)],
    ],
    warranty_months: [
      String(this.claim?.warranty_months ?? 0),
      [Validators.required, Validators.pattern(/^\d{1,3}$/), Validators.max(120)],
    ],
    expiry_date: [this.claim?.expiry_date ?? ''],
    customer_name: [this.claim?.customer_name ?? '', Validators.maxLength(150)],
    customer_phone: [this.claim?.customer_phone ?? '', Validators.maxLength(30)],
    status: [(this.claim?.status ?? 'RECEIVED') as ClaimStatusEnum],
    note: [this.claim?.note ?? ''],
  });
  private readonly expiry = toSignal(this.form.controls.expiry_date.valueChanges, {
    initialValue: this.form.controls.expiry_date.value,
  });
  /** The day the claim was logged — today for a new one. */
  private readonly loggedOn = this.claim ? dayOf(this.claim.created_at) : today();
  /** Warned as it is typed; the server's flag is what the list shows. */
  protected readonly outOfWarranty = computed(() => {
    const expiry = this.expiry();
    return !!expiry && expiry < this.loggedOn;
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

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  /** A product chosen from the catalogue fills in what the claim says about it. */
  protected use(product: ProductLookup): void {
    this.form.patchValue({
      product_code: product.code,
      product_name: product.name,
      warranty_months: String(product.warranty_months ?? 0),
    });
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      ...v,
      warranty_months: Number(v.warranty_months),
      expiry_date: v.expiry_date || null,
    };
    this.send(
      this.claim
        ? this.api.warrantyClaimsPartialUpdate$Json({ id: this.claim.id, body })
        : this.api.warrantyClaimsCreate$Json({ body }),
    );
  }

  protected deleteClaim(): void {
    const claim = this.claim;
    if (!claim || this.busy()) return;
    confirm(this.modal, {
      title: `Delete the claim on ${claim.warranty_number}?`,
      message:
        'For a claim logged by mistake. It is removed for good; a claim that was real is ' +
        'closed or rejected instead.',
      confirmLabel: 'Delete claim',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) this.send(this.api.warrantyClaimsDestroy({ id: claim.id }));
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
        const elsewhere = Object.entries(fields).filter(([field]) => !SHOWN.includes(field));
        this.formErrors.set([...form, ...elsewhere.flatMap(([, messages]) => messages)]);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }
}
