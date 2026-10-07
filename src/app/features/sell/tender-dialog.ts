// v1.0.0 — "Add payment" at the till: cash, KHQR or credit, in dollars or
// riel (credit in dollars only, as the backend records it). The amount starts
// at what is still to cover, in the currency chosen. Credit is offered only
// for a store customer allowed it and not on hold.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyEnum } from '../../api/models/currency-enum';
import { TenderKindEnum } from '../../api/models/tender-kind-enum';
import { compare } from '../../shared/money/exact';
import { KhrPipe, RatePipe, UsdPipe } from '../../shared/money/money-pipes';
import { khrToUsd, usdToKhr } from '../../shared/sales/sales-common';
import { aboveZero } from '../stock/stock-common';
import { SaleTender } from './sale';

export interface TenderDialogData {
  /** In dollars. */
  readonly stillToCover: string;
  readonly rate: string;
  /** Who would owe a credit payment; null when credit is not offered. */
  readonly credit: { readonly name: string; readonly roomLeft: string } | null;
}

const DOLLARS = /^\d{1,10}(\.\d{1,2})?$/;
const RIEL = /^\d{1,12}$/;

@Component({
  selector: 'app-tender-dialog',
  imports: [ReactiveFormsModule, KhrPipe, RatePipe, UsdPipe],
  templateUrl: './tender-dialog.html',
})
export class TenderDialog {
  protected readonly data = inject<TenderDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Omit<SaleTender, 'key'>>>(DialogRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    kind: this.fb.control<TenderKindEnum>('CASH'),
    currency: this.fb.control<CurrencyEnum>('USD'),
    amount: [this.data.stillToCover, [Validators.required, aboveZero]],
    reference: ['', Validators.maxLength(60)],
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly kind = computed(() => this.value().kind ?? 'CASH');
  protected readonly currency = computed(() =>
    this.kind() === 'CREDIT' ? 'USD' : (this.value().currency ?? 'USD'),
  );
  /** What the amount is worth in dollars at the sale's rate; null while not a number. */
  protected readonly inUsd = computed(() => {
    const amount = this.value().amount ?? '';
    if (this.currency() === 'KHR')
      return RIEL.test(amount) ? khrToUsd(amount, this.data.rate) : null;
    return DOLLARS.test(amount) ? amount : null;
  });
  protected readonly stillToCoverKhr = usdToKhr(this.data.stillToCover, this.data.rate);
  protected readonly overRoom = computed(() => {
    const usd = this.inUsd();
    const credit = this.data.credit;
    return this.kind() === 'CREDIT' && !!usd && !!credit && compare(usd, credit.roomLeft) === 1;
  });

  constructor() {
    this.applyCurrency(this.form.controls.currency.value);
    this.form.controls.currency.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((currency) => this.applyCurrency(currency));
    this.form.controls.kind.valueChanges.pipe(takeUntilDestroyed()).subscribe((kind) => {
      // Credit is recorded in dollars.
      const currency = this.form.controls.currency;
      if (kind === 'CREDIT' && currency.value !== 'USD') currency.setValue('USD');
    });
  }

  protected add(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.ref.close({
      kind: v.kind,
      currency: this.currency(),
      amount: v.amount.trim(),
      reference: v.kind === 'KHQR' ? v.reference.trim() : '',
    });
  }

  /** Dollars take cents; riel are whole. The amount starts at what is still to cover. */
  private applyCurrency(currency: CurrencyEnum): void {
    const amount = this.form.controls.amount;
    amount.setValidators([
      Validators.required,
      Validators.pattern(currency === 'KHR' ? RIEL : DOLLARS),
      aboveZero,
    ]);
    amount.setValue(
      currency === 'KHR'
        ? usdToKhr(this.data.stillToCover, this.data.rate)
        : this.data.stillToCover,
    );
  }
}
