// v1.1.0 — the words on a printed invoice, quotation or payment receipt, in
// English and Khmer. The receipt language (Company → Profile → Receipt) picks
// English, Khmer, or both.
// The Khmer was drafted for the owner to check (2026-10-07): correct it here,
// in this one place.
import { ReceiptLanguageEnum } from '../../api/models/receipt-language-enum';

const LABELS = {
  invoice: ['Invoice', 'វិក្កយបត្រ'],
  copy: ['Copy', 'ច្បាប់ចម្លង'],
  number: ['No.', 'លេខ'],
  date: ['Date', 'កាលបរិច្ឆេទ'],
  seller: ['Seller', 'អ្នកលក់'],
  customer: ['Customer', 'អតិថិជន'],
  phone: ['Phone', 'ទូរស័ព្ទ'],
  quotation: ['Quotation', 'សម្រង់តម្លៃ'],
  vatTin: ['VAT TIN', 'លេខអត្តសញ្ញាណកម្ម'],
  item: ['Item', 'ទំនិញ'],
  qty: ['Qty', 'ចំនួន'],
  price: ['Price', 'តម្លៃ'],
  discount: ['Discount', 'បញ្ចុះតម្លៃ'],
  amount: ['Amount', 'ទឹកប្រាក់'],
  discountGiven: ['Discount given', 'បញ្ចុះតម្លៃសរុប'],
  total: ['Total', 'សរុប'],
  inRiel: ['In riel', 'ជាប្រាក់រៀល'],
  rate: ['at', 'អត្រា'],
  cash: ['Cash', 'សាច់ប្រាក់'],
  khqr: ['KHQR', 'KHQR'],
  credit: ['Credit', 'ឥណទាន'],
  paid: ['Paid', 'បានបង់'],
  change: ['Change', 'ប្រាក់អាប់'],
  onCredit: ['On credit', 'នៅជំពាក់'],
  due: ['Due', 'ថ្ងៃត្រូវបង់'],
  howToPay: ['How to pay', 'វិធីបង់ប្រាក់'],
  // A quotation.
  draft: ['Draft', 'សេចក្តីព្រាង'],
  validUntil: ['Valid until', 'មានសុពលភាពដល់'],
  preparedBy: ['Prepared by', 'រៀបចំដោយ'],
  quotationFor: ['Quotation for', 'ជូនចំពោះ'],
  terms: ['Terms', 'លក្ខខណ្ឌ'],
  // A payment receipt.
  paymentReceipt: ['Payment receipt', 'បង្កាន់ដៃទទួលប្រាក់'],
  receivedBy: ['Received by', 'អ្នកទទួល'],
  bank: ['Bank transfer', 'ផ្ទេរតាមធនាគារ'],
  paidOff: ['Paid off', 'បានទូទាត់'],
  stillOwed: ['Still owed on', 'នៅជំពាក់គិតត្រឹម'],
} as const satisfies Record<string, readonly [string, string]>;

export type LabelKey = keyof typeof LABELS;

/** A label in the receipt's language; both reads "English / Khmer". */
export function label(key: LabelKey, language: ReceiptLanguageEnum | undefined): string {
  const [en, kh] = LABELS[key];
  if (language === 'KH') return kh;
  if (language === 'BOTH' && kh !== en) return `${en} / ${kh}`;
  return en;
}

/** "Warranty 12 months", as a whole phrase in each language. */
export function warrantyLine(months: number, language: ReceiptLanguageEnum | undefined): string {
  const en = `Warranty ${months} ${months === 1 ? 'month' : 'months'}`;
  const kh = `ធានា ${months} ខែ`;
  if (language === 'KH') return kh;
  if (language === 'BOTH') return `${en} / ${kh}`;
  return en;
}
