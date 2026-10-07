// v1.1.0 — one quotation. While Draft or Sent its lines are edited here, each
// priced at the customer's tier with a preview worked out as the server will
// (shared/sales/sales-common.ts); once accepted it is read-only and shows what
// has been invoiced. A new quotation is created on its first save, which takes
// its number. Saving lines re-prices them at today's list price — the server
// does that, and the dialog says so. Print prints it as saved, on A4.
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Observable, of, switchMap, tap } from 'rxjs';
import { Customer } from '../../api/models/customer';
import { PriceTierEnum } from '../../api/models/price-tier-enum';
import { ProductLookup } from '../../api/models/product-lookup';
import { Quotation } from '../../api/models/quotation';
import { QuotationLine } from '../../api/models/quotation-line';
import { QuotationRequest } from '../../api/models/quotation-request';
import { SalesService } from '../../api/services/sales.service';
import { SessionStore } from '../../core/session/session-store';
import { readApiErrors } from '../../shared/api-errors';
import { today } from '../../shared/dates';
import { confirm } from '../../shared/dialog/confirm-dialog';
import { confirmDiscard, onDismiss } from '../../shared/dialog/guard-close';
import { Modal } from '../../shared/dialog/modal';
import { askReason } from '../../shared/dialog/reason-dialog';
import { Printer } from '../../shared/print/printer';
import { plainDecimal } from '../../shared/money/decimal';
import { compare, sum } from '../../shared/money/exact';
import { QtyPipe, UsdPipe } from '../../shared/money/money-pipes';
import { ProductPicker } from '../../shared/product-picker/product-picker';
import { DiscountType, PricedLine, priceLine, quoteState } from '../../shared/sales/sales-common';
import { clearOnEdit, dropFieldError } from '../../shared/server-errors';
import { tierLabel } from '../partners/partner-labels';
import { QTY, positive } from '../stock/stock-common';

export interface QuotationDialogData {
  readonly quote: Quotation | null;
  /** Active store customers: a new quotation may name only one of these. */
  readonly customers: readonly Customer[];
}

/** A discount: dollars and cents, or a percent to two places. Empty means none. */
const DISCOUNT = /^\d{1,8}(\.\d{1,2})?$/;

type LineForm = FormGroup<{
  quantity: FormControl<string>;
  discount_type: FormControl<DiscountType>;
  discount_value: FormControl<string>;
}>;

interface LineRow {
  readonly key: number;
  readonly product: number;
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  /** A line picked here: both list prices, so a change of customer re-prices it. */
  readonly prices: { readonly retail: string; readonly wholesale: string } | null;
  /** A saved line: the price the server stamped. */
  readonly stamped: string | null;
  /** is_price_fixed; null on a saved line, where the server decides. */
  readonly fixed: boolean | null;
  readonly form: LineForm;
  /** Saved figures, shown once the quote is read-only. */
  readonly saved: QuotationLine | null;
}

const SHOWN = ['customer', 'quote_date', 'valid_until', 'terms', 'note', 'lines'];

