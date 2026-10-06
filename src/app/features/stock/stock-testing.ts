// v1.0.0 — for the stock and supplier-link specs: documents, lookups and
// links as the API returns them, and a way to answer one URL by its params.
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Adjustment } from '../../api/models/adjustment';
import { ProductLookup } from '../../api/models/product-lookup';
import { ProductSupplier } from '../../api/models/product-supplier';
import { StockCount } from '../../api/models/stock-count';
import { StockCountLine } from '../../api/models/stock-count-line';
import { StockIn } from '../../api/models/stock-in';
import { Unit } from '../../api/models/unit';
import { UNITS } from '../catalogue/catalogue-testing';

export const STOCK_IN_URL = '/api/inventory/stock-ins/';
export const ADJUSTMENT_URL = '/api/inventory/adjustments/';
export const COUNT_URL = '/api/inventory/counts/';
export const LINK_URL = '/api/partners/product-suppliers/';
export const LOOKUP_URL = '/api/catalogue/products/lookup/';

export const CARTON: Unit = {
  id: 7,
  code: 'CTN',
  name: 'Carton',
  display_order: 7,
  is_active: true,
};
export const BOX: Unit = { id: 3, code: 'BOX', name: 'Box', display_order: 3, is_active: true };
/** Piece, Set, Hour (inactive), Box, Carton. */
export const STOCK_UNITS: Unit[] = [...UNITS, BOX, CARTON];

const lookup = (p: Partial<ProductLookup> & Pick<ProductLookup, 'id' | 'code' | 'name'>) =>
  ({
    brand_name: null,
    unit_name: 'Piece',
    qty_on_hand: '0.00',
    track_stock: true,
    ...p,
  }) satisfies ProductLookup;

export const SCREW_LOOKUP = lookup({
  id: 21,
  code: 'FX-0302',
  barcode: '8850000000302',
  name: 'Wood screw 4×40mm',
  unit_name: 'Box',
  qty_on_hand: '30.00',
  shelf_location: 'C1-4',
});
export const DRILL_LOOKUP = lookup({
  id: 11,
  code: 'TL-0101',
  barcode: '8850000000101',
  name: 'Impact drill 13mm 710W',
  model_no: 'GSB 550',
  brand_name: 'Bosch',
  qty_on_hand: '14.00',
  shelf_location: 'A1-1',
});
export const GRINDER_LOOKUP = lookup({
  id: 12,
  code: 'TL-0118',
  name: 'Angle grinder 100mm 570W',
  brand_name: 'Makita',
  qty_on_hand: '3.00',
});
export const KEY_LOOKUP = lookup({
  id: 13,
  code: 'SV-0001',
  name: 'Key cutting',
  track_stock: false,
});

export const SCREW_LINK: ProductSupplier = {
  id: 5,
  product: 21,
  product_code: 'FX-0302',
  product_name: 'Wood screw 4×40mm',
  unit_name: 'Box',
  supplier: 1,
  supplier_code: 'SUP-000001',
  supplier_name: 'Total Tools (Cambodia) Co., Ltd',
  supplier_sku: 'TT-WS440',
  pack_unit: 7,
  pack_unit_name: 'Carton',
  pack_size: '24.00',
  is_preferred: true,
  notes: '',
};
export const DRILL_LINK: ProductSupplier = {
  id: 6,
  product: 11,
  product_code: 'TL-0101',
  product_name: 'Impact drill 13mm 710W',
  unit_name: 'Piece',
  supplier: 2,
  supplier_code: 'SUP-000002',
  supplier_name: 'Lim Heng Import Export',
  supplier_sku: '',
  pack_unit: null,
  pack_unit_name: null,
  pack_size: '1.00',
  is_preferred: false,
  notes: '',
};

const unposted = {
  note: '',
  posted_at: null,
  posted_by: null,
  posted_by_name: null,
  reverses: null,
  reverses_number: null,
  reversed_by_number: null,
};
const posted = (on: string) => ({
  ...unposted,
  status: 'POSTED' as const,
  posted_at: `${on}T03:10:00Z`,
  posted_by: 1,
  posted_by_name: 'Bopha Ly',
});

export const GRN_DRAFT: StockIn = {
  ...unposted,
  id: 313,
  number: 'GRN-000313',
  doc_date: '2026-09-30',
  status: 'DRAFT',
  supplier: 1,
  supplier_name: 'Total Tools (Cambodia) Co., Ltd',
  supplier_ref: 'TT-88204',
  total: '52.80',
  lines: [
    {
      id: 901,
      product: 21,
      product_code: 'FX-0302',
      product_name: 'Wood screw 4×40mm',
      unit_name: 'Box',
      pack_unit: 7,
      pack_unit_name: 'Carton',
      packs: '2.00',
      pack_size: '24.00',
      pack_cost: '26.4000',
      quantity: '48.00',
      unit_cost: '1.1000',
      line_total: '52.80',
    },
  ],
};

export const GRN_POSTED: StockIn = {
  ...posted('2026-09-28'),
  id: 312,
  number: 'GRN-000312',
  doc_date: '2026-09-28',
  supplier: 2,
  supplier_name: 'Lim Heng Import Export',
  supplier_ref: 'LH-4471',
  total: '314.40',
  lines: [
    {
      id: 902,
      product: 11,
      product_code: 'TL-0101',
      product_name: 'Impact drill 13mm 710W',
      unit_name: 'Piece',
      pack_unit: null,
      pack_unit_name: null,
      packs: '6.00',
      pack_size: '1.00',
      pack_cost: '52.4000',
      quantity: '6.00',
      unit_cost: '52.4000',
      line_total: '314.40',
    },
  ],
};

