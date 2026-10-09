<!-- v1.5.2 — handover context for Claude Code. Place at the repo root as CLAUDE.md. -->

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

### Deploying

Production is **https://pos.bgs-badminton.store**, on the EC2 that runs the
backend (13.228.216.165), as its own nginx site
(`deploy/nginx/pos-frontend.conf`) serving `/var/www/pos-frontend`. The
owner deploys by pulling `main` on the EC2 and running `deploy/deploy.sh`
(pull, `npm ci`, build, copy); the steps are in `deploy/README.md`. Merge
into `main` before deploying. The app alone for now (2026-10-09): `/api/` is
not yet connected on that name, so signing in there waits for the API step.

The build's fonts go to `fonts/`, not Angular's default `media/`
(`outputPath.media` in `angular.json`): `/media/` is Django's uploads.

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
- **Operations** (agreed 2026-10-06). Built one screen at a time, each planned
  in `tasks/todo.md` and agreed first: Quotations → Sell → Customer payment →
  Returns & voids → Warranty claims. Warranty claims needs its backend built
  first (the seven agreed fields plus customer name and phone). Printing —
  receipts, invoices, quotations, payment receipts — is its own step after
  the five screens; Print buttons stay hidden until then. The till keeps a
  sale in the browser until Complete or Hold.
- **Quotations** (built 2026-10-06). Mark sent and Mark accepted were added
  (the mockup had no way to move a quote on); no quote-level discount, which
  the backend dropped; "Expired" is a warning pill, not a status or filter.
- **Sell, the till** (built 2026-10-06). A new sale starts on Walk-in;
  scanning a product already on the sale adds one; a sale in progress
  survives a reload of its tab (session storage, for the signed-in user
  only). A customer on credit hold can be chosen, cash only. A sale from a
  quotation takes only the quotation's lines, so the picker is off. Held
  sales can be found and resumed (the mockup had no way back). The line table
  has no # or Unit column — the unit sits on the product's second line — so
  it fits the till's column. No invoice discount; no printing yet.
