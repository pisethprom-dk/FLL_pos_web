// v1.1.0 — "Record a payment": money a store customer pays against their
// invoices. It must be applied in full and never be more than they owe; the
// open invoices fill oldest first as the amount is typed, and any line can
// then be changed (owner's choice, 2026-10-06). Riel converts at the rate of
// the payment's date, as the server converts it. Frozen once saved. Save and
// print receipt prints it once saved; the dialog closes either way, since the
// payment stands — a failed print is printed again from the list.
import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyEnum } from '../../api/models/currency-enum';
import { CustomerLookup } from '../../api/models/customer-lookup';
import { PaymentTenderEnum } from '../../api/models/payment-tender-enum';
import { CompanyService } from '../../api/services/company.service';
import { SalesService } from '../../api/services/sales.service';
import { readApiErrors } from '../../shared/api-errors';
import { Printer } from '../../shared/print/printer';
import { today } from '../../shared/dates';
import { Modal } from '../../shared/dialog/modal';
import { fetchAll } from '../../shared/fetch-all';
import { compare, negate, sum } from '../../shared/money/exact';
import { RatePipe, UsdPipe } from '../../shared/money/money-pipes';
import { khrToUsd } from '../../shared/sales/sales-common';
import { CustomerPicker } from '../sell/customer-picker';
import { aboveZero, notFuture } from '../stock/stock-common';
import { Applying, TENDERS, fillOldest, rateOn } from './payments-common';

const DOLLARS = /^\d{1,10}(\.\d{1,2})?$/;
const RIEL = /^\d{1,12}$/;