@Component({
  selector: 'app-quotation-dialog',
  imports: [DatePipe, ReactiveFormsModule, ProductPicker, QtyPipe, UsdPipe],
  templateUrl: './quotation-dialog.html',
})
export class QuotationDialog {
  private readonly api = inject(SalesService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  protected readonly canEdit = inject(SessionStore).hasAnyScope(['quotation.edit']);
  protected readonly data = inject<QuotationDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly tierLabel = tierLabel;
  protected readonly quoteState = quoteState;

  protected readonly quote = signal<Quotation | null>(this.data.quote);
  protected readonly status = computed(() => this.quote()?.status ?? 'DRAFT');
  protected readonly editable = computed(
    () => this.canEdit && (this.status() === 'DRAFT' || this.status() === 'SENT'),
  );

  protected readonly form = this.fb.group({
    customer: this.fb.control<number | null>(null, Validators.required),
    quote_date: [today(), Validators.required],
    valid_until: [''],
    terms: [''],
    note: [''],
  });
  private readonly customerId = toSignal(this.form.controls.customer.valueChanges, {
    initialValue: null,
  });
  /** The customer's price tier: stamped on a saved quote, else the chosen customer's. */
  protected readonly tier = computed<PriceTierEnum | null>(
    () =>
      this.quote()?.price_tier ??
      this.data.customers.find((c) => c.id === this.customerId())?.price_tier ??
      null,
  );
  protected readonly pickerHint = computed(() =>
    this.tier() === null ? 'Choose the customer first — their price tier sets the prices.' : '',
  );

  protected readonly rows = signal<LineRow[]>([]);
  private nextKey = 1;
  private linesChanged = false;
  private changed = false;

  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  private readonly printer = inject(Printer);
  protected readonly printing = signal(false);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly otherErrors = computed(() =>
    Object.entries(this.fieldErrors())
      .filter(([field]) => !SHOWN.includes(field))
      .flatMap(([, messages]) => messages),
  );

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
    onDismiss(this.ref, () => this.close());
    this.load(this.quote());
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected bad(control: FormControl<string>): boolean {
    return control.touched && control.invalid;
  }

  /** The unit price before discount: the stamped one, or the tier's list price. */
  protected price(row: LineRow): string | null {
    if (row.stamped !== null) return row.stamped;
    const tier = this.tier();
    if (!row.prices || !tier) return null;
    return tier === 'WHOLESALE' ? row.prices.wholesale : row.prices.retail;
  }

  protected priced(row: LineRow): PricedLine | null {
    const price = this.price(row);
    if (price === null) return null;
    const c = row.form.controls;
    return priceLine(
      price,
      c.quantity.invalid ? null : c.quantity.value,
      c.discount_type.value,
      c.discount_value.value,
      row.fixed,
    );
  }

  protected total(): string | null {
    const totals = this.rows().map((row) => this.priced(row)?.total ?? null);
    return totals.every((t) => t !== null) ? sum(totals as string[], 2) : null;
  }

  /** "5%", "$1.20 each" or "—", for a saved line. */
  protected discountText(line: QuotationLine): string {
    if (!line.discount_type || !line.discount_value || compare(line.discount_value, '0') === 0) {
      return '—';
    }
    return line.discount_type === 'PERCENT'
      ? `${plainDecimal(line.discount_value)}%`
      : `$${line.discount_value} each`;
  }

  protected add(product: ProductLookup): void {
    const existing = this.rows().find((r) => r.product === product.id);
    if (existing) {
      this.focus(existing.key);
      return;
    }
    const row = this.makeRow({
      product: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit_name,
      prices: {
        retail: product.retail_price ?? '0.00',
        wholesale: product.wholesale_price ?? '0.00',
      },
      stamped: null,
      fixed: product.is_price_fixed ?? false,
      saved: null,
      quantity: '',
      discount_type: 'PERCENT',
      discount_value: '',
    });
    this.rows.update((rows) => [...rows, row]);
    this.linesChanged = true;
    dropFieldError(this.fieldErrors, 'lines');
    this.focus(row.key);
  }

  protected remove(row: LineRow): void {
    this.rows.update((rows) => rows.filter((r) => r !== row));
    this.linesChanged = true;
    dropFieldError(this.fieldErrors, 'lines');
  }

  protected saveDraft(): void {
    if (this.busy() || !this.check()) return;
    this.run(this.persist(), () => this.ref.close('saved'));
  }

  /** Prints the quotation as last saved; unsaved changes are saved first, by the user. */
  protected print(): void {
    const quote = this.quote();
    if (!quote || this.printing()) return;
    if (this.editable() && this.unsaved()) {
      this.formErrors.set(['Save the changes first — Print prints the quotation as saved.']);
      return;
    }
    this.printing.set(true);
    this.formErrors.set([]);
    this.printer.quotation(quote).subscribe({
      next: () => this.printing.set(false),
      error: (error: unknown) => {
        this.printing.set(false);
        const [reason] = readApiErrors(error).form;
        this.formErrors.set([reason ?? "The shop's details could not be loaded; nothing printed."]);
      },
    });
  }

  protected markSent(): void {
    if (this.busy() || !this.check(true)) return;
    this.run(
      this.saved().pipe(switchMap((q) => this.api.salesQuotationsSendCreate({ id: q.id }))),
      () => this.ref.close('saved'),
    );
  }

  protected markAccepted(): void {
    if (this.busy() || !this.check(true)) return;
    confirm(this.modal, {
      title: `Mark ${this.quote()?.number ?? 'this quotation'} accepted?`,
      message:
        'The customer has agreed. Its lines can no longer be changed, and it can be invoiced ' +
        'at the till — in parts if need be.',
      confirmLabel: 'Mark accepted',
    }).closed.subscribe((yes) => {
      if (!yes) return;
      this.run(
        this.saved().pipe(switchMap((q) => this.api.salesQuotationsAcceptCreate({ id: q.id }))),
        () => this.ref.close('saved'),
      );
    });
  }

  protected reject(): void {
    const quote = this.quote();
    if (!quote || this.busy()) return;
    const partly = quote.status === 'ACCEPTED' && compare(quote.invoiced_total, '0') === 1;
    askReason<Quotation>(this.modal, {
      title: `Reject ${quote.number}?`,
      message: partly
        ? 'What has been invoiced stays invoiced; what is left is closed and cannot be invoiced.'
        : 'The quotation is closed. A new one can be raised later.',
      label: 'Why',
      placeholder: 'Bought elsewhere, price too high, …',
      confirmLabel: 'Reject quotation',
      send: (note) => this.api.salesQuotationsRejectCreate$Json({ id: quote.id, body: { note } }),
    }).closed.subscribe((rejected) => {
      if (rejected) this.ref.close('saved');
    });
  }

  protected deleteDraft(): void {
    const quote = this.quote();
    if (!quote || this.busy()) return;
    confirm(this.modal, {
      title: `Delete ${quote.number}?`,
      message: 'The draft and its lines are removed. Its number is not used again.',
      confirmLabel: 'Delete draft',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.run(this.api.salesQuotationsDestroy({ id: quote.id }), () => this.ref.close('saved'));
      }
    });
  }

