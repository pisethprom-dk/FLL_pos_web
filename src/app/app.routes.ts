// v1.10.0 — top-level routes. A screen inside the shell is added with
// screenRoute(SCREENS.x, ...), which takes its path, title and scope check
// from core/shell/screens.ts.
import { Routes } from '@angular/router';
import { ChangePassword } from './core/change-password/change-password';
import { Login } from './core/login/login';
import { NotAllowed } from './core/not-allowed/not-allowed';
import { passwordChangedGuard, signedInGuard, signedOutGuard } from './core/session/guards';
import { SCREENS, screenRoute } from './core/shell/screens';
import { Shell } from './core/shell/shell';

export const routes: Routes = [
  { path: 'login', title: 'Sign in', canActivate: [signedOutGuard], component: Login },
  {
    path: 'change-password',
    title: 'Change password',
    canActivate: [signedInGuard],
    component: ChangePassword,
  },
  {
    path: '',
    component: Shell,
    canActivate: [signedInGuard, passwordChangedGuard],
    children: [
      screenRoute(SCREENS.dashboard, {
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      }),
      { path: 'not-allowed', title: 'Not available', component: NotAllowed },

      // Operations
      screenRoute(SCREENS.sell, {
        loadComponent: () => import('./features/sell/sell').then((m) => m.Sell),
      }),
      screenRoute(SCREENS.sales, {
        loadComponent: () => import('./features/sales/sales').then((m) => m.Sales),
      }),
      screenRoute(SCREENS.payments, {
        loadComponent: () => import('./features/payments/payments').then((m) => m.Payments),
      }),
      screenRoute(SCREENS.returns, {
        loadComponent: () => import('./features/returns/returns').then((m) => m.Returns),
      }),
      screenRoute(SCREENS.warranty, {
        loadComponent: () => import('./features/warranty/claims').then((m) => m.Claims),
      }),
      screenRoute(SCREENS.quotations, {
        loadComponent: () => import('./features/quotations/quotations').then((m) => m.Quotations),
      }),

      // Stock
      screenRoute(SCREENS.stockIn, {
        loadComponent: () => import('./features/stock/stock-in/stock-ins').then((m) => m.StockIns),
      }),
      screenRoute(SCREENS.adjustments, {
        loadComponent: () =>
          import('./features/stock/adjustments/adjustments').then((m) => m.Adjustments),
      }),
      screenRoute(SCREENS.stockCount, {
        loadComponent: () => import('./features/stock/counts/counts').then((m) => m.Counts),
      }),

      // Catalogue
      screenRoute(SCREENS.products, {
        loadComponent: () =>
          import('./features/catalogue/products/products').then((m) => m.Products),
      }),
      screenRoute(SCREENS.categories, {
        loadComponent: () =>
          import('./features/catalogue/categories/categories').then((m) => m.Categories),
      }),
      screenRoute(SCREENS.brands, {
        loadComponent: () => import('./features/catalogue/brands/brands').then((m) => m.Brands),
      }),
      screenRoute(SCREENS.units, {
        loadComponent: () => import('./features/catalogue/units/units').then((m) => m.Units),
      }),

      // Partners
      screenRoute(SCREENS.customers, {
        loadComponent: () =>
          import('./features/partners/customers/customers').then((m) => m.Customers),
      }),
      screenRoute(SCREENS.suppliers, {
        loadComponent: () =>
          import('./features/partners/suppliers/suppliers').then((m) => m.Suppliers),
      }),
      screenRoute(SCREENS.supplierProducts, {
        loadComponent: () =>
          import('./features/partners/supplier-products/supplier-products').then(
            (m) => m.SupplierProducts,
          ),
      }),

      // Company
      screenRoute(SCREENS.companyProfile, {
        loadComponent: () => import('./features/company/profile/profile').then((m) => m.Profile),
      }),
      screenRoute(SCREENS.exchangeRate, {
        loadComponent: () =>
          import('./features/company/exchange-rates/exchange-rates').then((m) => m.ExchangeRates),
      }),
      screenRoute(SCREENS.paymentNotes, {
        loadComponent: () =>
          import('./features/company/payment-notes/payment-notes').then((m) => m.PaymentNotes),
      }),
      screenRoute(SCREENS.numbering, {
        loadComponent: () =>
          import('./features/company/numbering/numbering').then((m) => m.Numbering),
      }),
    ],
  },
  { path: '**', redirectTo: '' },
];
