// v1.0.0 — the till's "who is buying" panel: the mockup's three cards, and
// under them the walk-in's optional name and phone, the store customer with
// what they owe, or the quotation being invoiced. Choosing is the page's job
// (it may ask first); this panel only says what was clicked.
import { DatePipe } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { CustomerAccount } from '../../api/models/customer-account';
import { compare } from '../../shared/money/exact';
import { formatMoney } from '../../shared/money/money-pipes';
import { tierLabel } from '../partners/partner-labels';
import { BuyerKind, Sale } from './sale';

@Component({
  selector: 'app-sale-buyer',
  imports: [DatePipe],
  templateUrl: './sale-buyer.html',
})
export class SaleBuyer {
  protected readonly sale = inject(Sale);
  protected readonly tierLabel = tierLabel;

  readonly account = input<CustomerAccount | null>(null);
  readonly kindChange = output<BuyerKind>();
  readonly customerChange = output<void>();
  readonly quoteChange = output<void>();

  /** A card was clicked: the page decides, so the radio does not move on its own. */
  protected pick(event: Event, kind: BuyerKind): void {
    event.preventDefault();
    this.kindChange.emit(kind);
  }

  /** "owes $1,030.00 of $1,500.00", "on credit hold — cash only", … */
  protected standing(): string {
    const account = this.account();
    if (!account) return '';
    const owes = formatMoney(account.balance, '$', 2);
    if (account.credit_status === 'HOLD') return `owes ${owes} · on credit hold — cash only`;
    if (account.credit_status === 'YES') {
      return `owes ${owes} of ${formatMoney(account.credit_limit, '$', 2)}`;
    }
    return compare(account.balance, '0') === 1 ? `owes ${owes} · cash only` : 'cash only';
  }

  protected setName(value: string): void {
    this.sale.walkInName.set(value);
  }

  protected setPhone(value: string): void {
    this.sale.walkInPhone.set(value);
  }
}
