// v1.1.0 — prints a sale's invoice, a quotation, or a payment's receipt. It
// loads what the paper needs (the shop's details; for a sale on credit the
// how-to-pay notes; for a payment what the customer still owes), lays the
// document out in #print-root, sets the page for its paper, waits for the
// images, opens the browser's print dialog, and tidies up. Only #print-root
// prints, and it never shows on screen (src/styles/_print.scss).
import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  EnvironmentInjector,
  Injectable,
  Type,
  createComponent,
  inject,
} from '@angular/core';
import { Observable, forkJoin, from, of, switchMap } from 'rxjs';
import { CompanyProfile } from '../../api/models/company-profile';
import { CustomerPayment } from '../../api/models/customer-payment';
import { Invoice } from '../../api/models/invoice';
import { PaymentNote } from '../../api/models/payment-note';
import { Quotation } from '../../api/models/quotation';
import { CompanyService } from '../../api/services/company.service';
import { SalesService } from '../../api/services/sales.service';
import { today } from '../dates';
import { fetchAll } from '../fetch-all';
import { InvoicePrint } from './invoice-print';
import { PaymentPrint } from './payment-print';
import { more } from './print-common';
import { QuotationPrint } from './quotation-print';

/** The page for each paper. A roll is as long as the document; the printer's driver sets its width. */
const PAGE: Record<string, string> = {
  '80mm': '@page { margin: 0; }',
  '58mm': '@page { margin: 0; }',
  A5: '@page { size: A5 portrait; margin: 10mm; }',
  A4: '@page { size: A4 portrait; margin: 12mm; }',
};

/** The receipt paper in Company → Profile → Receipt. */
function receiptPaper(shop: CompanyProfile): string {
  return shop.receipt_paper_width ?? '80mm';
}

@Injectable({ providedIn: 'root' })
export class Printer {
  private readonly company = inject(CompanyService);
  private readonly sales = inject(SalesService);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  /** Prints the sale's invoice — `copy` for a reprint. Completes once the dialog has closed. */
  invoice(sale: Invoice, copy = false): Observable<void> {
    return forkJoin({
      shop: this.company.companyProfileRetrieve(),
      notes: more(sale.on_credit)
        ? fetchAll((page) => this.company.companyPaymentNotesList({ page, active: 'true' }))
        : of<PaymentNote[]>([]),
    }).pipe(
      switchMap(({ shop, notes }) =>
        from(this.print(InvoicePrint, { sale, shop, notes, copy }, receiptPaper(shop))),
      ),
    );
  }

  /** Prints the quotation as saved, on A4. */
  quotation(quote: Quotation): Observable<void> {
    return this.company
      .companyProfileRetrieve()
      .pipe(switchMap((shop) => from(this.print(QuotationPrint, { quote, shop }, 'A4'))));
  }

  /** Prints the payment's receipt — `copy` for a reprint — with what the customer owes now. */
  payment(payment: CustomerPayment, copy = false): Observable<void> {
    return forkJoin({
      shop: this.company.companyProfileRetrieve(),
      account: this.sales.salesCustomersAccountRetrieve({ id: payment.customer }),
    }).pipe(
      switchMap(({ shop, account }) =>
        from(
          this.print(
            PaymentPrint,
            { payment, shop, owed: account.balance, asOf: today(), copy },
            receiptPaper(shop),
          ),
        ),
      ),
    );
  }

  private async print<C>(
    component: Type<C>,
    inputs: Record<string, unknown>,
    paper: string,
  ): Promise<void> {
    const doc = this.document;
    const page = doc.createElement('style');
    page.textContent = PAGE[paper] ?? PAGE['80mm'];
    const host = doc.createElement('div');
    host.id = 'print-root';
    host.className = `paper-${paper}`;
    doc.head.appendChild(page);
    doc.body.appendChild(host);

    const ref = createComponent(component, {
      environmentInjector: this.injector,
      hostElement: host,
    });
    for (const [name, value] of Object.entries(inputs)) ref.setInput(name, value);
    this.appRef.attachView(ref.hostView);
    ref.changeDetectorRef.detectChanges();
    try {
      await imagesLoaded(host);
      // The browsers' print() holds until the dialog is closed.
      doc.defaultView?.print();
    } finally {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      host.remove();
      page.remove();
    }
  }
}

/** Waits for the logo and any QR images, so they are on the paper. */
function imagesLoaded(root: HTMLElement): Promise<unknown> {
  const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  return Promise.all(
    pending.map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
}
