// v1.0.0 — add or change a store customer, or deactivate one. For an
// existing customer the Credit section shows what they owe now, read from the
// sales account (owner's choice, 2026-10-05) — worked out by the server.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Customer } from '../../../api/models/customer';
import { PriceTierEnum } from '../../../api/models/price-tier-enum';
import { PartnersService } from '../../../api/services/partners.service';
import { SalesService } from '../../../api/services/sales.service';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { Modal } from '../../../shared/dialog/modal';
import { UsdPipe } from '../../../shared/money/money-pipes';
import { clearOnEdit } from '../../../shared/server-errors';
import { PRICE_TIERS } from '../partner-labels';

/** Dollars and cents, no sign and no commas. */
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;
const WHOLE = /^\d+$/;

@Component({
  selector: 'app-customer-dialog',
  imports: [ReactiveFormsModule, UsdPipe],
  templateUrl: './customer-dialog.html',
})
export class CustomerDialog {
  private readonly api = inject(PartnersService);
  private readonly sales = inject(SalesService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly customer = inject<Customer | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly tiers = PRICE_TIERS;

  /** What the customer owes now. A new customer has no id, so it stays idle; a failure hides it. */
  protected readonly account = rxResource({
    params: () => this.customer?.id,
    stream: ({ params: id }) => this.sales.salesCustomersAccountRetrieve({ id }),
  });

  protected readonly form = this.fb.group({
    // Core
    code: [this.customer?.code ?? '', Validators.maxLength(20)],
    price_tier: this.fb.control<PriceTierEnum>(this.customer?.price_tier ?? 'RETAIL'),
    name: [this.customer?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    name_kh: [this.customer?.name_kh ?? '', Validators.maxLength(150)],
    short_name: [this.customer?.short_name ?? '', Validators.maxLength(60)],
    display_order: [this.customer?.display_order ?? 1, Validators.required],
    is_active: [this.customer?.is_active ?? true],
    // Contact
    contact_person: [this.customer?.contact_person ?? '', Validators.maxLength(100)],
    position: [this.customer?.position ?? '', Validators.maxLength(100)],
    phone: [this.customer?.phone ?? '', Validators.maxLength(30)],
    phone_alt: [this.customer?.phone_alt ?? '', Validators.maxLength(30)],
    telegram: [this.customer?.telegram ?? '', Validators.maxLength(60)],
    email: [this.customer?.email ?? '', [Validators.email, Validators.maxLength(254)]],
    // Address
    address: [this.customer?.address ?? '', Validators.maxLength(250)],
    district: [this.customer?.district ?? '', Validators.maxLength(100)],
    province: [this.customer?.province ?? '', Validators.maxLength(100)],
    country: [this.customer?.country ?? 'Cambodia', Validators.maxLength(60)],
    // Credit
    allow_credit: [this.customer?.allow_credit ?? false],
    credit_limit: [
      this.customer?.credit_limit ?? '0.00',
      [Validators.required, Validators.pattern(MONEY)],
    ],
    payment_terms_days: [
      this.customer?.allow_credit ? (this.customer.payment_terms_days ?? 0) : 30,
      [Validators.required, Validators.pattern(WHOLE)],
    ],
    credit_hold: [this.customer?.credit_hold ?? false],
    // Notes
    notes: [this.customer?.notes ?? ''],
  });
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
    // Credit off means off: the server clears limit, terms and hold, so they lock.
    this.applyCredit(this.form.controls.allow_credit.value);
    this.form.controls.allow_credit.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((allowed) => this.applyCredit(allowed));
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = { ...v, code: v.code.trim(), payment_terms_days: Number(v.payment_terms_days) };
    const customer = this.customer;
    this.send(
      customer
        ? this.api.partnersCustomersPartialUpdate$Json({ id: customer.id, body })
        : this.api.partnersCustomersCreate$Json({ body }),
    );
  }

  protected deactivate(): void {
    const customer = this.customer;
    if (!customer || this.busy()) return;
    confirm(this.modal, {
      title: `Deactivate ${customer.name}?`,
      message:
        'They can no longer be chosen for a new sale or quotation. Their invoices and payments ' +
        'stay, and you can tick Active here to bring them back.',
      confirmLabel: 'Deactivate',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.send(
          this.api.partnersCustomersPartialUpdate$Json({
            id: customer.id,
            body: { is_active: false },
          }),
        );
      }
    });
  }

  private applyCredit(allowed: boolean): void {
    for (const field of ['credit_limit', 'payment_terms_days', 'credit_hold'] as const) {
      const control = this.form.controls[field];
      if (allowed) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
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
