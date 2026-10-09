// v1.0.0 — the till's money: the total in dollars and riel, the payments
// taken, and the change to hand back as whole dollars plus riel to the
// nearest ៛100 — all previews worked out as the server will settle the sale.
// No invoice discount: the backend discounts per line only.
import { DatePipe } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { compare, negate, times } from '../../shared/money/exact';
import { KhrPipe, RatePipe, UsdPipe } from '../../shared/money/money-pipes';
import { khrToUsd } from '../../shared/sales/sales-common';
import { Sale, SaleTender } from './sale';

export interface CreditNote {
  readonly name: string;
  readonly onCredit: string;
  /** What they will owe once this sale is on their account. */
  readonly after: string;
  readonly limit: string;
  readonly due: string;
}

@Component({
  selector: 'app-sale-money',
  imports: [DatePipe, KhrPipe, RatePipe, UsdPipe],
  templateUrl: './sale-money.html',
})
export class SaleMoney {
  protected readonly sale = inject(Sale);

  readonly creditNote = input<CreditNote | null>(null);
  /** Whose account a credit payment goes to, for its label. */
  readonly creditName = input('customer');
  readonly addPayment = output<void>();

  protected above(value: string): boolean {
    return compare(value, '0') === 1;
  }

  protected less(value: string): string | null {
    return negate(value);
  }

  protected tenderLabel(t: SaleTender): string {
    if (t.kind === 'CREDIT') return `Credit · ${this.creditName()}`;
    return `${t.kind === 'CASH' ? 'Cash' : 'KHQR'} · ${t.currency}`;
  }

  protected tenderUsd(t: SaleTender): string | null {
    if (t.currency === 'USD') return times(t.amount, '1', 2);
    const rate = this.sale.rateValue();
    return rate ? khrToUsd(t.amount, rate) : null;
  }
}
