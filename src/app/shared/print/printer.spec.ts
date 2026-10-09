// v1.1.0
import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CompanyProfile } from '../../api/models/company-profile';
import { Invoice } from '../../api/models/invoice';
import { PaymentNote } from '../../api/models/payment-note';
import { SHOP_PROFILE } from '../../core/session/session-testing';
import { page } from '../../features/catalogue/catalogue-testing';
import { PAY_POSTED } from '../../features/payments/payments-testing';
import { QUO_DRAFT } from '../../features/quotations/quotations-testing';
import { ADMIN_CREDIT } from '../../features/sales/sales-testing';
import { COMPLETED, SOK_ACCOUNT, accountOf } from '../../features/sell/sell-testing';
import { today } from '../dates';
import { texts } from '../screen-testing';
import { Printer } from './printer';

const PROFILE_URL = '/api/company/profile/';
const NOTES_URL = '/api/company/payment-notes/';
const dayText = (day: string) => new DatePipe('en-US').transform(day, 'd MMM y');

const SHOP_80: CompanyProfile = {
  ...SHOP_PROFILE,
  name_kh: 'ហាងលក់ឧបករណ៍ជាង',
  phone: '012 330 441',
  logo: null,
  receipt_header: 'Hardware · Tools · Fixings',
  receipt_footer: 'Thank you — goods sold are not returnable after 7 days',
  receipt_paper_width: '80mm',
  receipt_language: 'EN',
  receipt_show_riel_total: true,
  receipt_show_rate_used: true,
  receipt_show_seller: false,
};
const SHOP_A5_BOTH: CompanyProfile = {
  ...SHOP_80,
  receipt_paper_width: 'A5',
  receipt_language: 'BOTH',
  receipt_show_seller: true,
};
const SHOP_58_KH: CompanyProfile = {
  ...SHOP_80,
  receipt_paper_width: '58mm',
  receipt_language: 'KH',
  receipt_show_riel_total: false,
};

/** Five spirit levels at $75.29 less $3 each: $361.45, paid with $400. */
const CASH_SALE: Invoice = {
  ...COMPLETED,
  lines: [
    {
      ...COMPLETED.lines![0],
      unit_price: '75.29',
      discount_type: 'AMOUNT',
      discount_value: '3.00',
      product_short_name: 'Spirit level 60',
    },
  ],
};
const CREDIT_SALE: Invoice = {
  ...ADMIN_CREDIT,
  lines: [{ ...ADMIN_CREDIT.lines![0], warranty_months: 12 }],
};

const note = (n: Pick<PaymentNote, 'id' | 'payment_type' | 'payment_info'>): PaymentNote => ({
  image: null,
  is_active: true,
  row_order: n.id,
  ...n,
});
const NOTES = [
  note({ id: 1, payment_type: 'ABA Bank', payment_info: 'Account 000 123 456' }),
  note({ id: 2, payment_type: 'Cash at the shop', payment_info: 'Open 07:00 to 21:00' }),
];

/** What #print-root held at the moment the browser's print was called. */
interface Printed {
  readonly root: HTMLElement;
  readonly paper: string;
  readonly page: string;
}

