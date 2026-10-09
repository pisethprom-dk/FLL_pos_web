// v1.3.0 — for the report specs: reports as the API returns them.
import { DailySales } from '../../api/models/daily-sales';
import { Dashboard } from '../../api/models/dashboard';
import { Receivables } from '../../api/models/receivables';
import { StockOnHand } from '../../api/models/stock-on-hand';

export const DAILY_SALES_URL = '/api/reports/daily-sales/';
export const STOCK_URL = '/api/reports/stock-on-hand/';
export const RECEIVABLES_URL = '/api/reports/receivables/';
export const DASHBOARD_URL = '/api/reports/dashboard/';

/** Three sales over two days, by two sellers, one return; with cost, as an Admin sees it. */
export const ADMIN_REPORT: DailySales = {
  date_from: '2026-10-01',
  date_to: '2026-10-07',
  seller: null,
  summary: {
    sales: '255.00',
    sales_khr: '1045500',
    invoices: 3,
    average: '85.00',
    discount: '5.00',
    cost: '182.60',
    profit: '72.40',
    margin: '28.4',
    returns_total: '52.00',
    returns_count: 1,
  },
  by_day: [
    {
      date: '2026-10-07',
      invoices: 2,
      cash: '73.00',
      khqr: '50.00',
      credit: '54.00',
      sales: '177.00',
      cost: '130.20',
      profit: '46.80',
    },
    {
      date: '2026-10-06',
      invoices: 1,
      cash: '78.00',
      khqr: '0.00',
      credit: '0.00',
      sales: '78.00',
      cost: '52.40',
      profit: '25.60',
    },
  ],
  by_seller: [
    {
      seller: 2,
      seller_name: 'Sokha Chan',
      invoices: 2,
      sales: '177.00',
      average: '88.50',
      discount: '5.00',
    },
    {
      seller: 1,
      seller_name: 'Bopha Ly',
      invoices: 1,
      sales: '78.00',
      average: '78.00',
      discount: '0.00',
    },
  ],
  by_tender: [
    { tender: 'CASH', amount: '151.00', share: '59.2' },
    { tender: 'KHQR', amount: '50.00', share: '19.6' },
    { tender: 'CREDIT', amount: '54.00', share: '21.2' },
  ],
};

/** Sokha Chan's own sales, as a Seller sees them: no cost, no profit. */
export const SELLER_REPORT: DailySales = {
  ...ADMIN_REPORT,
  seller: 2,
  summary: {
    ...ADMIN_REPORT.summary,
    sales: '177.00',
    sales_khr: '725700',
    invoices: 2,
    average: '88.50',
    cost: null,
    profit: null,
    margin: null,
    returns_total: '0.00',
    returns_count: 0,
  },
  by_day: [{ ...ADMIN_REPORT.by_day[0], cost: null, profit: null }],
  by_seller: [ADMIN_REPORT.by_seller[0]],
  by_tender: [
    { tender: 'CASH', amount: '73.00', share: '41.2' },
    { tender: 'KHQR', amount: '50.00', share: '28.2' },
    { tender: 'CREDIT', amount: '54.00', share: '30.5' },
  ],
};

const row = (
  r: Partial<StockOnHand['rows'][number]> &
    Pick<StockOnHand['rows'][number], 'product' | 'code' | 'name'>,
) => ({
  brand_name: 'Total',
  unit_name: 'Piece',
  shelf_location: '',
  qty_on_hand: '10.00',
  reorder_level: '0.00',
  avg_cost: '40.0000',
  value: '400.00',
  last_moved: '2026-10-05',
  status: 'OK' as const,
  ...r,
});

/** One product of each status listed; the summary covers all five in stock. With cost, as an Admin sees it. */
export const STOCK_REPORT: StockOnHand = {
  as_at: '2026-10-07',
  summary: {
    products: 5,
    value: '1752.00',
    below_reorder: 2,
    out_of_stock: 1,
    no_movement: 1,
    no_movement_value: '244.00',
    last_count: {
      number: 'CNT-000002',
      date: '2026-09-30',
      category: 'Hand tools',
      differences: 7,
      value: '-23.49',
    },
  },
  rows: [
    row({
      product: 11,
      code: 'TL-0101',
      name: 'Impact drill 13mm 710W',
      brand_name: 'Bosch',
      shelf_location: 'A1-1',
      qty_on_hand: '20.00',
      reorder_level: '25.00',
      avg_cost: '52.4000',
      value: '1048.00',
      status: 'REORDER',
    }),
    row({
      product: 12,
      code: 'TL-0118',
      name: 'Angle grinder 100mm 570W',
      brand_name: 'Makita',
      qty_on_hand: '0.00',
      avg_cost: '38.9000',
      value: '0.00',
      status: 'OUT',
    }),
    row({ product: 13, code: 'TL-0130', name: 'Circular saw 185mm 1400W' }),
    row({
      product: 14,
      code: 'TL-0150',
      name: 'Cordless driver 12V',
      brand_name: null,
      qty_on_hand: '4.00',
      avg_cost: '61.0000',
      value: '244.00',
      last_moved: '2026-06-29',
      status: 'IDLE',
    }),
  ],
  rows_value: '1692.00',
};