  /** The ×, Escape and the veil all come here: unsaved lines are not lost without asking. */
  protected close(): void {
    if (this.busy()) return;
    const result = this.changed ? 'saved' : undefined;
    if (!this.editable() || !this.unsaved()) {
      this.ref.close(result);
      return;
    }
    confirmDiscard(this.modal).subscribe((yes) => {
      if (yes) this.ref.close(result);
    });
  }

  private load(quote: Quotation | null): void {
    this.form.reset({
      customer: quote?.customer ?? null,
      quote_date: quote?.quote_date ?? today(),
      valid_until: quote?.valid_until ?? '',
      terms: quote?.terms ?? '',
      note: quote?.note ?? '',
    });
    // The customer is fixed once the quotation exists.
    if (quote) this.form.controls.customer.disable({ emitEvent: false });
    if (!this.editable()) this.form.disable({ emitEvent: false });
    this.rows.set(
      (quote?.lines ?? []).map((line) =>
        this.makeRow({
          product: line.product,
          code: line.product_code,
          name: line.product_name,
          unit: line.unit_name,
          prices: null,
          stamped: line.unit_price,
          fixed: null,
          saved: line,
          quantity: plainDecimal(line.quantity),
          discount_type: line.discount_type === 'AMOUNT' ? 'AMOUNT' : 'PERCENT',
          discount_value:
            line.discount_value && compare(line.discount_value, '0') !== 0
              ? plainDecimal(line.discount_value)
              : '',
        }),
      ),
    );
    this.linesChanged = false;
  }

  private makeRow(start: {
    product: number;
    code: string;
    name: string;
    unit: string;
    prices: LineRow['prices'];
    stamped: string | null;
    fixed: boolean | null;
    saved: QuotationLine | null;
    quantity: string;
    discount_type: DiscountType;
    discount_value: string;
  }): LineRow {
    const form: LineForm = this.fb.group({
      quantity: [start.quantity, positive(QTY)],
      discount_type: this.fb.control<DiscountType>(start.discount_type),
      discount_value: [start.discount_value, Validators.pattern(DISCOUNT)],
    });
    if (start.fixed) {
      form.controls.discount_type.disable({ emitEvent: false });
      form.controls.discount_value.disable({ emitEvent: false });
    }
    if (!this.editable()) form.disable({ emitEvent: false });
    return {
      key: this.nextKey++,
      product: start.product,
      code: start.code,
      name: start.name,
      unit: start.unit,
      prices: start.prices,
      stamped: start.stamped,
      fixed: start.fixed,
      saved: start.saved,
      form,
    };
  }

  private focus(key: number): void {
    afterNextRender(() => document.getElementById(`qty-${key}`)?.focus(), {
      injector: this.injector,
    });
  }

  private unsaved(): boolean {
    return this.form.dirty || this.linesChanged || this.rows().some((r) => r.form.dirty);
  }

  /**
   * True when the header and every line are fit to send; otherwise marks what
   * is not. Sending or accepting a quote also needs a line.
   */
  private check(needsLine = false): boolean {
    const refused = this.rows().some((row) => this.priced(row)?.problem);
    const ok = !this.form.invalid && !refused && !this.rows().some((r) => r.form.invalid);
    if (!ok) {
      this.form.markAllAsTouched();
      for (const row of this.rows()) row.form.markAllAsTouched();
      return false;
    }
    if (needsLine && this.rows().length === 0) {
      this.formErrors.set(['Add at least one line first.']);
      return false;
    }
    return true;
  }

  private body(): QuotationRequest {
    const v = this.form.getRawValue();
    return {
      customer: v.customer!,
      quote_date: v.quote_date,
      // Blank: the server sets 30 days after the quote date.
      ...(v.valid_until ? { valid_until: v.valid_until } : {}),
      terms: v.terms,
      note: v.note,
      lines: this.rows().map((row) => {
        const l = row.form.getRawValue();
        const discounted = !!l.discount_value && compare(l.discount_value, '0') !== 0;
        return {
          product: row.product,
          quantity: l.quantity,
          discount_type: discounted ? l.discount_type : '',
          discount_value: discounted ? l.discount_value : '0',
        };
      }),
    };
  }

  /** Saves the quotation — creating it on the first save — and shows the server's prices. */
  private persist(): Observable<Quotation> {
    const quote = this.quote();
    const { customer, ...rest } = this.body();
    const request = quote
      ? this.api.salesQuotationsPartialUpdate$Json({ id: quote.id, body: rest })
      : this.api.salesQuotationsCreate$Json({ body: { customer, ...rest } });
    return request.pipe(
      tap((saved) => {
        this.changed = true;
        this.quote.set(saved);
        this.load(saved);
      }),
    );
  }

  /** The quotation as saved, saving it first if anything changed. */
  private saved(): Observable<Quotation> {
    const quote = this.quote();
    return quote && !this.unsaved() ? of(quote) : this.persist();
  }

  private run<T>(request: Observable<T>, done: (result: T) => void): void {
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        done(result);
      },
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.formErrors.set(form);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }
}
