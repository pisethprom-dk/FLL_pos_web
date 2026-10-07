// v1.10.0 — every screen in the menu: its label, path, title and the scopes
// that open it. The menu and the route guards both read from here, so they
// cannot disagree. Set `ready` to true when a screen is built; until then the
// menu shows it greyed out.
import { Route } from '@angular/router';
import { scopeGuard } from '../session/guards';

export interface Screen {
  /** In the menu. */
  readonly label: string;
  /** In the top bar and the browser tab. */
  readonly title: string;
  readonly path: string;
  /** Any one of these opens it. Empty: everyone signed in. */
  readonly scopes: readonly string[];
  readonly ready: boolean;
}

export const SCREENS = {
  // A placeholder until the reports API (backend slice 6).
  dashboard: { label: 'Dashboard', title: 'Dashboard', path: '', scopes: [], ready: true },

  sell: { label: 'Till', title: 'Till', path: 'sell', scopes: ['sell'], ready: true },
  sales: { label: 'Sales', title: 'Sales', path: 'sales', scopes: ['sell'], ready: true },
  quotations: {
    label: 'Quotations',
    title: 'Quotations',
    path: 'quotations',
    scopes: ['quotation.view'],
    ready: true,
  },
  payments: {
    label: 'Customer payment',
    title: 'Customer payment',
    path: 'payments',
    scopes: ['payment.view'],
    ready: true,
  },
  returns: {
    label: 'Returns & voids',
    title: 'Returns & voids',
    path: 'returns',
    scopes: ['return.view'],
    ready: true,
  },
  warranty: {
    label: 'Warranty claims',
    title: 'Warranty claims',
    path: 'warranty',
    scopes: ['warranty.view'],
    ready: true,
  },
  stockIn: {
    label: 'Stock in',
    title: 'Stock in',
    path: 'stock/in',
    scopes: ['stock.view'],
    ready: true,
  },
  adjustments: {
    label: 'Adjustments',
    title: 'Adjustments',
    path: 'stock/adjustments',
    scopes: ['stock.view'],
    ready: true,
  },
  stockCount: {
    label: 'Stock count',
    title: 'Stock count',
    path: 'stock/counts',
    scopes: ['stock.view'],
    ready: true,
  },

  dailySales: {
    label: 'Daily sales',
    title: 'Daily sales',
    path: 'reports/daily-sales',
    scopes: ['report.sales.all', 'report.sales.own'],
    ready: false,
  },
  stockOnHand: {
    label: 'Stock on hand',
    title: 'Stock on hand',
    path: 'reports/stock-on-hand',
    scopes: ['report.stock'],
    ready: false,
  },
  receivables: {
    label: 'Receivables',
    title: 'Receivables',
    path: 'reports/receivables',
    scopes: ['report.receivables'],
    ready: false,
  },

  products: {
    label: 'Products',
    title: 'Products',
    path: 'catalogue/products',
    scopes: ['catalogue.view'],
    ready: true,
  },
  categories: {
    label: 'Categories',
    title: 'Categories',
    path: 'catalogue/categories',
    scopes: ['catalogue.view'],
    ready: true,
  },
  brands: {
    label: 'Brands',
    title: 'Brands',
    path: 'catalogue/brands',
    scopes: ['catalogue.view'],
    ready: true,
  },
  // Not in the mockup: added with the catalogue (owner's choice, 2026-10-05).
  units: {
    label: 'Units',
    title: 'Units',
    path: 'catalogue/units',
    scopes: ['catalogue.view'],
    ready: true,
  },
  customers: {
    label: 'Customers',
    title: 'Customers',
    path: 'partners/customers',
    scopes: ['partner.view'],
    ready: true,
  },
  suppliers: {
    label: 'Suppliers',
    title: 'Suppliers',
    path: 'partners/suppliers',
    scopes: ['partner.view'],
    ready: true,
  },
  // Not in the mockup: which supplier carries which product, built with the
  // stock screens (owner's choice, 2026-10-05).
  supplierProducts: {
    label: 'Supplier products',
    title: 'Supplier products',
    path: 'partners/supplier-products',
    scopes: ['partner.view'],
    ready: true,
  },
  companyProfile: {
    label: 'Profile',
    title: 'Company — profile',
    path: 'company/profile',
    scopes: ['company.view'],
    ready: true,
  },
  exchangeRate: {
    label: 'Exchange rate',
    title: 'Company — exchange rate',
    path: 'company/exchange-rate',
    scopes: ['company.view'],
    ready: true,
  },
  paymentNotes: {
    label: 'Payment notes',
    title: 'Company — payment notes',
    path: 'company/payment-notes',
    scopes: ['company.view'],
    ready: true,
  },
  numbering: {
    label: 'Rules & numbering',
    title: 'Company — rules & numbering',
    path: 'company/numbering',
    scopes: ['company.view'],
    ready: true,
  },
  // Not in the mockup.
  users: { label: 'Users', title: 'Users', path: 'users', scopes: ['user.manage'], ready: false },
} as const satisfies Record<string, Screen>;

export type ScreenId = keyof typeof SCREENS;

export interface MenuGroup {
  readonly group: string;
  readonly label: string;
  readonly screens: readonly ScreenId[];
}

export interface MenuSection {
  readonly heading: string | null;
  readonly entries: readonly (ScreenId | MenuGroup)[];
}

/** The sidebar, in the mockup's order. */
export const MENU: readonly MenuSection[] = [
  { heading: null, entries: ['dashboard'] },
  {
    heading: 'Operations',
    entries: [
      { group: 'sell', label: 'Sell', screens: ['sell', 'sales'] },
      'quotations',
      'payments',
      'returns',
      'warranty',
      { group: 'stock', label: 'Stock', screens: ['stockIn', 'adjustments', 'stockCount'] },
    ],
  },
  { heading: 'Reports', entries: ['dailySales', 'stockOnHand', 'receivables'] },
  {
    heading: 'Setup',
    entries: [
      {
        group: 'catalogue',
        label: 'Catalogue',
        screens: ['products', 'categories', 'brands', 'units'],
      },
      'customers',
      'suppliers',
      'supplierProducts',
      {
        group: 'company',
        label: 'Company',
        screens: ['companyProfile', 'exchangeRate', 'paymentNotes', 'numbering'],
      },
      'users',
    ],
  },
];

/** A route for a screen: path, title and scope check all come from its entry above. */
export function screenRoute(screen: Screen, route: Route): Route {
  return {
    ...route,
    path: screen.path,
    title: screen.title,
    canActivate: [scopeGuard, ...(route.canActivate ?? [])],
    data: { ...route.data, scopes: screen.scopes },
  };
}
