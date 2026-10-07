// v1.0.0 — a quotation as it prints: always on A4 (it goes to a contractor
// and may run long), in the receipt language, in dollars only — a quotation
// holds no exchange rate; the rate is stamped when it is invoiced (owner's
// choices, 2026-10-07). A draft is marked as one.
import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { CompanyProfile } from '../../api/models/company-profile';
import { Quotation } from '../../api/models/quotation';
import { QtyPipe, UsdPipe } from '../money/money-pipes';
import { discountOff } from './print-common';
import { LabelKey, label } from './print-labels';
import { PrintShop } from './print-shop';

@Component({
  selector: 'app-quotation-print',
  imports: [DatePipe, PrintShop, QtyPipe, UsdPipe],
  templateUrl: './quotation-print.html',
})
export class QuotationPrint {
  readonly quote = input.required<Quotation>();
  readonly shop = input.required<CompanyProfile>();

  protected readonly language = computed(() => this.shop().receipt_language ?? 'EN');
  protected readonly discount = discountOff;

  protected t(key: LabelKey): string {
    return label(key, this.language());
  }
}
