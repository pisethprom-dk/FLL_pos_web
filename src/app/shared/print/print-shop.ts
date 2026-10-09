// v1.0.0 — the shop at the top of every printed document: logo, name (and
// the Khmer name when Khmer is on), address, phone, VAT TIN, and — on an
// invoice or a receipt, not a quotation — the receipt's own header line.
import { Component, computed, input } from '@angular/core';
import { CompanyProfile } from '../../api/models/company-profile';
import { LabelKey, label } from './print-labels';

@Component({
  selector: 'app-print-shop',
  templateUrl: './print-shop.html',
})
export class PrintShop {
  readonly shop = input.required<CompanyProfile>();
  readonly headerLine = input(true);

  protected readonly language = computed(() => this.shop().receipt_language ?? 'EN');
  protected readonly khmer = computed(() => this.language() !== 'EN');

  protected t(key: LabelKey): string {
    return label(key, this.language());
  }
}