describe('Printer', () => {
  let http: HttpTestingController;
  let printer: Printer;
  let printed: Printed | null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    printer = TestBed.inject(Printer);
    printed = null;
    vi.spyOn(window, 'print').mockImplementation(() => {
      const root = document.getElementById('print-root')!;
      const page = Array.from(document.querySelectorAll('style'))
        .map((s) => s.textContent ?? '')
        .find((css) => css.startsWith('@page'));
      printed = {
        root: root.cloneNode(true) as HTMLElement,
        paper: root.className,
        page: page ?? '',
      };
    });
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function print(sale: Invoice, shop: CompanyProfile, copy = false): Promise<Printed> {
    const done = firstValueFrom(printer.invoice(sale, copy), { defaultValue: undefined });
    http.expectOne(PROFILE_URL).flush(shop);
    for (const req of http.match((r) => r.url === NOTES_URL)) {
      expect(req.request.params.get('active')).toBe('true');
      req.flush(page(NOTES));
    }
    await done;
    return printed!;
  }

  const pairs = (root: ParentNode, selector: string) =>
    Array.from(root.querySelectorAll(selector), (tr) => texts(tr, 'th, td'));

  it('prints a cash sale on an 80 mm roll, in English, and tidies up after', async () => {
    const out = await print(CASH_SALE, SHOP_80);
    expect([out.paper, out.page]).toEqual(['paper-80mm', '@page { margin: 0; }']);
    expect(texts(out.root, '.inv-who > div')).toEqual([
      'Sok Heng Mart',
      'Street 315, Toul Kork, Phnom Penh',
      'Phone 012 330 441',
      'Hardware · Tools · Fixings',
    ]);
    expect(texts(out.root, '.inv-title')).toEqual(['Invoice']);
    const meta = pairs(out.root, '.inv-meta tr');
    expect([meta[0], meta[2]]).toEqual([
      ['No.', 'INV-20261006001'],
      ['Customer', 'Walk-in customer — Dara'],
    ]);
    expect(meta.map((m) => m[0])).not.toContain('Seller');
    expect(texts(out.root, '.inv-item')).toEqual(['Spirit level 60']);
    expect(texts(out.root, '.inv-row > span')).toEqual(['5 × $72.29 ($75.29 −$3.00)', '$361.45']);
    expect(pairs(out.root, '.inv-totals tr')).toEqual([
      ['Total', '$361.45'],
      ['In riel (at ៛4,100)', '៛1,481,900'],
      ['Cash', '$400.00'],
      ['Paid', '$361.45'],
      ['Change', '$38.00 + ៛2,300'],
    ]);
    expect(out.root.querySelector('.inv-pay')).toBeNull();
    expect(texts(out.root, '.inv-foot')).toEqual([
      'Thank you — goods sold are not returnable after 7 days',
    ]);
    expect(document.getElementById('print-root')).toBeNull();
    expect(
      Array.from(document.querySelectorAll('style')).some((s) =>
        s.textContent?.startsWith('@page'),
      ),
    ).toBe(false);
  });

  it('prints a credit sale on A5 in both languages, with the seller and how to pay', async () => {
    const out = await print(CREDIT_SALE, SHOP_A5_BOTH);
    expect([out.paper, out.page]).toEqual([
      'paper-A5',
      '@page { size: A5 portrait; margin: 10mm; }',
    ]);
    expect(texts(out.root, '.inv-name-kh')).toEqual(['ហាងលក់ឧបករណ៍ជាង']);
    expect(texts(out.root, '.inv-title')).toEqual(['Invoice / វិក្កយបត្រ']);
    expect(pairs(out.root, '.inv-meta tr')).toContainEqual(['Seller / អ្នកលក់', 'Bopha Ly']);
    expect(pairs(out.root, '.inv-meta tr')).toContainEqual([
      'Quotation / សម្រង់តម្លៃ',
      'QUO-20261001001',
    ]);
    expect(texts(out.root, '.inv-table thead th')).toEqual([
      'Item / ទំនិញ',
      'Qty / ចំនួន',
      'Price / តម្លៃ',
      'Discount / បញ្ចុះតម្លៃ',
      'Amount / ទឹកប្រាក់',
    ]);
    expect(texts(out.root, '.inv-table tbody td').slice(1)).toEqual([
      '5 Piece',
      '$65.00',
      '',
      '$325.00',
    ]);
    expect(texts(out.root, '.inv-table .inv-code, .inv-table .inv-note')).toEqual([
      'TL-0283',
      'Warranty 12 months / ធានា 12 ខែ',
    ]);
    const totals = pairs(out.root, '.inv-totals tr');
    expect(totals).toContainEqual(['Credit / ឥណទាន', '$225.00']);
    expect(totals).toContainEqual(['On credit / នៅជំពាក់', '$225.00']);
    expect(totals).toContainEqual(['Due / ថ្ងៃត្រូវបង់', '5 Nov 2026']);
    expect(texts(out.root, '.inv-pay-title')).toEqual(['How to pay / វិធីបង់ប្រាក់']);
    expect(texts(out.root, '.inv-way b, .inv-way .inv-info')).toEqual([
      'ABA Bank',
      'Account 000 123 456',
      'Cash at the shop',
      'Open 07:00 to 21:00',
    ]);
  });

  it('prints a reprint on a 58 mm roll in Khmer, marked as a copy, without the riel total', async () => {
    const out = await print(CASH_SALE, SHOP_58_KH, true);
    expect(out.paper).toBe('paper-58mm');
    expect(texts(out.root, '.inv-title')).toEqual(['វិក្កយបត្រ ច្បាប់ចម្លង']);
    expect(pairs(out.root, '.inv-totals tr').map((t) => t[0])).toEqual([
      'សរុប',
      'សាច់ប្រាក់',
      'បានបង់',
      'ប្រាក់អាប់',
    ]);
  });

  it('prints a quotation on A4 whatever the receipt paper: for whom, the lines, the terms', async () => {
    const done = firstValueFrom(
      printer.quotation({ ...QUO_DRAFT, terms: 'Collection from the shop.\nPrices hold 30 days.' }),
      { defaultValue: undefined },
    );
    http.expectOne(PROFILE_URL).flush(SHOP_A5_BOTH);
    await done;
    const out = printed!;
    expect([out.paper, out.page]).toEqual([
      'paper-A4',
      '@page { size: A4 portrait; margin: 12mm; }',
    ]);
    expect(texts(out.root, '.inv-title')).toEqual(['Quotation / សម្រង់តម្លៃ Draft / សេចក្តីព្រាង']);
    expect(texts(out.root, '.inv-who .inv-header')).toEqual([]);
    expect(texts(out.root, '.inv-for > div')).toEqual([
      'Quotation for / ជូនចំពោះ',
      'Sok Shop',
      'Phone / ទូរស័ព្ទ 012 330 441',
      'No 10, Street 271, Phnom Penh',
    ]);
    expect(pairs(out.root, '.inv-meta tr').map((m) => m[0])).toEqual([
      'No. / លេខ',
      'Date / កាលបរិច្ឆេទ',
      'Valid until / មានសុពលភាពដល់',
      'Prepared by / រៀបចំដោយ',
    ]);
    expect(pairs(out.root, '.inv-totals tr')).toEqual([['Total / សរុប', '$138.00']]);
    expect(texts(out.root, '.inv-terms .inv-info')).toEqual([
      'Collection from the shop. Prices hold 30 days.',
    ]);
    expect(out.root.textContent).not.toContain('៛');
  });

  it("prints a riel payment's receipt on the roll, with what is still owed today", async () => {
    const riel = {
      ...PAY_POSTED,
      currency: 'KHR' as const,
      amount_tendered: '410000.00',
      exchange_rate: '4100.000000',
      amount: '100.00',
      reference: 'ABA-778201',
      allocations: [{ invoice: 101, invoice_number: 'INV-20260901001', amount: '100.00' }],
    };
    const done = firstValueFrom(printer.payment(riel, true), { defaultValue: undefined });
    http.expectOne(PROFILE_URL).flush(SHOP_80);
    http.expectOne(accountOf(2)).flush({ ...SOK_ACCOUNT, balance: '930.00' });
    await done;
    const out = printed!;
    expect(out.paper).toBe('paper-80mm');
    expect(texts(out.root, '.inv-title')).toEqual(['Payment receipt Copy']);
    expect(pairs(out.root, '.inv-meta tr')).toContainEqual(['Received by', 'Bopha Ly']);
    expect(pairs(out.root, '.inv-totals tr')).toEqual([
      ['Cash ABA-778201', '៛410,000'],
      ['= (at ៛4,100)', '$100.00'],
      ['INV-20260901001', '$100.00'],
      ['Total', '$100.00'],
      [`Still owed on ${dayText(today())}`, '$930.00'],
    ]);
  });

  it('prints nothing when the shop cannot be loaded', async () => {
    const done = firstValueFrom(printer.invoice(CASH_SALE));
    http.expectOne(PROFILE_URL).flush({ detail: 'Down' }, { status: 500, statusText: 'Error' });
    await expect(done).rejects.toBeTruthy();
    expect(window.print).not.toHaveBeenCalled();
    expect(document.getElementById('print-root')).toBeNull();
  });
});