@Component({
  selector: 'app-record-payment',
  imports: [DatePipe, ReactiveFormsModule, RatePipe, UsdPipe],
  templateUrl: './record-payment.html',
})
export class RecordPayment {
  private readonly api = inject(SalesService);
  private readonly company = inject(CompanyService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  private readonly printer = inject(Printer);
  protected readonly tenders = TENDERS;
  protected readonly today = today();

  protected readonly customer = signal<CustomerLookup | null>(null);
  protected readonly account = rxResource({
    params: () => this.customer()?.id,
    stream: ({ params: id }) => this.api.salesCustomersAccountRetrieve({ id }),
  });
  private readonly rates = rxResource({
    stream: () => fetchAll((page) => this.company.companyExchangeRatesList({ page })),
  });

  protected readonly form = this.fb.group({
    payment_date: [today(), [Validators.required, notFuture]],
    tender: this.fb.control<PaymentTenderEnum>('CASH'),
    currency: this.fb.control<CurrencyEnum>('USD'),
    amount: ['', [Validators.required, Validators.pattern(DOLLARS), aboveZero]],
    reference: ['', Validators.maxLength(60)],
    note: [''],
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The rate a riel payment converts at: the one in use on its date. */
  protected readonly rate = computed(() =>
    this.rates.hasValue() ? rateOn(this.rates.value(), this.value().payment_date ?? '') : null,
  );
  /** What the payment is worth in dollars; null while the amount is not a number. */
  protected readonly received = computed(() => {
    const v = this.value();
    const amount = (v.amount ?? '').trim();
    if (v.currency === 'KHR') {
      const rate = this.rate();
      return RIEL.test(amount) && rate ? khrToUsd(amount, rate) : null;
    }
    return DOLLARS.test(amount) ? amount : null;
  });

  /** The open invoices, refilled oldest first whenever the amount changes. */
  protected readonly rows = linkedSignal<
    { usd: string | null; invoices: readonly Applying['invoice'][] },
    Applying[]
  >({
    source: () => ({
      usd: this.received(),
      invoices: this.account.hasValue() ? this.account.value().open_invoices : [],
    }),
    computation: ({ usd, invoices }) => fillOldest(usd, invoices),
  });

  protected readonly applied = computed(() =>
    sum(
      this.rows()
        .filter((r) => r.ticked && DOLLARS.test(r.amount))
        .map((r) => r.amount),
      2,
    ),
  );
  protected readonly left = computed(() => {
    const received = this.received();
    const applied = this.applied();
    return received && applied ? sum([received, negate(applied)!], 2) : null;
  });
  protected readonly owes = computed(() =>
    this.account.hasValue() ? this.account.value().balance : null,
  );
  protected readonly tooMuch = computed(() => {
    const received = this.received();
    const owes = this.owes();
    return !!received && !!owes && compare(received, owes) === 1;
  });

  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    // Dollars take cents; riel are whole.
    this.form.controls.currency.valueChanges.pipe(takeUntilDestroyed()).subscribe((currency) => {
      const amount = this.form.controls.amount;
      amount.setValidators([
        Validators.required,
        Validators.pattern(currency === 'KHR' ? RIEL : DOLLARS),
        aboveZero,
      ]);
      amount.updateValueAndValidity();
    });
  }

  protected pickCustomer(): void {
    this.modal
      .open<CustomerLookup, unknown, CustomerPicker>(CustomerPicker, {
        wide: true,
        labelledBy: 'pick-customer-title',
      })
      .closed.subscribe((c) => c && this.customer.set(c));
  }

  /** Why a line cannot be applied as typed; null when it can. */
  protected rowProblem(row: Applying): string | null {
    if (!row.ticked) return null;
    if (!DOLLARS.test(row.amount) || compare(row.amount, '0') !== 1) return 'An amount above zero.';
    if (compare(row.amount, row.invoice.balance) === 1) return 'More than it owes.';
    return null;
  }

  /** What an invoice is left owing once this payment is applied. */
  protected leaves(row: Applying): string | null {
    if (!row.ticked || this.rowProblem(row)) return null;
    return sum([row.invoice.balance, negate(row.amount)!], 2);
  }

  /** Ticking fills what is left to apply, up to what the invoice owes; unticking clears it. */
  protected tick(index: number, on: boolean): void {
    const left = this.left();
    this.rows.update((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        if (!on) return { ...row, ticked: false, amount: '' };
        const room = left && compare(left, '0') === 1 ? left : '0.00';
        const take = compare(room, row.invoice.balance) === 1 ? row.invoice.balance : room;
        return { ...row, ticked: true, amount: take };
      }),
    );
  }

  protected setAmount(index: number, value: string): void {
    this.rows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ticked: true, amount: value.trim() } : row)),
    );
  }

  /** Why the payment cannot be saved yet; empty when it can. */
  protected blocker(): string {
    if (!this.customer()) return 'Choose the customer.';
    if (this.form.invalid || this.received() === null) return '';
    if (this.form.controls.currency.value === 'KHR' && !this.rate()) {
      return 'There is no exchange rate on that date.';
    }
    if (this.tooMuch()) return 'More than the customer owes.';
    if (this.rows().some((row) => this.rowProblem(row)))
      return 'Put right the lines marked in red.';
    if (this.left() !== '0.00') return 'What is left to apply must reach zero.';
    return '';
  }

  protected save(print = false): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.blocker()) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.errors.set([]);
    this.fieldErrors.set({});
    this.api
      .salesPaymentsCreate$Json({
        body: {
          customer: this.customer()!.id,
          payment_date: v.payment_date,
          tender: v.tender,
          currency: v.currency,
          amount_tendered: v.amount.trim(),
          reference: v.reference.trim(),
          note: v.note,
          allocations: this.rows()
            .filter((r) => r.ticked)
            .map((r) => ({ invoice: r.invoice.id, amount: r.amount })),
        },
      })
      .subscribe({
        next: (saved) => {
          if (!print) {
            this.ref.close('saved');
            return;
          }
          // Saved: the dialog closes even if printing fails, so it is never saved twice.
          const done = () => this.ref.close('saved');
          this.printer.payment(saved).subscribe({ next: done, error: done });
        },
        error: (error: unknown) => {
          const { form, fields } = readApiErrors(error);
          this.errors.set(form);
          this.fieldErrors.set(fields);
          this.busy.set(false);
        },
      });
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }
}