/** The same, as a Seller sees it: no cost or value. */
export const STOCK_REPORT_SELLER: StockOnHand = {
  ...STOCK_REPORT,
  summary: {
    ...STOCK_REPORT.summary,
    value: null,
    no_movement_value: null,
    last_count: { ...STOCK_REPORT.summary.last_count!, value: null },
  },
  rows: STOCK_REPORT.rows.map((r) => ({ ...r, avg_cost: null, value: null })),
  rows_value: null,
};

/** Sok Shop over its limit with a debt past 90 days; Dara Grocery on hold. */
export const RECEIVABLES: Receivables = {
  as_at: '2026-10-07',
  summary: {
    owed: '303.00',
    owed_khr: '1242300',
    rate: '4100.000000',
    past_60: '182.00',
    past_60_share: '60.1',
    collected_this_month: '40.00',
    flagged: ['Sok Shop', 'Dara Grocery'],
  },
  rows: [
    {
      customer: 2,
      code: 'CUS-000001',
      name: 'Sok Shop',
      d0_30: '52.00',
      d31_60: '69.00',
      d61_90: '0.00',
      over_90: '98.00',
      owed: '219.00',
      credit_limit: '200.00',
      room_left: '-19.00',
      overdue: true,
      over_limit: true,
      on_hold: false,
    },
    {
      customer: 3,
      code: 'CUS-000002',
      name: 'Dara Grocery',
      d0_30: '0.00',
      d31_60: '0.00',
      d61_90: '84.00',
      over_90: '0.00',
      owed: '84.00',
      credit_limit: '1200.00',
      room_left: '1116.00',
      overdue: true,
      over_limit: false,
      on_hold: true,
    },
  ],
  totals: {
    d0_30: '52.00',
    d31_60: '69.00',
    d61_90: '84.00',
    over_90: '98.00',
    owed: '303.00',
    credit_limit: '1400.00',
    room_left: '1097.00',
  },
};

const week = (sales: string[], shares: string[]) =>
  sales.map((amount, n) => ({ date: `2026-10-0${n + 1}`, sales: amount, share: shares[n] }));

/** A Wednesday, as an Admin sees it: the whole shop, with cost and the money owed. */
export const DASHBOARD: Dashboard = {
  as_at: '2026-10-07',
  sales: {
    seller: null,
    today: {
      sales: '1284.50',
      sales_khr: '5266450',
      invoices: 47,
      average: '27.33',
      profit: '312.80',
      margin: '24.4',
    },
    last_7_days: week(
      ['980.00', '1120.00', '860.00', '1340.00', '1205.00', '1490.00', '1284.50'],
      ['65.8', '75.2', '57.7', '89.9', '80.9', '100.0', '86.2'],
    ),
    by_category: [
      { category: 1, name: 'Power tools', sales: '488.10', share: '38.0' },
      { category: 2, name: 'Hand tools', sales: '346.80', share: '27.0' },
      { category: 3, name: 'Fasteners', sales: '231.20', share: '18.0' },
      { category: 4, name: 'Paint', sales: '141.30', share: '11.0' },
      { category: null, name: 'Other', sales: '77.10', share: '6.0' },
    ],
    recent: [
      {
        id: 147,
        number: 'INV-20261007047',
        sale_date: '2026-10-07T15:42:00',
        customer_name: 'Walk-in',
        walk_in_name: '',
        paid_by: 'CASH',
        total: '12.40',
      },
      {
        id: 146,
        number: 'INV-20261007046',
        sale_date: '2026-10-07T15:20:00',
        customer_name: 'Sok Shop',
        walk_in_name: '',
        paid_by: 'CREDIT',
        total: '186.00',
      },
      {
        id: 145,
        number: 'INV-20261007045',
        sale_date: '2026-10-07T14:58:00',
        customer_name: 'Walk-in',
        walk_in_name: 'Mr Vuthy',
        paid_by: 'MIXED',
        total: '8.75',
      },
    ],
  },
  cash_today: { sales: '612.15', payments: '40.00', refunds: '18.00', total: '634.15' },
  stock: {
    products: 412,
    value: '18472.30',
    below_reorder: 6,
    out_of_stock: 2,
    running_low: [
      {
        product: 12,
        code: 'TL-0118',
        name: 'Angle grinder 100mm 570W',
        unit_name: 'Piece',
        qty_on_hand: '0.00',
        reorder_level: '5.00',
        status: 'OUT',
      },
      {
        product: 11,
        code: 'TL-0101',
        name: 'Impact drill 13mm 710W',
        unit_name: 'Piece',
        qty_on_hand: '7.00',
        reorder_level: '20.00',
        status: 'REORDER',
      },
    ],
    more: 4,
  },
  owed: {
    owed: '403.00',
    over_90: '98.00',
    rows: RECEIVABLES.rows,
    totals: { ...RECEIVABLES.totals, d0_30: '152.00', owed: '403.00' },
    more: 1,
  },
  held_sales: 2,
  quotations: { sent: 3, expiring: 1, expired: 1 },
  warranty: { open: 4, out_of_warranty: 1 },
};

/** The same day as Sokha Chan (the Seller, id 2) sees it: their own sales, no money. */
export const DASHBOARD_SELLER: Dashboard = {
  ...DASHBOARD,
  sales: {
    ...DASHBOARD.sales!,
    seller: 2,
    today: {
      sales: '361.45',
      sales_khr: '1481945',
      invoices: 12,
      average: '30.12',
      profit: null,
      margin: null,
    },
    recent: [DASHBOARD.sales!.recent[0]],
  },
  cash_today: null,
  stock: { ...DASHBOARD.stock!, value: null },
  owed: null,
};
