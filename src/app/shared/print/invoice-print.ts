// v1.0.1 — a sale's invoice as it prints: laid out for a receipt roll (80 mm
// or 58 mm) or an A5 page, in the receipt language, with what Company →
// Profile → Receipt switches on. Only `Printer` puts it on the page, out of
// sight, for the length of a print.
import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CompanyProfile } from '../../api/models/company-profile';
import { Invoice } from '../../api/models/invoice';
import { PaymentNote } from '../../api/models/payment-note';
import { TenderKindEnum } from '../../api/models/tender-kind-enum';
import { KhrPipe, QtyPipe, RatePipe, UsdPipe } from '../money/money-pipes';
import { discountOff, more } from './print-common';
import { LabelKey, label, warrantyLine } from './print-labels';
import { PrintShop } from './print-shop';

const KIND_LABEL: Record<TenderKindEnum, LabelKey> = {
  CASH: 'cash',
  KHQR: 'khqr',
  CREDIT: 'credit',
};

@Component({
  selector: 'app-invoice-print',
  imports: [DatePipe, KhrPipe, PrintShop, QtyPipe, RatePipe, UsdPipe],
  templateUrl: './invoice-print.html',
})
export class InvoicePrint {
  readonly sale = input.required<Invoice>();
  readonly shop = input.required<CompanyProfile>();
  /** The how-to-pay notes; given only for a sale with something on credit. */
  readonly notes = input<readonly PaymentNote[]>([]);
  /** A reprint: marked COPY. */
  readonly copy = input(false);

  protected readonly language = computed(() => this.shop().receipt_language ?? 'EN');
  protected readonly roll = computed(() => this.shop().receipt_paper_width !== 'A5');
  protected readonly more = more;
  protected readonly discount = discountOff;

  protected t(key: LabelKey): string {
    return label(key, this.language());
  }

  protected kind(kind: TenderKindEnum): string {
    return this.t(KIND_LABEL[kind]);
  }

  protected warranty(months: number): string {
    return warrantyLine(months, this.language());
  }

  protected customer(): string {
    const s = this.sale();
    return s.walk_in_name ? `${s.customer_name} — ${s.walk_in_name}` : s.customer_name;
  }
}
