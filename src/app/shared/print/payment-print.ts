// v1.0.0 — a customer payment's receipt as it prints: on the receipt paper (a
// roll on 80 mm or 58 mm, a page on A5), in the receipt language. What the
// customer still owes is read from their account when it is printed, and
// says on which day (owner's choice, 2026-10-07). A reprint is marked COPY.
import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CompanyProfile } from '../../api/models/company-profile';
import { CustomerPayment } from '../../api/models/customer-payment';
import { PaymentTenderEnum } from '../../api/models/payment-tender-enum';
import { KhrPipe, RatePipe, UsdPipe } from '../money/money-pipes';
import { LabelKey, label } from './print-labels';
import { PrintShop } from './print-shop';

const TENDER_LABEL: Record<PaymentTenderEnum, LabelKey> = {
  CASH: 'cash',
  KHQR: 'khqr',
  BANK: 'bank',
};

@Component({
  selector: 'app-payment-print',
  imports: [DatePipe, KhrPipe, PrintShop, RatePipe, UsdPipe],
  templateUrl: './payment-print.html',
})
export class PaymentPrint {
  readonly payment = input.required<CustomerPayment>();
  readonly shop = input.required<CompanyProfile>();
  /** What the customer owes in all, read when printed. */
  readonly owed = input.required<string>();
  /** The day `owed` was read. */
  readonly asOf = input.required<string>();
  readonly copy = input(false);

  protected readonly language = computed(() => this.shop().receipt_language ?? 'EN');
  protected readonly roll = computed(() => this.shop().receipt_paper_width !== 'A5');

  protected t(key: LabelKey): string {
    return label(key, this.language());
  }

  protected tender(tender: PaymentTenderEnum): string {
    return this.t(TENDER_LABEL[tender]);
  }
}
