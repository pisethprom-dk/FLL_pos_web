<!-- v1.2.0 — handover context for Claude Code. Place at the repo root as CLAUDE.md. -->

# POS frontend — Angular 22

Back-office screens for the POS backend in `../pos_backend` (Django + DRF): one
hardware shop in Phnom Penh, prices in US dollars, riel across the counter.

**Read `../pos_backend/CLAUDE.md` for the domain rules.** They are not repeated
here. The backend enforces them; the frontend shows them and never works
around them.

---

## How to work on this project

**Discuss before coding.** The concept and approach must be agreed before any
code is generated. This is a firm rule from the project owner, not a
preference. When a decision is ambiguous, ask — do not pick one and build it.

**Workflow for every task** (owner's rule, 2026-10-06):

1. Think the problem through first: read the code involved, then write the
   plan in `tasks/todo.md`.
2. The plan is a checklist of todo items (`- [ ]`).
3. Check in with the owner before starting work — they verify the plan.
4. Then work through the todos one by one, ticking each off (`- [x]`) as it
   is done.
5. At every step, give a high-level explanation of what changed.
6. Keep every change simple and minimal. No big rewrites.
7. At the end, add a **Review** section to `tasks/todo.md` summarising the
   changes.

**Every hand-written file gets a version comment on line 1**, bumped on every
change: `// v1.0.0` in TypeScript and SCSS, `<!-- v1.0.0 -->` in HTML. Not in
`src/app/api/` (generated) and not in JSON files (JSON has no comments).

**Run the tests and the build before claiming anything works.**

```bash
npm test -- --watch=false
npm run build
```

**UI work is delivered as files, never as code pasted in chat.**

---

## Running it

```bash
nvm use                 # reads .nvmrc → Node 22 (Angular CLI 22 needs ≥ 22.22.3)
npm install
npm start               # http://localhost:4200
```

The backend must be running (`docker compose up -d` in `../pos_backend`).

`npm start` proxies `/api` and `/media` to `http://localhost:8000`
(`proxy.conf.json`), so the browser sees one origin — the same as nginx in
production. That is what lets the refresh cookie (`pos_refresh`, path
`/api/auth/`, httpOnly) work. **Always call relative URLs (`/api/...`); never
`http://localhost:8000` from code.**

If `nvm install` cannot find any version: `~/.zshrc` on this Mac sets
`NVM_NODEJS_ORG_MIRROR` to the retired taobao mirror. Override it for the
command: `NVM_NODEJS_ORG_MIRROR=https://nodejs.org/dist nvm install 22`.

---

## The API client is generated

`src/app/api/` is written by `ng-openapi-gen` from the backend's
`/api/schema/`. **Never edit it.** With the backend running:

```bash
npm run api             # regenerate
npm run build           # the compiler now shows what a backend change broke
```

Commit the generated output, so a build never needs the backend running.

- One injectable service per backend area, returning Observables:
  `AuthService`, `UsersService`, `CompanyService`, `CatalogueService`,
  `PartnersService`, `InventoryService`, `SalesService`. Method names come
  from the backend's operation ids, e.g. `salesInvoicesCompleteCreate`.
- The generated `AuthService` is only the HTTP calls. The app's own session
  state (token, user, scopes) needs another name — e.g. `SessionStore` — so
  the two do not collide.
- **Money arrives as decimal strings** (`"212.05"`). Never `parseFloat` it for
  arithmetic. The till may preview totals with the same rules as the backend,
  but the server is the authority: what prints is what the API returned.
- **A field the user may not see comes back `null`**, not missing — cost and
  profit for a Seller, expected quantity while a count is open.
- If a generated type is wrong, fix the backend schema (see "Keeping the
  schema clean" in the backend CLAUDE.md), then regenerate. Never patch it here.

---

## Decisions already made

Do not re-litigate these without asking.

- **Angular 22**: standalone components, zoneless, strict, SCSS, Vitest, no SSR.
- **Separate repo** from the backend, sibling folder.
- **Screens**: the agreed mockup's own CSS
  (`../pos_backend/mock-up/pos-dashboard-mockup.html`) ported as the app
  stylesheet, with **Angular CDK** for behaviour only — dialogs, overlays,
  tables, keyboard access. No Angular Material, no PrimeNG.
- **API client**: generated services returning Observables
  (`services: true`, `promises: false` in `ng-openapi-gen.json`).
- **Auth** (built, step 3): access token in memory only, never in
  localStorage. An interceptor adds `Bearer`; on a 401 it calls
  `/api/auth/refresh/` once and retries. On start-up the app calls refresh to
  restore the session. Login and refresh both return the user with their
  scopes, which drive route guards and a `*hasScope` directive — no role names
  in components. Each refresh cookie works once, so concurrent refreshes share
  one request, and tabs take turns through a Web Lock. Signing out signs out
  every tab.
- **Fonts**: IBM Plex Sans and Noto Sans Khmer, bundled from `@fontsource`
  (listed in `angular.json` styles), not loaded from Google.
- **Forced password change**: while `must_change_password` is true, the only
  page is `/change-password`. The backend does not enforce this yet.
- **Sign-in look** (agreed 2026-10-05, design A "Workbench"): the shop on the
  sidebar's ink over a pegboard pattern, the form on paper. Login and
  change-password share it through `core/auth-frame`. The shop's name, Khmer
  name, address and logo come from the public `/api/company/brand/`, so they
  show before sign-in; if it fails, the page says "POS back office". English
  labels only — no Khmer labels on the form (owner's choice). Password fields
  use `<app-password-field>`: Show/Hide and a Caps Lock warning.
- **Brand colours** (agreed 2026-10-05, option A "deep teal throughout"),
  measured from the FLL logo and kept as tokens in `src/styles/_tokens.scss`:
  sidebar, sign-in panel and dashboard band in deep teal `--side` (#0B3F45);
  the active menu item in `--brand-yellow` (#FFBE00) with ink text; buttons,
  links and the focus ring in `--primary`, the brand teal (#00727A). Text stays
  ink and riel amounts stay `--khr` gold. **Yellow is never text on the light
  pages** (1.7:1 on white) — only a fill behind dark text, or text on teal. The
  shop's logo (Company → Profile) shows as a circle on the sign-in panel and at
  the top of the sidebar.
- **Stock screens** (agreed 2026-10-05). Which supplier carries which product
  is its own screen, Partners → Supplier products; the link names its pack
  ("Carton" of 24 — `pack_unit` added in the backend), and a stock-in line
  starts with it. Line figures are previewed exactly in the browser
  (`shared/money/exact.ts`) and replaced by the server's on save. The server
  totals adjustments and counts (null until posted). A count saves each line
  as it is entered, because the expected quantity is read at that moment. A
  new document is created on its first save, so a cancelled dialog leaves no
  gap in the numbers. Tiles are counts only; the mockup's money tiles wait for
  the reports API. No Export and no Print count sheet.

---

## Layout

```
src/app/
  api/         GENERATED — ng-openapi-gen output, never edited
  core/        app-wide singletons: session, interceptors, guards, the shell
  shared/      reused pieces: money pipes ($ and ៛), table, dialog, inputs
  features/    one folder per mockup menu, each a lazy-loaded route:
               sell, quotations, payments, returns, warranty, stock,
               reports, catalogue, partners, company, users
src/styles/    the mockup's CSS, one partial per area; changes from the
               mockup are commented where they happen
```

**Adding a screen.** Its entry in `core/shell/screens.ts` holds the menu
label, path, title and scopes. Add the route with
`screenRoute(SCREENS.x, { loadComponent: ... })` in `app.routes.ts` — that
adds the scope check — and set the entry's `ready: true` so the menu links it
instead of greying it out.

**Patterns the company screens set** (reuse them):

- A screen loads with `rxResource` and reloads it after a save. **Check
  `hasValue()` before `value()`** — in Angular 22, `value()` throws while the
  resource is in error, which turns a failed load into a crash instead of the
  `<app-load-error>` "Try again".
- Dialogs open through `shared/dialog/modal.ts` (CDK Dialog in the mockup's
  modal look); `confirm()` in `confirm-dialog.ts` asks before anything that
  cannot be undone. A dialog does its own save and closes with the result.
- Images go through `<app-image-field>`: a new file is sent as multipart
  (`...$FormData`), a removal as JSON with `null` — the multipart variant drops
  nulls.
- Server refusals show under their field, and `clearOnEdit()`
  (`shared/server-errors.ts`) drops each one when that field is edited.
- Specs open the real screen with `openScreen()` (`shared/screen-testing.ts`).
  Resources hold the page "busy" until their calls are answered, so answer
  first (`answer()`), then `whenStable()` — never the other way round.

**Patterns the catalogue screens added:**

- A dropdown's reference list (categories, brands, units) loads with
  `fetchAll()` (`shared/fetch-all.ts`), which follows `next` — the API pages
  at 50 and a list must never silently stop there.
- A long list pages on the server: `<app-pager>`, and every filter change
  goes back to page 1. Keep the last page on screen while the next loads
  (`linkedSignal`, see `products.ts`) — a resource drops its value when its
  params change.
- A multipart upload with a nullable link (brand, parent) goes through
  `forMultipart()` (`shared/multipart.ts`): nulls become empty text, which
  the server reads as "none". Never for the file field itself.
- Cost columns and fields show only with `cost.view`; the API sends them as
  null to anyone else.
- Records are never deleted: Deactivate (with `confirm()`) sets
  `is_active: false`; ticking Active brings one back.

**Patterns the stock screens added:**

- A document's lines are picked with `<app-product-picker>`
  (`shared/product-picker/`): a code or barcode box that adds on Enter, plus
  brand and category lists. `stockOnly` keeps out products that track no
  stock. The till and quotations should reuse it.
- A document dialog opens with `document: true` (1040px — nine line columns do
  not fit 780) and `guarded: true`: Escape and the veil then go through the
  dialog's own `close()`, which asks with `confirmDiscard()` before unsaved
  lines are lost (`shared/dialog/guard-close.ts`).
- A preview of money is worked out with `times()`, `over()` and `sum()` from
  `shared/money/exact.ts` — whole digits in BigInt, halves away from zero, as
  the backend rounds. Never floats, and never the figure that is printed.
- A document dialog closes with `'saved'` or `{ open: doc }` (a reversal just
  posted), and the list opens that one next (`DocResult` in
  `features/stock/stock-common.ts`).
- A refusal about a document's lines comes back as one entry per line;
  `readApiErrors()` reads it as "Line 2: …".

---

## Current state

| Step | What | Status |
|---|---|---|
| 1 | Backend schema clean (0 warnings, tested) | Done — in the backend |
| 2 | Scaffold, proxy, generated client | Done |
| 3 | Core: session, interceptor, guards, `*hasScope`, shell from the mockup, login | Done |
| 3a | Company: profile, exchange rate, payment notes, rules & numbering (quotation and invoice prefixes only — owner's choice) | Done |
| 4 | Catalogue: products, categories, brands, units (Units not in the mockup — owner's choice) | Done |
| 5a | Partners: customers (what each owes shows in their dialog, from the sales account) and suppliers (no tiles) | Done |
| 5b | Stock: stock in, adjustments, stock count, CSV/Excel import, reversal — and Partners → Supplier products, whose pack fills stock-in lines in | Done — posting and reversing not yet tried against the live backend (needs a database dump first) |
| 5c | Quotations, the till (Sell), customer payments, returns & voids | **Next** — agree the design first |

**No API yet for:** Dashboard, Daily sales, Stock on hand, Receivables
(backend slice 6), and Warranty claims (not assigned to a slice).