export const GRN_REVERSED: StockIn = {
  ...GRN_POSTED,
  id: 310,
  number: 'GRN-000310',
  doc_date: '2026-09-21',
  reversed_by_number: 'GRN-000314',
};

export const GRN_REVERSAL: StockIn = {
  ...GRN_POSTED,
  ...posted('2026-10-05'),
  id: 314,
  number: 'GRN-000314',
  doc_date: '2026-10-05',
  note: 'Keyed twice',
  reverses: 312,
  reverses_number: 'GRN-000312',
};

export const ADJ_DRAFT: Adjustment = {
  ...unposted,
  id: 20,
  number: 'ADJ-000020',
  doc_date: '2026-09-30',
  status: 'DRAFT',
  reason: 'DAMAGE',
  direction: 'OUT',
  supplier: null,
  supplier_name: null,
  note: 'Boxes split in the rain',
  total: null,
  lines: [
    {
      id: 801,
      product: 21,
      product_code: 'FX-0302',
      product_name: 'Wood screw 4×40mm',
      shelf_location: 'C1-4',
      on_hand: '30.00',
      current_avg_cost: '1.1000',
      quantity: '3.00',
      unit_cost: null,
      value: null,
    },
  ],
};

export const ADJ_POSTED: Adjustment = {
  ...posted('2026-09-26'),
  id: 19,
  number: 'ADJ-000019',
  doc_date: '2026-09-26',
  reason: 'RETURN_TO_SUPPLIER',
  direction: 'OUT',
  supplier: 2,
  supplier_name: 'Lim Heng Import Export',
  note: 'Two grinders arrived faulty',
  total: '-77.80',
  lines: [
    {
      id: 802,
      product: 12,
      product_code: 'TL-0118',
      product_name: 'Angle grinder 100mm 570W',
      shelf_location: 'A2-1',
      on_hand: '3.00',
      current_avg_cost: '38.9000',
      quantity: '2.00',
      unit_cost: '38.9000',
      value: '-77.80',
    },
  ],
};

const countLine = (
  l: Partial<StockCountLine> &
    Pick<StockCountLine, 'id' | 'product' | 'product_code' | 'product_name'>,
): StockCountLine => ({
  shelf_location: '',
  unit_name: 'Piece',
  counted_qty: null,
  counted_at: null,
  expected_qty: null,
  difference: null,
  unit_cost: null,
  value: null,
  ...l,
});

export const CNT_OPEN: StockCount = {
  ...unposted,
  id: 5,
  number: 'CNT-000005',
  doc_date: '2026-09-30',
  status: 'DRAFT',
  category: 4,
  category_name: 'Hand tools → Wrenches',
  counted_by: 1,
  counted_by_name: 'Bopha Ly',
  lines_total: 3,
  lines_counted: 1,
  differences: null,
  total: null,
  lines: [
    countLine({
      id: 71,
      product: 31,
      product_code: 'TL-0236',
      product_name: 'Combination spanner 8mm',
      shelf_location: 'B1-1',
      counted_qty: '42.00',
      counted_at: '2026-09-30T02:00:00Z',
    }),
    countLine({
      id: 72,
      product: 32,
      product_code: 'TL-0238',
      product_name: 'Combination spanner 10mm',
      shelf_location: 'B1-1',
    }),
    countLine({
      id: 73,
      product: 33,
      product_code: 'TL-0244',
      product_name: 'Adjustable wrench 250mm',
      shelf_location: 'B2-1',
    }),
  ],
};

export const CNT_POSTED: StockCount = {
  ...posted('2026-09-29'),
  id: 4,
  number: 'CNT-000004',
  doc_date: '2026-09-29',
  category: 2,
  category_name: 'Power tools → Drills',
  counted_by: 1,
  counted_by_name: 'Bopha Ly',
  lines_total: 2,
  lines_counted: 1,
  differences: 1,
  total: '-104.80',
  lines: [
    countLine({
      id: 61,
      product: 11,
      product_code: 'TL-0101',
      product_name: 'Impact drill 13mm 710W',
      shelf_location: 'A1-1',
      counted_qty: '12.00',
      expected_qty: '14.00',
      difference: '-2.00',
      unit_cost: '52.4000',
      value: '-104.80',
    }),
    countLine({
      id: 62,
      product: 40,
      product_code: 'TL-0103',
      product_name: 'Rotary hammer 24mm',
      shelf_location: 'A1-2',
    }),
  ],
};

/**
 * Answers calls to `url` as they arrive, each with what `bodyFor` gives for
 * it, until `count` are answered. Each answered call is kept in `seen`.
 */
export async function answerEach(
  http: HttpTestingController,
  url: string,
  bodyFor: (req: TestRequest) => object | null,
  count: number,
  seen: TestRequest[] = [],
): Promise<void> {
  let answered = 0;
  for (let tries = 0; tries < 200 && answered < count; tries++) {
    for (const req of http.match((r) => r.url === url && r.method === 'GET')) {
      seen.push(req);
      req.flush(bodyFor(req));
      answered++;
    }
    if (answered < count) await new Promise((resolve) => setTimeout(resolve, 5));
  }
  if (answered < count) throw new Error(`Expected ${count} call(s) to ${url}, got ${answered}`);
}

/** Chooses the option whose text starts with `label` — for selects bound with ngValue. */
export function chooseLabel(root: ParentNode, selector: string, label: string): void {
  const select = root.querySelector<HTMLSelectElement>(selector);
  if (!select) throw new Error(`Nothing matches ${selector}`);
  const option = Array.from(select.options).find((o) => o.text.trim().startsWith(label));
  if (!option) throw new Error(`${selector} has no option "${label}"`);
  select.value = option.value;
  select.dispatchEvent(new Event('change'));
}

/** Presses a key in an element, as the keyboard would. */
export function key(element: Element, name: string): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}