- **Customer payment** (built 2026-10-06). The dialog lists the customer's
  open invoices and fills the oldest first; any line can then be changed,
  and what is left to apply must reach zero before Save. Filters only, no
  search; counts only on the tiles. Void is Admin only, through a new
  `payment.void` scope (owner's choice), and asks why.
- **Returns & voids** (built 2026-10-06). A Returns | Voided invoices
  switch, each its own table paged by the server — the API has two lists —
  rather than the mockup's mixed table. The invoice is chosen from a picker
  that searches by number or walk-in name; a Seller voiding sees only their
  own invoices from today. A return is saved as a draft or posted; ticking a
  line puts in all that can still come back. The server decides what is
  credited and what refunded, so only the refund method is asked, and only
  when there is a refund. The voided list's period is by the date sold. No
  search on the list, counts only on the tiles.
- **Warranty claims** (built 2026-10-06, backend first). The product is
  picked from the catalogue (it fills code, name and warranty months) or
  typed, and kept as text. The customer's name and phone are both optional.
  An Admin may delete a claim (`warranty.delete`); a Seller closes or rejects
  it instead. The `WRC-` counter is gone — a claim is known by its warranty
  card's number. "Out of warranty" means claimed after the end date. Open
  claims show first; the tiles count open claims. No Export.
- **Sales** (built 2026-10-07, the owner's request). Sell is a group: Till
  (the till) and Sales (every completed or voided sale). Both roles see every
  sale; "Sold by" narrows it (a Seller gets Everyone or Me — the staff list
  is Admin only). Today by default, or a period, or a From–To range. Held
  sales are left out (`held=false`) — they wait in the till's Held sales. A
  sale opens read only, with its payments and returns, cost and profit for
  `cost.view`, and Void… for whoever may void it (an Admin any, a Seller
  their own the same day).
- **Printing a sale's invoice** (built 2026-10-07, step 5d-1). Print invoice
  on Sale completed; Print on a sale opened from Sales, marked COPY; never
  for a void sale. The paper, language and switches come from Company →
  Profile → Receipt: 80 mm or 58 mm prints a roll, A5 a page; English,
  Khmer or both; the riel total, the rate and the seller only when switched
  on. A sale with something on credit prints the shown payment notes with
  their QR. Each line prints its warranty, and a roll uses the product's
  short name. The Khmer labels were drafted for the owner to check
  (`shared/print/print-labels.ts`).
- **Printing quotations and payment receipts** (built 2026-10-07, step
  5d-2). A quotation prints on A4 always, in dollars only (it holds no
  rate), with the customer's phone and address under "Quotation for", the
  terms under the total, and DRAFT on a draft; Print in its dialog prints it
  as saved, never with unsaved changes, never a rejected one. A payment
  receipt prints on the receipt paper with what it paid off and "Still owed
  on <the day printed>"; Save and print receipt on Record a payment (the
  payment stands even if printing fails), Print on a saved one (COPY), none
  for a void one.
- **Reports** (agreed 2026-10-07): one at a time, each its backend endpoint
  then its screen — Daily sales → Stock on hand → Receivables → Dashboard
  last. No Export for now.
- **Daily sales** (built 2026-10-07, step 6a). This month by default, or
  Today, Last 7 days, or a From–To range; an Admin picks a seller, a Seller
  sees only their own (the backend holds them to it) and no cost or profit.
  No tender filter — the By tender table and the Cash / KHQR / Credit
  columns split every sale. Cash is the sale less KHQR and credit (what
  stayed in the drawer after change). Returns are shown apart, not taken
  off.
- **Stock on hand** (built 2026-10-07, step 6b). As at today only; every
  matching product on one page; status (out of stock, reorder, no movement,
  OK — the first that applies), category, brand and a search. "No
  movement" is fixed at 90 days. The tiles cover all stock whatever the
  filters; a Seller sees quantities but no cost or value. Retired products
  still holding stock stay listed. A Last moved column was added.
- **Receivables** (built 2026-10-07, step 6c). Admin only. A debt is aged
  by the days since its invoice (0–30, 31–60, 61–90, over 90); only
  customers who owe are listed; filter all, overdue, over limit, on hold.
  Open shows the customer's open invoices (from their account) with Paid
  and Returned apart, and Record a payment opens the payment dialog with
  that customer already chosen; the report reloads after. No statements,
  no Export.
- **Dashboard** (built 2026-10-07, step 6d). The mockup's layout from one
  call. "Cash in drawer" became **Cash taken today** — cash sales after
  change, plus cash payments, less cash refunds; not a drawer count (no
  float, and a refund does not record $ or ៛). A Seller sees their own
  sales (no profit, cash, money owed or stock value), so their Below
  reorder joins the to-do tiles in one row of four. Sales by category is
  today's. Three tiles beyond the mockup link to their screens: held sales
  (to the Till), quotations sent and not answered (expiring within 7 days,
  expired), open warranty claims (out of warranty). Recent sales open read
  only, as from Sales. No auto-refresh, no comparison, no Export.
- **Brand and category on stock lines** (added 2026-10-09, the owner's
  request). On Stock in, Adjustments and Stock count, a line's Product cell
  reads name, code, then "Makita · Drills" — the category's own name, not
  its group; just the category when there is no brand. Both while a draft
  is entered and on a posted document.

---

## Layout

```
src/app/
  api/         GENERATED — ng-openapi-gen output, never edited
  core/        app-wide singletons: session, interceptors, guards, the shell
  shared/      reused pieces: money pipes ($ and ៛), table, dialog, inputs
  features/    one folder per mockup menu, each a lazy-loaded route:
               sell, sales, quotations, payments, returns, warranty, stock,
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
- A line names its product's brand and category with `brandAndCategory()`
  (`stock-common.ts`): from the product lookup for a line just picked, from
  the line itself once saved. Specs read a cell's lines through its
  `.cell-sub` spans — the text of the whole cell runs them together.

**Patterns the quotations screen added:**

- A sale line is priced with `priceLine()` (`shared/sales/sales-common.ts`),
  which follows the backend's `net_price()`: the 15% cap (`DISCOUNT_CAP`,
  copied from `sales/money.py` — absolute, Admin included), a fixed price
  takes no discount, the net price rounds half up, and the line total
  (`net × qty`) rounds **half to even** — Python's default, which the backend
  uses there. The till and returns should use it too.
- An action the server records with a reason (reject, void) asks through
  `askReason()` (`shared/dialog/reason-dialog.ts`), which sends it and shows
  a refusal in the server's words.
- A saved line does not say whether its product's price is fixed, so only a
  line picked in this session shows "Price fixed"; for a saved one the server
  refuses the discount.

**Patterns the till added:**

- How payments settle a sale is previewed with `settle()`
  (`shared/sales/sales-common.ts`), as the backend's: riel at the sale's
  rate, change as whole dollars plus riel to the nearest ៛100
  (`roundKhr()`), a shortfall under ៛50 paid in riel taken as rounding, and
  "paid now" as what has been taken so far.
- The sale is a service of signals (`features/sell/sale.ts`) provided by the
  Sell page; its parts (`sale-buyer`, `sale-lines`, `sale-money`) inject it.
  A big page is split into parts like this — one long template is hard to
  write and review.
- Complete creates the sale as a held invoice and completes it in one go; if
  the server refuses, the new held invoice is deleted again, so a refused
  sale leaves nothing behind. A resumed held sale is updated, not recreated.

**Patterns the payment screen added:**

- Riel is turned into dollars at the rate of the document's date —
  `rateOn()` picks the latest rate on or before it
  (`features/payments/payments-common.ts`), then `khrToUsd()` — as the
  server stamps it.
- Lines worked out from a figure the user types, but still editable, are a
  `linkedSignal` (`fillOldest()` fills them): typing the amount again or
  choosing another customer refills them; editing a line keeps the edit
  until then.
- A payment is always sent with its allocations, as shown, so the server
  never applies it differently from the screen.

**Patterns the returns screen added:**

- "Choose an invoice" (`features/returns/invoice-picker.ts`) lists completed
  invoices with their lines, newest first. Warranty claims can reuse it.
- A return's value is previewed line by line as net price × quantity,
  rounded half to even, and `split()` (`returns-common.ts`) shows how it
  settles: first off what the invoice still owes (from the customer's
  account), the rest refunded.
- Two lists from two endpoints on one screen: each `rxResource` gets
  `undefined` params while its list is hidden, so it sends nothing.

**Patterns the warranty screen added:**

- `<app-product-picker>` can fill a form as well as add document lines
  (`[stockOnly]="false"`, its own `addLabel`). Put it outside the `<form>`.
- `dayOf()` (`shared/dates.ts`) is the calendar day a timestamp falls on
  here, to compare with a date field as text.
- An action beyond view and edit — voiding a payment, deleting a claim — is
  its own scope in the backend's `scopes.py`, so the button follows the
  scope rule like every other.
- A list's search box is 300px wide (`_filters.scss`), so its placeholder
  shows.

**Patterns the sales screen added:**

- Who may void a sale is offered by `mayVoid()`
  (`features/sales/sale-rules.ts`), from the scopes and the sale's seller and
  day; the backend's `CanVoidInvoice` still decides.
- A filter a Seller cannot fill from the API (the staff list) offers what
  they can: Everyone or Me.

**Patterns printing added:**

- Print through `Printer` (`shared/print/printer.ts`): it loads what the
  paper needs, mounts a print-only component in `#print-root`, sets the
  `@page` for the paper, waits for the images, calls the browser's print,
  and removes it all. `_print.scss` hides `#print-root` on screen and
  everything else on paper — and keeps the app's table look off the paper.
- Each printed document is a component (`invoice-print`, `quotation-print`,
  `payment-print`) sharing `<app-print-shop>` for the header and
  `print-common.ts`; `Printer` mounts any of them with its inputs and paper.
- A printed word goes through `label()` (`print-labels.ts`); a whole phrase
  that reads differently in Khmer (the warranty) gets its own function.
- A report's figures are the server's; the screen only lays them out (no
  sums in the browser — the totals row is the summary the API sent).
- A report's wide table sits in `.report-wrap` (`_tables.scss`): tighter
  cells, and it scrolls inside its panel, never the page.
- A dialog that usually starts empty can be given its starting point as
  optional `DIALOG_DATA` — Record a payment takes a customer that way.
- Specs spy on `window.print` and read `#print-root` at that moment; the
  live check prints to PDF from headless Chrome (`Page.printToPDF`) at each
  paper size and looks at it.

**Patterns the dashboard added:**

- A page whose parts follow different scopes loads from one endpoint that
  sends each part `null` to whoever may not see it; the page leaves a null
  part out — no `*hasScope` and no role names.
- A tile that opens its screen is an `<a class="tile">` (`_figures.scss`).
- A spec that lands on `/` must answer the dashboard's request
  (`DASHBOARD`, `DASHBOARD_URL` in `features/reports/reports-testing.ts`).

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
| 5b | Stock: stock in, adjustments, stock count, CSV/Excel import, reversal — and Partners → Supplier products, whose pack fills stock-in lines in | Done — posting and reversing checked live (database dumped and restored) |
| 5c-1 | Quotations | Done |
| 5c-2 | Sell (the till) | Done |
| 5c-3 | Customer payment | Done |
| 5c-4 | Returns & voids | Done |
| 5c-5 | Warranty claims — backend first (model and API, with customer name and phone) | Done |
| 5c-6 | Sales: every sale by date, status, seller and number (Sell → Sales) | Done |
| 5d-1 | Printing: a sale's invoice, at the till and from Sales, on the receipt paper | Done — Khmer labels to be checked by the owner |
| 5d-2 | Printing: quotations (A4) and payment receipts (receipt paper) | Done |
| 6a | Reports → Daily sales (backend `reports` app first) | Done |
| 6b | Reports → Stock on hand | Done |
| 6c | Reports → Receivables | Done |
| 6d | Dashboard (backend endpoint first) | Done |

**Not built yet:** Users (greyed out in the menu).
