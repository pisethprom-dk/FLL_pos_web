// v1.0.0 — the till's lines: the product picker (scanning a product already on
// the sale adds one more — owner's choice, 2026-10-06) and the line table.
// Each line shows its price at the buyer's tier, its discount with the 15%
// cap and "price fixed" before the server is asked, and "Only N on hand" when
// more is asked for than the shelf holds — the server refuses a sale past
// zero. A sale from a quotation takes only the quotation's lines.
import { Component, inject } from '@angular/core';
import { QtyPipe, UsdPipe } from '../../shared/money/money-pipes';
import { ProductPicker } from '../../shared/product-picker/product-picker';
import { DiscountType } from '../../shared/sales/sales-common';
import { Sale, SaleLine } from './sale';

@Component({
  selector: 'app-sale-lines',
  imports: [ProductPicker, QtyPipe, UsdPipe],
  templateUrl: './sale-lines.html',
})
export class SaleLines {
  protected readonly sale = inject(Sale);

  /** A quotation's line keeps the discount agreed on it; a fixed price takes none. */
  protected locked(line: SaleLine): boolean {
    return line.fixed || line.quoteLine !== null;
  }

  protected setQty(line: SaleLine, value: string): void {
    this.sale.update(line.key, { quantity: value.trim() });
  }

  protected setType(line: SaleLine, value: string): void {
    this.sale.update(line.key, { discountType: value as DiscountType });
  }

  protected setDiscount(line: SaleLine, value: string): void {
    this.sale.update(line.key, { discountValue: value.trim() });
  }
}
