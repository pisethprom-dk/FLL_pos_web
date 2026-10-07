<!-- v1.17.3 -->
# Sample sales data — two rows for each thin screen

The catalogue and stock screens already hold plenty (88 products, 5
suppliers, 22 stock-ins, 17 adjustments, 3 counts). The selling side is
nearly empty: one store customer, one payment note, one quotation, two
sales, and no payments, returns, voids, held sales or warranty claims.

Owner's choices (2026-10-07): only the thin screens; a backend command
beside `seed_demo` and `seed_stock_demo`; dated over recent weeks; the
database dumped first; one exchange-rate row added — ៛4,100 from 1 Sep 2026
— so a sale can be dated before 2 Oct.

## Design

**`manage.py seed_sales_demo --admin Piseth --seller Heng`**
(`sales/management/commands/`). Development only, like the other two.
- Each document goes through `sales/services.py` — the code the screens
  post through — in date order, run as of its own day (the clock set to
  that day, in shop hours). So the invoice number (`INV-20260902001`), the
  rate, the due date, the stock movement and every stamp are what entering
  it that day would have made.
- A back-dated sale only takes products with no stock movement since its
  day, so each product's ledger stays in date order and `recompute_stock
  --check` finds no drift.
- It refuses to run twice (its customers already exist). Going back is by
  the dump.

**What it adds** (two of each):

| Screen | Rows |
|---|---|
| Exchange rate | ៛4,100 from 1 Sep 2026 (one row, as asked) |
| Customers | Sok Heng Construction (wholesale, credit $2,000, 30 days); Dara Home Repair (wholesale, credit $500, 15 days) |
| Payment notes | "Cash at the counter" — no bank details, so no made-up account ever prints on a real invoice |
| Quotations | Sok Heng: 1 Sep, sent, accepted 2 Sep, invoiced; Dara: 6 Oct, sent, valid to 5 Nov |
| Sales | 2 Sep: Sok Heng from the quotation, all on credit, by Piseth (past due since 2 Oct); 1 Oct: Dara, part cash, part credit, by Heng |
| Voided | 3 Oct: Heng's walk-in sale rung up twice, voided by Heng that day; 6 Oct: Piseth's sale to the wrong customer, voided by Piseth that day |
| Held | Two today: a walk-in for "Mr Vuthy", and Dara Home Repair |
| Customer payments | 20 Sep: Sok Heng ៛400,000 cash, part of its sale; 3 Oct: Dara pays the rest of its sale by KHQR |
| Returns | 22 Sep: one item back from Sok Heng's sale, credited; 5 Oct: one item back from Dara's (paid by then), refunded in cash |
| Warranty claims | 25 Sep: a drill from Sok Heng's sale, in warranty, sent for repair; 4 Oct: a grinder bought earlier, out of warranty, received |

Afterwards Receivables shows Sok Heng owing in the 31–60 column, past due;
Daily sales has Dara's sale in October and Sok Heng's in September.

## Plan

- [x] Dump the database to `../pos_backend/backups/` (added to the
      backend's `.gitignore`, never committed)
- [x] The command, with a test on the demo catalogue and stock history:
      two of each; each document's date, number and rate; the ledger in
      date order and `recompute_stock --check` clean; Sok Heng owes, Dara
      does not; a second run refused
- [x] Run all backend tests
- [x] Run it on the dev database; `recompute_stock --check`; look at each
      screen in the browser — two new rows on each
- [x] Update the backend `CLAUDE.md` and write the review below

## Review

- **Dump**: `../pos_backend/backups/pos-before-sales-demo-2026-10-07.dump`,
  taken before anything changed; `backups/` is git-ignored.
- **Command**: `sales/management/commands/seed_sales_demo.py` — every
  document through `sales/services.py`, each as of its own moment (the clock
  patched to that day). A daily number follows on from what its day holds
  (INV-20261006002 after the shop's own 001), and both daily counters are put
  back afterwards, so the next real sale today is still INV-20261007002. A
  back-dated sale takes the first product not moved since its day.
- **Tests**: 3 new in `sales/tests.py` (on the demo catalogue and stock
  history, the clock fixed at 7 Oct 2026): two of each with their numbers,
  dates, rates, balances; the ledger in date order and `recompute_stock
  --check` clean; the next real number untouched; a moved product passed
  over; a second run and a wrong role refused. 248 backend tests. Six
  deliberate breaks each failed a test; a seventh (a refund method on a
  fully credited return) changed nothing, as the server clears it.
- **Run on the dev database** (`--admin Piseth --seller Heng`): Sok Heng
  Construction (CUS-000001) owes $84.64 — $210.20 on 2 Sep, less ៛400,000
  (= $97.56) and a $28.00 jigsaw back; Dara Home Repair (CUS-000002) owes
  nothing after its KHQR payment and a $4.70 cash refund. Every screen showed
  its two new rows in the browser (customers, the 1 Sep rate, payment notes,
  quotations, sales, voids, held sales, payments, returns, claims), and
  Receivables, Daily sales and the Dashboard took them in. `recompute_stock
  --check` clean. The two temporary check users were deleted afterwards.
- `../pos_backend/CLAUDE.md`: `seed_sales_demo` described; 248 tests.

---

# 6d Dashboard

The first page after sign-in: today at a glance, from the figures the three
reports already work out. Any signed-in user; each part shows only to those
whose scopes allow it.

Owner's choices (2026-10-07):
- The mockup's "Cash in drawer" becomes **Cash taken today**: cash sales after
  change, plus cash customer payments, less cash refunds — one dollar figure.
  It is not a drawer count (there is no opening float, and a refund does not
  record $ or ៛). Admin only.
- **A Seller sees their own sales**, as Daily sales holds them: no profit, no
  cash, no money owed, no stock value.
- **Sales by category** is for today, as the mockup.
- Three extras beyond the mockup: **held sales waiting, quotations to follow
  up, open warranty claims**.

## Design

**Backend — `GET /api/reports/dashboard/`** (no parameters). Worked out on
every call, reusing the reports' code. A part the user may not see is `null`.
- `today` (`report.sales.all`, or `.own` for their own): sales, in riel at
  each sale's rate, transactions, average sale; profit and margin with
  `cost.view`.
- `cash_today` (`report.sales.all`): cash from today's sales after change,
  cash payments posted today, cash refunds posted today, and the total.
- `last_7_days` (sales scopes): seven days, oldest first; a day with no sales
  is 0.00; each with its share of the week's best day, for the bar's height.
- `by_category` (sales scopes): today's sales by main category (a
  sub-category counts in its group), the four biggest plus Other, each with
  its share of the day.
- `recent_sales` (sales scopes): the last 5 completed sales — id, number,
  time, customer or walk-in name, Cash / KHQR / Credit / Mixed, total.
- `stock` (`report.stock`): products, value at cost (`cost.view`), below
  reorder, out of stock; up to 5 running low (out of stock first, then by
  code) and how many more.
- `owed` (`report.receivables`): total and over 90 days; the 5 customers who
  owe most with the four age columns; totals over everyone; how many more.
- `held_sales` (`sell`): how many sales are held — shop-wide, as any till may
  resume one.
- `quotations` (`quotation.view`): sent and not yet answered; of those, how
  many expire within 7 days and how many have expired.
- `warranty` (`warranty.view`): open claims; of those, how many are out of
  warranty.

As in Daily sales, a voided sale leaves the day it was sold.

**Screen — Dashboard** (replaces the placeholder), the mockup's layout:
- The teal band: Sales today ($ and ៛), Transactions, Average sale, Gross
  profit and Margin (with `cost.view`).
- Tiles — an Admin: Cash taken today (sales · payments · refunds below),
  Customers owe (over 90 days in red), Stock value at cost, Below reorder
  level; then a row of three: Held sales, Quotations to follow up, Open
  warranty claims, each a link to its screen (held sales to the Till, whose
  Held sales button lists them). A Seller: one row of four — Below reorder
  and the three.
- Sales, last 7 days (bars, today marked) → Open daily sales; Sales by
  category, today.
- Recent sales (a row opens the sale read only, as from Sales) → See all
  (Sell → Sales); Running low → Open stock on hand.
- Money owed to the shop (top 5, totals of everyone, "and N more") → Open
  receivables. Admin only.
- Worked out fresh each time it opens. No auto-refresh, no comparison with
  yesterday, no Export.

## Plan

- [x] Backend: `dashboard(user)` in `reports/services.py` (today and the 7
      days from `daily_sales()`, stock from `stock_on_hand()`, money owed
      from `receivables()`, plus the new cash, by-category, recent-sales and
      to-do counts); its serializer, view and URL. Tests: an Admin gets every
      part; a Seller their own sales and no cash, owed, value or profit;
      cash taken (change, a riel payment, a cash refund; a voided payment
      and a KHQR refund left out); empty days filled; categories roll up,
      with Other; the tender label; the quotation and warranty counts;
      schema at 0 warnings
- [x] Regenerate the API client (`npm run api`) and build
- [x] Screen: `features/dashboard/dashboard.ts|html`; fixtures in
      `reports-testing.ts`; `dashboard.spec.ts` — Admin, Seller, a day with
      no sales, a load error with Try again, a recent sale opening
- [x] Run all tests (both projects), the build and Prettier
- [x] Live check: dump; today a cash sale with riel change, a KHQR sale and a
      credit sale, a cash payment, a cash refund, a held sale, a sent
      quotation about to expire, an open claim; compare the dashboard with
      the database as Admin and as Seller; restore
- [x] Update both `CLAUDE.md` files and write the review below

## Review

- **Backend**: `GET /api/reports/dashboard/` in `reports` — `dashboard(user)`
  reuses `daily_sales()` (today, and the 7 days), `stock_on_hand()` and
  `receivables()`, and adds cash taken today, today by main category, the
  last 5 sales with how each was paid, and the held, quotation and warranty
  counts; each part null without its scope. 245 backend tests (4 new);
  schema at 0 warnings. Ten deliberate breaks each failed a test (no Mixed,
  empty days dropped, sub-categories not rolled up, a Seller given cash, a
  voided payment or a KHQR refund counted as cash, low stock by code only,
  the 7th day not counted as expiring, closed claims counted, a voided sale
  in recent).
- **Frontend**: the Dashboard replaces the placeholder — band, the money
  tiles and the three to-do tiles (links), the 7-day bars and categories,
  recent sales (a row opens the sale read only), running low, money owed.
  A tile that links is an `<a class="tile">` (`_figures.scss`). 269 tests
  (5 new); ten breaks, each failed a test once "over 90 days" in red was
  added. The specs that land on `/` (shell, sell, change password) now
  answer the dashboard's request.
- **Live check**, dumped first and restored after (all 40 tables
  identical): a Seller's riel cash sale with change, an Admin's KHQR sale
  and credit sale, a $10 cash payment, a $6 cash refund, a held sale, a
  quotation sent with three days left, a claim after its warranty ended.
  The Admin's dashboard matched a count from the database — $153.00 from 4
  sales (៛612,000), average $38.25, profit $48.09, 31.4%; cash $85.00 ($81 +
  $10 − $6); $7.00 owed; 84 products, $23,225.90, 1 below reorder; the bars,
  categories and recent sales. The Seller saw only their $65.00 sale, no
  money tiles, one row of four. A recent sale opened read only; the Held
  sales tile went to the Till. No sideways scroll at 1366 or 900px; no
  console errors.
- `CLAUDE.md` (both): the dashboard's rules, decision and patterns; step 6
  done.

---

# 6c Receivables

What store customers owe and how old it is, as at today. Worked out from
invoices less payments and returns — no balance is stored on the customer.
Admin only (`report.receivables`).

Owner's choices (2026-10-07): a debt is aged by the days since its invoice
(0–30, 31–60, 61–90, over 90 — the mockup's figures add up that way, and
"past 60 days" is the last two columns); clicking a customer shows their
open invoices, with Record a payment; only customers who owe are listed; no
statements for now.

## Design

**Backend — `GET /api/reports/receivables/`** (`show`: overdue, over_limit,
on_hold):
- One row per store customer who owes: code, name, the four age columns
  (each open invoice's balance, by the days since it was sold), owed,
  credit limit, room left (limit less owed — below zero when over),
  whether any invoice is past its due date, over the limit, on credit hold.
- Summary over everyone who owes, whatever the filter: owed, in riel at
  today's rate; owed past 60 days and its share; collected this month (posted
  payments dated this month); how many are over their limit or on hold, and
  who.
- The rows' totals for the table's last line.
- A customer's open invoices come from the account endpoint already there
  (`/api/sales/customers/{id}/account/`).

**Screen — Reports → Receivables**
- Filter: All who owe, Overdue only, Over limit, On hold.
- Tiles: Total owed (riel under it) · Past 60 days (share of the total) ·
  Collected this month · Over limit or on hold (how many; their names).
- Table: Customer (On hold / Over limit pills) · 0–30 days · 31–60 · 61–90
  · Over 90 · Owed · Limit · Room left (red below zero) · Open; the totals.
- Open → below the table, "<customer> — open invoices": Invoice · Date ·
  Due · Invoiced · Paid · Balance · Status (Open, Part paid, Overdue,
  Overdue 90+); the balance owed; **Record a payment** opens the payment
  dialog with that customer already chosen, and the report reloads after.
- No Send statements, no Export.

## Plan

- [x] Backend: the receivables report in `reports` — rows with the aging,
      limit, room, flags; the filter; the summary (riel at today's rate,
      past 60 days, collected this month, over limit or on hold); schema at
      0 warnings
- [x] Backend tests: aging by the invoice's age, payments and returns taken
      off, voided payments ignored, the walk-in and settled customers left
      out, over limit / on hold / overdue, collected this month, Admin only
- [x] Regenerate the client
- [x] `features/reports/receivables`: filter, tiles, the aging table, the
      customer's open invoices; Record a payment with the customer chosen
      (the payment dialog takes an optional customer); menu ready
- [x] Tests: the report, the filter, a customer's invoices, Record a
      payment pre-filled and the reload; a Seller cannot open it
- [x] Run all tests (both projects) and the build
- [x] Live check: dump; credit sales to two customers, one dated back past
      90 days, a payment and a return against them, one put on hold;
      compare the screen with the database; Record a payment from the
      report; restore
- [x] Update both `CLAUDE.md` files and write the review below

## Review

- **Backend**: `GET /api/reports/receivables/` in `reports` — one row per
  customer who owes, aged by the days since each invoice, with limit, room
  and flags; the filter; the summary (riel at today's rate, past 60 days,
  collected this month, who is flagged); the rows' totals. 241 backend
  tests (4 new); schema at 0 warnings. Aging by the due date, counting
  voided payments as collected, a summary that followed the filter, and
  letting a Seller in each failed a test.
- **Frontend**: Reports → Receivables — the filter, four tiles, the aging
  table with On hold / Over limit pills and red room left below zero; Open
  shows the customer's open invoices (a Returned column beside Paid, so a
  return is not mistaken for a payment) and Record a payment opens the
  payment dialog with that customer chosen (it now takes an optional
  customer); the report reloads after. 264 tests (3 new); the customer not
  passed on, no reload after a payment, and overdue shown as open each
  failed a test.
- **Live check**, dumped first and restored after (all 40 tables
  identical; Chipmong's limit and hold back as they were): Chipmong with a
  sale 100 days old ($20 paid) and today's (a return), lowered below its
  balance; a new customer with a sale 45 days old, put on hold. The tiles
  ($180.60, ៛722,400; $29.00 past 60 days, 16.1%; $20.00 collected; both
  flagged), rows and totals matched a count from the database; the filters
  kept the right customer; Chipmong's invoices read Overdue 90+ and Part
  paid. Record a payment opened with Chipmong chosen; $5 went to the oldest
  invoice and the report reloaded ($175.60, back under the limit). A Seller
  has no Receivables and is turned away. No console errors.
- `CLAUDE.md` (both): the receivables rules and decision; 6c done, 6d
  Dashboard next.

---

# 6b Stock on hand

What is on the shelf and what it is worth at average cost, as at today.
Both roles may open it (`report.stock`); cost and value only with
`cost.view` (an Admin), as everywhere else.

Owner's choices (2026-10-07): as at today only; every matching product on
one page; "no movement" fixed at 90 days; a search box for code or name.

## Design

**Backend — `GET /api/reports/stock-on-hand/`** (`status`, `category`,
`brand`, `search`):
- The products: those that track stock and are active, plus any retired one
  still holding stock (as a count lists them); by code.
- Each row: code, name, brand, unit, shelf, on hand, reorder at, average
  cost and value (null without `cost.view`), the day it last moved, and a
  status — Out of stock (nothing on hand), Reorder (at or below the reorder
  level), No movement (holding stock, nothing in or out for 90 days), or OK
  — the first that applies.
- Filters: status (all, below reorder level — out of stock included, out of
  stock, no movement), category (its sub-categories too), brand, search on
  code, name or barcode.
- Summary, over all stock whatever the filters: products, value at cost,
  below reorder level and how many are out, no movement and the value tied
  up in it, the last posted count (number, date, category, lines that
  differed, its value); and the total value of the rows listed.

**Screen — Reports → Stock on hand**
- Filters: status (All products, Below reorder level, Out of stock, No
  movement 90 days), category, brand, search.
- Tiles: Stock value at cost (products; Admin) · Below reorder level (n out
  of stock) · No movement 90 days (value tied up, for an Admin) · Last
  counted (date · category · variance).
- Table: Code · Product · Brand · Shelf · On hand (unit) · Reorder at · Avg
  cost · Value · Status; the footer gives how many and their value. A
  Seller sees no cost or value.
- No Print count sheet (agreed for the stock screens).

## Plan

- [x] Backend: the stock on hand report in `reports` — rows with status and
      last movement, the filters, the summary and last count, cost and value
      only with `cost.view`; schema at 0 warnings
- [x] Backend tests: the status rules (out, reorder, no movement, OK),
      retired with stock kept and non-stock left out, the filters (category
      with its children, brand, search, status), the summary over all stock,
      the last count, a Seller without cost
- [x] Regenerate the client
- [x] `features/reports/stock-on-hand`: filters, tiles, the table; menu
      ready
- [x] Tests: an Admin's report, a Seller's (no cost), each filter sent
- [x] Run all tests (both projects) and the build
- [x] Live check: dump; on the sample stock history, a product moved back
      past 90 days, a sale that takes one below its reorder level, one sold
      out; compare the screen with the database; restore
- [x] Update both `CLAUDE.md` files and write the review below

## Review

- **Backend**: `GET /api/reports/stock-on-hand/` in `reports` — rows with
  their status and last movement, the filters, the summary over all stock
  and the last count, cost and value null without `cost.view`. 237 backend
  tests (5 new); schema at 0 warnings. Putting reorder before out of stock,
  a summary that followed the filters, leaving out sub-categories, listing
  retired empty products, and cost for a Seller each failed a test.
- **Frontend**: Reports → Stock on hand — status, category, brand and
  search; four tiles (three for a Seller); every matching product on one
  page with a Last moved column (added — the date the backend already
  sends) and the total value. 261 tests (3 new); showing no movement as
  OK, cost for a Seller, and the brand not sent each failed a test. The
  shell's greyed-menu check moved to the Admin's menu: a Seller has nothing
  greyed out any more.
- **Live check**, dumped first and restored after (all 40 tables
  identical): on the sample stock history, the washer's movements moved
  back 100 days, two drills sold to their reorder level, the cut-off saw
  sold out. The tiles ($22,835.80 over 84 products; 3 below reorder, 1 out;
  1 idle with $564.08 tied up; CNT-000002 on 30 Sep, −$23.49), every
  filter and the Power tools total ($10,998.28 over 26) matched a count
  straight from the database; the Seller saw no cost. No console errors.
- **Fixed after the live check**: product names wrapped onto two or three
  lines in a ten-column table — a report's table now sits in `.report-wrap`
  (tighter cells, scrolls inside its panel), so each product keeps one line
  and the page never scrolls sideways.
- `CLAUDE.md` (both): the stock on hand rules and decision; 6b done, 6c
  Receivables next.

---

# 6a Daily sales — the first report

Step 6 (owner's choices, 2026-10-07): one report at a time, each its
backend endpoint and then its screen — Daily sales → Stock on hand →
Receivables → Dashboard last. No Export for now. Daily sales has no tender
filter: the By tender table and the Cash / KHQR / Credit columns already
split every sale by how it was paid.

The rules are the backend's (`scopes.py`): an Admin sees every seller's
sales with cost and profit (`report.sales.all`, `cost.view`); a Seller sees
only their own, without cost or profit (`report.sales.own`).

## Design

**Backend — a new `reports` app, `GET /api/reports/daily-sales/`**
(`date_from`, `date_to`, `seller`):
- Completed sales only, by the day they were sold — voided and held ones
  are left out. A Seller's report is always their own; `seller` is for an
  Admin.
- Summary: sales (and in riel, each sale at its own stamped rate),
  invoices, average sale, discount given, cost and profit and margin
  (null without `cost.view`), returns posted in the period (value, count).
- By day: date · invoices · cash · KHQR · credit · sales · cost · profit.
  Cash is what the sale came to less KHQR and credit — what stayed in the
  drawer after change, rounding included — so the three always add up to
  the sales.
- By seller: invoices · sales · average · discount given.
- By tender: cash, KHQR, credit — each with its share of the sales.
- Cost is the cost stamped on each sale line when it was sold, so the
  report never changes when stock is bought at a new price.

**Screen — Reports → Daily sales**
- Filters: period — This month (default), Today, Last 7 days, Dates…
  (From–To); seller (an Admin only: All sellers, then each).
- Tiles: Sales (riel under it) · Gross profit (margin; Admin) · Invoices
  (average) · Returns (−value, how many).
- By day, with the period's totals; By seller (Admin); By tender.
- The mockup's note: "Cost is the figure stamped on each sale line…"

## Plan

- [x] Backend: the `reports` app — the daily sales report (summary, by
      day, by seller, by tender, returns), a Seller held to their own,
      cost and profit only with `cost.view`; the schema stays at 0 warnings
- [x] Backend tests: totals that add up, voids and held sales left out,
      cash net of change, riel at each sale's rate, a Seller's own only and
      no cost, returns in the period
- [x] Regenerate the client
- [x] `features/reports/daily-sales`: filters, tiles, the three tables;
      the menu entry ready
- [x] Tests: an Admin's report, a Seller's (own, no cost), the period and
      seller filters
- [x] Run all tests (both projects) and the build
- [x] Live check: dump; sales across a few days (cash with change, riel,
      KHQR, credit; by Admin and Seller), a void, a return; compare the
      screen with the database; restore
- [x] Update both `CLAUDE.md` files and write the review below

## Review

- **Backend**: a new `reports` app — `GET /api/reports/daily-sales/` with
  the summary, by day, by seller and by tender, the returns of the period,
  a Seller held to their own and cost/profit null without `cost.view`.
  `HasScope` now takes a tuple (any one scope). 232 backend tests (5 new);
  the schema stays at 0 warnings. Counting the whole sale as cash, counting
  voids, letting a Seller see everyone, cost for a Seller, and the days
  oldest first each failed a test.
- **Frontend**: Reports → Daily sales — period (This month, Today, Last 7
  days, Dates…), seller for an Admin, four tiles (three for a Seller), By
  day with the period's total, By seller (Admin), By tender. 258 tests
  (3 new); eight days for "last 7", cost shown to a Seller, and the seller
  choice not sent each failed a test.
- **Live check**, dumped first and restored after (all 40 tables
  identical; the owner's two sales kept): five sales over three days (cash
  with change and a discount, riel with change, KHQR plus credit to
  Chipmong, KHQR), one voided, one return. Every by-day row and the totals
  matched a separate count straight from the database to the cent ($272.50
  sales, $201.25 cost, $71.25 profit; cash $188.50, KHQR $35.40, credit
  $48.60); Today and the seller filter matched; the Seller saw only their
  own three sales, without cost. No console errors.
- **Fixed after the live check**: the By day panel touched the two below
  it — 20px between them, as the tiles have.
- `CLAUDE.md` (both): the reports decisions, the daily sales rules; 6a
  done, 6b Stock on hand next.

---

# 5d-2 Print quotations and payment receipts

The rest of step 5d (2026-10-07): a quotation to hand a contractor, and a
receipt for money a customer pays against their invoices. Both reuse the
invoice's printing (`shared/print/`): the shop's header, the receipt
language, the printer.

Owner's choices (2026-10-07): a quotation prints on A4 always, in dollars
only (it holds no rate), with the customer's phone and address; a payment
receipt shows what the customer still owes, as of the day it is printed.

## Design

**Quotation** (A4 page, in the receipt language)
- The shop: logo, names, address, phone, VAT TIN.
- QUOTATION, its number, date, valid until, prepared by; a draft is marked
  DRAFT.
- "Quotation for": the customer's name, phone and address.
- Lines as a table: item (name and code) · qty · price · discount ·
  amount; the total.
- The quotation's terms, under the total. No riel, no payment notes, no
  receipt footer (that is the till's line).
- **Print** in the quotation dialog: any quotation but a rejected one,
  printed as last saved — while there are unsaved changes, Print waits for
  Save.

**Payment receipt** (the receipt paper: a roll on 80 mm or 58 mm, a page on
A5)
- The shop's header, as on the invoice.
- PAYMENT RECEIPT, its number, date, received by; the customer.
- How it was paid (Cash, KHQR, Bank transfer) and its reference; the
  amount — riel as riel, with "= $10.00 at ៛4,000".
- Paid off: each invoice and the amount applied to it; the total.
- "Still owed on 7 Oct 2026: $41.80", read from the customer's account when
  printed.
- The receipt footer line.
- **Save and print receipt** beside Save payment (as the mockup), and
  **Print** on a saved payment, marked COPY; none for a void payment.

**Backend**: the quotation also sends `customer_phone` and
`customer_address` (address, district and province on one line).

## Plan

- [x] Backend: `customer_phone` and `customer_address` on the quotation,
      with a test; regenerate the client
- [x] `shared/print/`: the printer prints any of the three; the quotation
      (A4) and the payment receipt (roll or A5); the new labels in both
      languages
- [x] Quotation dialog: Print (not rejected, not while unsaved)
- [x] Record a payment: Save and print receipt; the payment view: Print
      (COPY), none for a void one
- [x] Tests: the quotation on A4 (DRAFT mark, the customer, terms); the
      receipt on a roll in riel with what is still owed, and COPY; the
      buttons and when they are offered
- [x] Run all tests (both projects) and the build
- [x] Live check: dump; a quotation for Chipmong, a credit sale and a riel
      payment against it; print each to PDF (quotation in English and both
      languages, receipt on 80 mm and A5) and look at them; restore
- [x] Update `CLAUDE.md`, write the review below, list the new Khmer labels

## Review

- **Built**: Print in the quotation dialog — A4, dollars only, DRAFT on a
  draft, the customer's phone and address, the terms; only as saved, never
  a rejected one. Save and print receipt on Record a payment, and Print
  (COPY) on a saved payment, none for a void one — the receipt on the
  receipt paper, with what it paid off and what is still owed on the day
  printed. `Printer` now prints any of three components; the shop's header
  (`<app-print-shop>`) and the discount wording (`print-common.ts`) are
  shared with the invoice, which was moved onto them unchanged (its four
  tests still pass).
- **Backend**: the quotation sends `customer_phone` and `customer_address`;
  a test. 227 backend tests.
- **Tests**: 255 frontend (4 new: the quotation on A4 in both languages,
  a riel receipt with what is still owed, the quotation's Print rules, and
  Save and print / reprint / void for payments). A quotation on the receipt
  paper, printing with unsaved changes, an unmarked reprint, Print on a
  void payment, and the till's header line on a quotation each failed a
  test.
- **Live check**, dumped first and restored after (all 40 tables
  identical): a draft quotation for Chipmong (three lines, one at 5% off,
  three lines of terms) printed on A4 in English and in both languages; a
  riel payment (៛40,000 = $10.00) reprinted on 80 mm and A5 with "Still
  owed on 7 Oct 2026: $39.00"; a $5 payment through Save and print receipt
  printed as PAY-000002 with $34.00 still owed, and the dialog closed. All
  printed to PDF and looked at; no console errors.
- **New Khmer labels for the owner to check** (`print-labels.ts`): Draft
  សេចក្តីព្រាង · Valid until មានសុពលភាពដល់ · Prepared by រៀបចំដោយ ·
  Quotation for ជូនចំពោះ · Terms លក្ខខណ្ឌ · Payment receipt
  បង្កាន់ដៃទទួលប្រាក់ · Received by អ្នកទទួល · Bank transfer
  ផ្ទេរតាមធនាគារ · Paid off បានទូទាត់ · Still owed on នៅជំពាក់គិតត្រឹម.
- `CLAUDE.md` (both): the printing decisions and pattern; step 5d done, 6
  Reports next.

---

# 5d-1 Print the invoice of a sale

The owner asked (2026-10-07): Sell → a completed sale → print its invoice,
on the paper set in Company → Profile → Receipt (80 mm, 58 mm or A5). The
first piece of step 5d; quotations and payment receipts come after.

Owner's choices (2026-10-07): honour the receipt language (English, Khmer
or both — I draft the Khmer labels for the owner to check); Print at the
till right after a sale and on any sale opened from Sales, a reprint
marked COPY, no print for a void sale; the how-to-pay notes on a sale with
something on credit; each line prints its warranty, and a narrow roll uses
the product's short name.

## Design

**How it prints**: the browser's own print, from a print-only copy of the
invoice laid out for the paper — nothing else on the page prints.
- 80 mm and 58 mm: a roll — content 72 mm or 48 mm wide (what those
  printers print on), no page margins, as long as it needs. The receipt
  printer is chosen in the print dialog once; the browser remembers it.
- A5: a page — the shop and the invoice side by side at the top, the lines
  as a table.
- Images (logo, payment QR codes) are loaded before the dialog opens.

**What prints** (labels in English, Khmer or both, per the setting):
- The shop: logo (if set), name — the Khmer name too when Khmer is on —
  address, phone, VAT TIN (if set), the receipt header line.
- INVOICE, its number, date and time; the seller if "Show the seller's
  name" is on; the customer (walk-in name and phone, or the store
  customer); the quotation it came from. A reprint says COPY.
- Each line: product (short name on a roll, if it has one), quantity ×
  net price, the discount if any, line total; "Warranty 12 months" under
  it when the product has one.
- Discount given, TOTAL; the riel total if "Show the riel total" is on,
  with "at ៛4,000" if "Show the exchange rate used" is on; each payment
  (Cash, KHQR with its reference, riel as riel); change in dollars and
  riel; on credit and its due date.
- On a credit sale: the shown payment notes, in their order, with their
  QR images.
- The receipt footer line.

**Where**: **Print invoice** on Sale completed at the till; **Print** on
a sale opened from Sell → Sales (COPY). Neither for a void sale.

**Backend**: the invoice line also sends the product's `short_name` and
`warranty_months` (read from the product when printed — not stamped on
the sale, so a reprint shows the product's warranty as it is now).

## Plan

- [x] Backend: `product_short_name` and `warranty_months` on the invoice
      line, with a test; regenerate the client
- [x] `shared/print/`: the labels (English and Khmer, one file), the
      printable invoice for a roll and for A5, and the printer — mounts it
      out of sight, sets the page for the paper, waits for images, prints,
      cleans up
- [x] Print invoice on Sale completed; Print (COPY) on the Sales view, not
      for a void sale
- [x] Tests: what prints on each paper and in each language; the riel,
      rate and seller switches; credit notes only on credit; COPY on a
      reprint; nothing for a void sale
- [x] Run all tests (both projects) and the build
- [x] Live check: dump; a cash sale, a riel sale with change and a credit
      sale; print each to PDF from headless Chrome on 80 mm, 58 mm and A5,
      English and Both, and look at them; restore
- [x] Update `CLAUDE.md`, write the review below, and list the Khmer
      labels for the owner to check

## Review

- **Built**: Print invoice on the till's Sale completed, and Print (marked
  COPY) on a sale opened from Sell → Sales; none for a void sale. The
  invoice follows Company → Profile → Receipt — paper (a roll at 80 mm or
  58 mm, a page at A5), language (English, Khmer, both), the riel total,
  rate and seller switches, the header and footer lines, the logo — and a
  credit sale prints the shown payment notes with their QR. `Printer`
  (`shared/print/`) loads the shop and notes, prints from `#print-root`
  and tidies up; `_print.scss` keeps everything else off the paper.
- **Backend**: invoice lines send the product's `short_name` and
  `warranty_months` (read from the product, so a reprint shows today's
  warranty); a test. 226 backend tests.
- **Tests**: 251 frontend (5 new: four for the printer on each paper and
  language, one for a reprint and a void sale; the till's cash sale now
  prints too). Not marking a reprint, fetching notes for every sale, Both
  printing English only, offering Print on a void sale, and the riel total
  ignoring its switch each failed a test.
- **Live check**, dumped first and restored after (all 40 tables
  identical; the owner's two sales of 6 and 7 Oct kept, settings back to
  80 mm English): a sale at the till printed from Sale completed; a credit
  sale (drill with a 12-month warranty, KHQR plus credit) reprinted on
  80 mm and A5 in both languages, with the seller and the ABA QR; a riel
  sale with a discount and riel change on 58 mm in Khmer. Printed to PDF
  from headless Chrome at each size and looked at.
- **Fixed after the live check**: the app's table styles leaked onto the
  paper (bigger type and rules in the details and totals); amounts and the
  due date wrapped; A5 split How to pay from its note across two pages —
  all fixed in `_print.scss`, and the PDFs printed again clean.
- **Khmer labels for the owner to check** (`shared/print/print-labels.ts`):
  Invoice វិក្កយបត្រ · Copy ច្បាប់ចម្លង · No. លេខ · Date កាលបរិច្ឆេទ ·
  Seller អ្នកលក់ · Customer អតិថិជន · Phone ទូរស័ព្ទ · Quotation សម្រង់តម្លៃ ·
  VAT TIN លេខអត្តសញ្ញាណកម្ម · Item ទំនិញ · Qty ចំនួន · Price តម្លៃ ·
  Discount បញ្ចុះតម្លៃ · Amount ទឹកប្រាក់ · Discount given បញ្ចុះតម្លៃសរុប ·
  Total សរុប · In riel ជាប្រាក់រៀល · at អត្រា · Cash សាច់ប្រាក់ · Credit ឥណទាន ·
  Paid បានបង់ · Change ប្រាក់អាប់ · On credit នៅជំពាក់ · Due ថ្ងៃត្រូវបង់ ·
  How to pay វិធីបង់ប្រាក់ · Warranty 12 months ធានា 12 ខែ.

---

# Sales — every sale, by date, status and number

The owner wants a list of all sales under Sell, filtered by date, status
and invoice number (2026-10-07). The invoice API has what it needs
(`/api/sales/invoices/`: status, sale date from/to, seller, search on the
number or walk-in name, newest first, paged); both roles may read it.

Owner's choices (2026-10-07): Sell becomes a group — Till and Sales; both
roles see every sale, with a "Sold by" filter; a period plus a From–To
range; a sale opens read only, with Void for whoever may void it.

## Design

**Menu**: Operations → **Sell** opens like Stock: **Till** (today's Sell
page, unchanged) and **Sales** (new, `/sales`).

**Sales list**
- Filters: period — **Today** by default, This month, Last 30 days, This
  year, All dates, **Dates…** (shows From and To); status — All, Completed,
  Void; Sold by — Everyone, Me, and for an Admin each member of staff (a
  Seller cannot read the staff list); search — invoice number or walk-in
  name.
- Held sales are left out: they have no number or date yet and live in the
  till's Held sales. The API gains one flag for that (below).
- Tiles, counts: Sales today · Voided today.
- Table: Number · Date and time · Customer (walk-in name, or the quotation
  it came from, under it) · Sold by · Paid by (Cash / KHQR / Credit pills) ·
  Total (riel under it) · Status · Open. Paged by the server, newest first.

**A sale, read only** (wide dialog):
- Number, date and time, sold by, customer (walk-in name and phone),
  price tier, quotation.
- Lines: product · qty · price · discount · net · total.
- Total, in riel at the sale's rate, discount given; payments (kind,
  currency, amount, reference); paid now; on credit and its due date;
  change given (dollars and riel); rounding.
- Returns posted against it (number, date, value), from the returns list.
- Cost and profit for an Admin only (`cost.view`; null for a Seller).
- If void: who voided it, when and why.
- **Void…** with a reason, shown only to whoever may: an Admin any
  completed sale; a Seller their own, on the day it was raised. The server
  still decides — a payment or return against it is refused in its words.
  No Print yet (5d).

**Backend**: `?held=false` on the invoice list leaves held sales out
(listed in the schema; a test).

## Plan

- [x] Backend: the `held` flag on the invoice list, with a test; schema
      still clean; regenerate the client
- [x] Menu: Sell becomes a group — Till and Sales; route `/sales`
- [x] `features/sales/`: the list — period and From–To, status, Sold by,
      search, two count tiles, the table
- [x] The sale view, with returns against it, cost and profit for an
      Admin, and Void… for whoever may
- [x] Tests: the filters (today by default, a date range, status, Sold by
      Me, search); the view; Void offered to a Seller only on their own
      sale today, and to an Admin; a refused void; the shell menu
- [x] Run all tests (both projects) and the build
- [x] Live check: dump and fingerprint; sell a few (cash, riel, credit, a
      quotation) as Admin and Seller; filter by day, status, seller,
      number; open one with a return; void one; restore; fingerprint
      identical
- [x] Update `CLAUDE.md` and write the review below

## Review

- **Built**: Operations → Sell is a group — Till and Sales. Sales lists
  every completed or voided sale, today first, with a period or a From–To
  range, status, Sold by (Everyone, Me, and each member of staff for an
  Admin) and a search on the number or walk-in name; two count tiles. A sale
  opens read only — lines, riel, paid now, credit and its due date, change,
  payments with references, returns against it, cost and profit for an
  Admin — with Void… for whoever may void it.
- **Backend**: `held=false` on the invoice list leaves held sales out; a
  test. The till's page is now titled Till.
- **Tests**: 246 frontend (3 new; the shell's fold test now finds
  Catalogue's own button, since Sell is the first group), 225 backend (1
  new); build clean. Listing held sales, letting a Seller void their own
  sale from another day, a "today" with no end date, and cost shown to a
  Seller each failed a test.
- **Live check**, dumped first and restored after (all 40 tables
  identical; the owner's INV-20261006001 of 6 Oct kept): five sales made
  through the API — cash with change, riel, credit to Chipmong with a
  return, KHQR from a quotation, and a Seller's. The list, every filter,
  the range on 6 Oct, the views, the Admin's refused void (a return
  against it) and successful void, and the Seller's void of their own sale
  all behaved; the Seller saw no Void on another's sale and no cost. No
  console errors.
- **Found on the way**: the dev server on port 4200 (started 09:41) had
  not rebuilt since this morning, so the check ran on a second one on port
  4300, stopped after. The session scratchpad had been cleared overnight —
  yesterday's `pos-before-stock-demo.dump` is gone.

---

# Sample stock history, as a working shop would have it

Before printing (5d, on hold): fill the stock screens with records like
real practice — stock in, adjustments, stock counts — so the screens, the
stock card and average cost can be seen with a history behind them.

Owner's choices (2026-10-06): clear the stock records already there first
(they were tests); a backend command, beside `seed_demo`; history since
1 Aug 2026; stock documents only, no sales.

## Design

**`manage.py seed_stock_demo --user Piseth [--reset]`** in the backend,
development only, like `seed_demo`. It posts every document through the
same services the screens use (`post_stock_in`, `post_adjustment`,
`start_count` / `record_counts` / `post_count`, `reverse_document`), in date
order, so stock, average cost and the ledger come out exactly as real use
would make them. Fixed random seed: the same history every time.

- `--reset` clears the stock area first: every stock document and movement,
  each product's stock and average cost back to zero, GRN/ADJ/CNT numbers
  back to 1. Products, suppliers and users are not touched. Refused when any
  sale or return exists — their costs come from the ledger.
- Without `--reset` it refuses if any stock document exists, so it never
  mixes with a real history, and never runs twice.
- Each document's stamps (created, posted, the movements' posted time, a
  count line's counted time) are set to its own date during shop hours, as
  if entered that day. Numbers follow date order.

**Suppliers**, added beside "Total Cambodia" (kept): Makita and Bosch
distributors, a hardware wholesaler for Stanley, DeWalt, fixings and
unbranded goods, and a safety-wear importer. Each stock product gets its
usual supplier (Partners → Supplier products) with a realistic pack:
cartons or boxes for fixings, accessories and safety wear (10, 12, 24, 50),
one at a time for power tools.

**The history**
- **1 Aug 2026, go-live** — opening balance for every stock product, one
  adjustment per category, at a cost about three-quarters of the wholesale
  price.
- **Stock in** — about two a week to 6 Oct (~18), each from one supplier
  with 2–8 lines, their invoice number as reference, bought in packs; costs
  drift a little over the weeks, so average cost moves.
- **One mistake put right** — a stock-in posted with a carton's cost typed
  as a piece's, reversed the next day ("Cost typed per piece, not per
  carton") and entered again.
- **One draft waiting** — goods arrived on 6 Oct, the supplier's invoice not
  yet in.
- **Adjustments** (~10) — damage (2), loss (1), shop use (2), warranty
  replacement (1), return to supplier (2) with a supplier replacement (1)
  after it, each with a note; and one damage draft not yet posted.
- **Counts** — Fixings on 31 Aug and Hand tools on 30 Sep, both posted, most
  lines matching and a few short or over by one or two; Power tools started
  on 6 Oct and half counted, still open.
- Entered by the `--user` (an Admin, Piseth); counted by the same.

## Plan

- [x] Dump the database first (safety)
- [x] Backend: `inventory/management/commands/seed_stock_demo.py` and its
      data — suppliers, links and packs, the dated history, `--reset`, the
      guards, the stamps
- [x] Backend tests: loads after `seed` and `seed_demo`; the expected
      number of each document and status; `recompute_stock --check` finds
      no drift; nothing below zero; refuses a second run; `--reset` refuses
      when a sale exists
- [x] Run all backend tests
- [x] Run it on the dev database (`--reset --user Piseth`), then
      `recompute_stock --check`
- [x] Look at it in the browser: the three stock lists, a stock-in, the
      reversal, a posted count, the open count, Supplier products,
      Products' on hand
- [x] Update the backend `CLAUDE.md` and write the review below

## Review

- **Built**: `manage.py seed_stock_demo` in the backend
  (`inventory/management/commands/`), as planned. 224 backend tests (3
  new): the history agrees with the ledger (`recompute_stock --check`),
  nothing goes below zero, each document is stamped on its own date and
  the ledger runs in date order; it refuses a second run, and `--reset`
  loads the same history again but refuses once a sale exists. Leaving
  the stamps alone, clearing under a sale, and posting out of date order
  each failed a test (the last only after a ledger-order check was added —
  numbering per document type alone could not catch it).
- **Loaded on the dev database** (dumped first:
  `pos-before-stock-demo.dump` in the session scratchpad), with
  `--reset --user Piseth`. The owner's test records went, as agreed:
  GRN-000001–4, ADJ-000001–4, CNT-000001.
  - 4 suppliers added beside Total Cambodia; 84 supplier links with packs.
  - Stock in: GRN-000001–022 — 20 posted from 3 Aug to 5 Oct; GRN-000006
    had a carton's cost typed per piece, reversed by GRN-000007 on 21 Aug
    and entered again as GRN-000008; GRN-000022 (Makita, today) is a draft.
  - Adjustments: ADJ-000001–007 opening balances on 1 Aug ($13,208.99);
    ADJ-000008–016 damage, shop use, loss, warranty replacement, a Makita
    return and its replacement, a return to Lim Heng; ADJ-000017 a damage
    draft.
  - Counts: CNT-000001 Fixings 31 Aug (one line off, +$0.19); CNT-000002
    Hand tools 30 Sep (7 off, −$23.49); CNT-000003 Power tools, 13 of 26
    counted, open.
  - 84 products in stock, $23,436.82 at average cost; every product agrees
    with the ledger.
- **Seen in the browser**: the three stock lists, GRN-000008, the reversal
  GRN-000007, the posted and the open count, Supplier products, Products'
  stock and cost — no console errors. The temporary check Admin and its
  sign-in tokens were removed afterwards.
- No frontend code changed. Backend `CLAUDE.md`: the command under
  "Running it".

---

# 5c-5 Warranty claims

A log of what a customer has claimed under warranty and where it has got
to — not a transaction: no invoice link, no money, no stock effect. The
backend has no claim model yet, so it comes first. Both roles log and edit
claims (`warranty.view`, `warranty.edit`).

Owner's choices (2026-10-06): the product is picked from the catalogue or
typed, and kept as text; an Admin may delete a claim; the unused `WRC-`
counter is dropped — a claim is known by the warranty card's number; the
customer's name and phone are both optional.

## Design

**Backend — a new `warranty` app**
- `WarrantyClaim`: warranty number (required, not unique — one card can be
  claimed twice), product code, product name (required), warranty months (0
  when the item has none), expiry date (optional), customer name, customer
  phone, note, status. Who logged it and when, and who changed it last, from
  the usual stamps.
- Status: Received → Sent for repair → Ready for collection → Closed, or
  Rejected. Any status can be chosen at any time — it is a log. Received,
  Sent for repair and Ready for collection are "open".
- "Out of warranty", worked out: an expiry date before the day the claim was
  logged.
- `/api/warranty/claims/`: list (filters: status, open, out of warranty;
  search on warranty number, product code and name, customer name and
  phone; newest first, paged), create, read, edit, delete.
- Delete needs a new `warranty.delete` scope, Admin only (owner's choice);
  the scope check learns a delete scope for that.
- The product lookup sends `warranty_months`, so picking a product fills
  the duration in.
- `WRC-` dropped: the warranty document type and its counter go (a
  migration removes the seeded row).

**List** (Operations → Warranty claims):
- Filters: status (Open claims by default, All claims, then each status),
  and a search box. **New claim**. No Export.
- Tiles, counts of open claims: Open claims · Sent for repair · Ready for
  collection (customers waiting) · Out of warranty (claimed after the end
  date).
- Table: Warranty no · Product (code under the name) · Duration · Expires
  (red when the claim came after it) · Customer (phone under the name) ·
  Note · Status · Edit. Paged by the server.

**Claim dialog** (new or edit):
- Warranty number — "From the warranty card or the supplier's sticker."
- The product picker (scan or type a code, or choose by brand and
  category) fills Product code, Product name and Warranty duration; all can
  then be typed over. Expiry date.
- Customer name · Phone — "To call them when it is ready." Both optional.
- Status · Note.
- On an existing claim: "Logged 6 Oct 2026 by Sokha Chan · last changed …".
- **Save claim** · Cancel · **Delete** (Admin, an existing claim, asks
  first).

**Where it departs from the mockup**:
- Customer name and phone added (owner's choice, agreed earlier).
- The product can be picked from the catalogue.
- Delete for an Admin only.
- "Expired" means claimed after the end date — the mockup said both that
  and "once it has passed".
- No Export.

## Plan

- [x] Backend: the `warranty` app — model, migration, serializer (with the
      out-of-warranty flag and the stamps), list filters and search, the
      endpoints; `warranty.delete` for an Admin, and the delete scope check
- [x] Backend: `warranty_months` in the product lookup; `WRC-` and the
      warranty document type dropped, with a migration
- [x] Backend tests: create and edit as either role, required fields, the
      filters and search, out of warranty, delete for an Admin only, the
      lookup's months, no warranty counter seeded; the schema stays at 0
      warnings
- [x] Regenerate the API client; build
- [x] `features/warranty/`: the list — filters, search, four count tiles,
      the table
- [x] The claim dialog: the product picker filling the fields, Save,
      Delete for an Admin
- [x] Menu and route: Warranty claims `ready: true`
- [x] Tests: the list, filters and search; a new claim from a picked
      product; editing a claim's status; delete for an Admin only
- [x] Run all tests (both projects) and the build
- [x] Live check: dump and fingerprint; as Admin and Seller — log a claim
      from a picked product and one typed, move one along to Ready, search,
      an Admin deletes one, a Seller sees no Delete; restore; fingerprint
      identical
- [x] Update both `CLAUDE.md` files and write the review below

## Review

- **Backend**: a new `warranty` app — the claim (the seven agreed fields
  plus customer name and phone), `/api/warranty/claims/` with status, open
  and out-of-warranty filters and a search, and delete for an Admin only
  through a new `warranty.delete` scope (`HasReadWriteScope` now takes a
  `delete_scope`). The product lookup sends `warranty_months`. The unused
  `WRC-` counter and the warranty document type are gone; a migration
  removes the seeded row. 221 backend tests (8 new); the schema stays at 0
  warnings. Allowing delete with the edit scope, and counting "out of
  warranty" against today instead of the day logged, each failed a test.
  Two validators that only repeated DRF's own blank check were removed
  when breaking them failed nothing.
- **Frontend**: Operations → Warranty claims — open claims first, a status
  filter, a search, four count tiles; the claim dialog with the product
  picker filling code, name and months, an out-of-warranty warning as the
  expiry is typed, who logged and last changed it, and Delete for an
  Admin. 243 tests (5 new), build clean. Picking without the months,
  Delete for everyone, listing every claim first, and sending a blank
  expiry as text each failed a test.
- **Dev database migrated** (safety dump taken first): the claims table is
  there and the `WRC-` counter row is gone, as agreed.
- **Live check**, dumped after the migration and restored after (all 40
  tables identical): a claim from scanning TL-0101 (12 months filled in); a
  typed one claimed after its end date, warned in the dialog and red in the
  list; one moved to Sent for repair, then Ready, the tiles following;
  found by phone and by number; the Admin deleted one; the Seller saw no
  Delete, closed a claim (it left the open list, "changed by Check Seller"),
  and logged one of their own. No console errors.
- **Fixed after the live check**: the phone field had no style (a `tel`
  input) — it is a text input with the phone keypad now; the search box was
  too narrow for its placeholder on every list — the filter bar gives it
  300px (it still fits at phone width).
- Both `CLAUDE.md` files: the warranty rules, decision and patterns; step
  5c-5 done, 5d Printing next; three backend known gaps closed.

---

# 5c-4 Returns & voids

Two ways to correct a sale, each its own document — the invoice itself is
never edited. A **void** cancels an invoice raised in error: a Seller only
their own, on the day it was raised (`invoice.void.own`); an Admin any
(`invoice.void.any`); a reason is required; the number stays, marked Void.
The server refuses it once a payment or a return is recorded against the
invoice — the correction is then a return. A **return** takes goods back
against one invoice, never more than sold less already back; each line is
fit to sell (back into stock at the cost it left at) or faulty (no stock
moves). On posting, its value first reduces what is still owed on that
invoice; only the rest is refunded, by cash or KHQR. A posted return cannot
be undone. Both roles return goods (`return.view`, `return.create`).

Owner's choices (2026-10-06): a Returns | Voided invoices switch, each its
own table; the invoice is found with a picker that searches; a return can be
saved as a draft or posted; the live check dumps and restores the database
again.

## Design

**List** (Operations → Returns & voids):
- A note in place of the mockup's cash-session one: "A Seller may void
  their own invoice on the day it was raised; an Admin, any. After that, or
  once a payment or return is recorded against it, the correction is a
  return."
- Filters: **Returns | Voided invoices** (where the mockup has All types),
  period (this month by default, last 30 days, this year, all dates),
  customer, and for returns a status (all, draft, posted). No search — the
  returns API has none.
- Buttons: **New return** (`return.create`) · **Void an invoice** (either
  void scope).
- Tiles, counts only: Returns this month · Voided this month.
- Returns table: Number · Date · Against (invoice) · Customer · Reason ·
  Value · Settled by ("Credited to the invoice", "Cash refund", "KHQR
  refund", or both with amounts) · Status · Open.
- Voided invoices table: Number · Sold · Customer · Reason · Total · Voided
  by (and when) · Open. The period is by the date sold — the API filters
  invoices by that; a Seller's void is the same day anyway.

**Choose an invoice** (shared by both): completed invoices, newest first,
search by number or walk-in name; Invoice · Date · Customer · Total · Seller
· Select. For a Seller voiding, only their own from today — the only ones
they can void.

**New return** (document dialog, guarded):
- Against invoice: "Choose invoice", then its number, date and customer;
  fixed once the return is first saved (the server refuses a change).
- Date (today or earlier) · Number ("Given on save") · Reason (required).
- Lines, one per line of the invoice: ☐ · Product · Sold · Already back ·
  Returning · Price · Value · Back into stock (Yes — fit to sell / No —
  faulty). Ticking a line puts in all that can still come back; it can then
  be lowered. A line already all back is greyed. Value = price × quantity,
  rounded as the server does.
- Below: what the return comes to, how much reduces what is still owed on
  the invoice (from the customer's account), and what is refunded — with
  **Refund by** (Cash, KHQR) only when something is refunded. The server's
  figures replace it on posting.
- **Post return** (asks first: it cannot be undone) · **Save draft** ·
  **Delete draft** (a saved draft) · Cancel. A new return is created on its
  first save; if posting is refused, the draft stays open with the server's
  words, as a stock-in does.
- A posted return opens read-only with the server's total, credited,
  refunded and refund method.

**Void an invoice**: Choose an invoice → a reason dialog naming it (number,
customer, total) and what voiding does: "The stock goes back and the number
stays, marked Void. It cannot be undone." A refusal shows in the server's
words.

**A voided invoice** opens read-only: number, sold (date and seller),
customer, total, lines, the reason, and who voided it when.

**Where it departs from the mockup**:
- A switch between two tables rather than one mixed table (owner's choice).
- No cash sessions: same seller, same day; an Admin any.
- No money tiles (Refunded in cash, Credited to accounts) — counts only.
- No "Settle by: credit to the account" — the server decides what is
  credited; only the refund method is asked, when there is a refund.
- No search box. The invoice is chosen from a list, not typed.
- The mockup says a faulty item is "written off by adjustment"; it never
  went back into stock, so there is nothing to write off — the hint says so.

## Plan

- [x] `features/returns/`: the list — the Returns | Voided invoices switch,
      filters, two count tiles, both tables
- [x] Choose an invoice: the picker, with a Seller's void limited to their
      own invoices from today
- [x] New return: invoice, lines from it, the value and the credit/refund
      preview; Save draft, Post return, Delete draft; a posted one read-only
- [x] Void an invoice through the picker and `askReason()`; a voided
      invoice's read-only view
- [x] Menu and route: Returns & voids `ready: true`
- [x] Tests: the switch and filters; a return credited in part and refunded
      the rest; a draft saved, reopened and posted; a refused post keeps the
      draft; a Seller's void limited to today's own; an Admin's void with a
      reason; a voided invoice's view
- [x] Run all tests and the build
- [x] Live check: dump and fingerprint; sell a few invoices (one on
      credit); as Admin and Seller — a return partly credited and partly
      refunded, a faulty line that moves no stock, a draft posted later, a
      Seller's void and an Admin's void, a refused void; restore;
      fingerprint identical
- [x] Update `CLAUDE.md` and write the review below

## Review

- **Built**: Operations → Returns & voids — the Returns | Voided invoices
  switch with its filters and two count tiles; Choose an invoice (a Seller
  voiding sees only their own from today); New return with its lines, the
  value and how it settles (credited first, the rest refunded), Save draft,
  Post return, Delete draft, and a posted return read only; Void an invoice
  with a reason; a voided invoice read only.
- **Tests**: 238 in all (6 new), build clean. Settling all of a return as
  credit, rounding a line half up, showing a Seller every invoice, and
  ticking a line without putting in its quantity each failed a test.
- **Live check**, database dumped first and restored after (all 39 tables
  identical after): Chipmong's invoice of five saws ($245 on credit, $200
  paid) — two back fit to sell: $45 credited and $53 refunded in cash, as
  previewed; stock 123 → 125. One more back faulty, saved as a draft; the
  Seller posted it later by KHQR — $49 refunded, stock unmoved. Voiding that
  invoice was refused in the server's words (a payment is applied). The
  Admin voided a walk-in sale; the Seller's picker listed only their own
  sale, which they voided; stock ended at 127, as expected. No console
  errors.
- **Fixed after the live check**: the Post confirmation said "fit to sell
  goes back into stock" even when every line was faulty — it now says only
  what applies.
- `CLAUDE.md`: the Returns & voids decision and patterns; step 5c-4 done,
  5c-5 Warranty claims next.

---

# 5c-3 Customer payment

Money collected against invoices already on a customer's account. A payment
is its own document: applied in full to open invoices, never more than the
customer owes, frozen once saved; only an Admin may void it, which reopens
the invoices it paid. Both roles record payments (`payment.view`,
`payment.record`).

Owner's choices (2026-10-06): the dialog lists the open invoices and fills
the oldest first; filters only, no search; Void payment for an Admin; the
live check dumps and restores the database again.

## Design

**List** (Operations → Customer payment):
- Filters: period (this month by default, last 30 days, this year, all
  dates), customer, status (all, posted, void).
- Tiles, counts only: Payments this month · Voided this month.
- Table: Number · Date · Customer · Tender · Applied to (invoice numbers) ·
  Amount (riel tendered shown under it) · Taken by · Status · Open.

**Record a payment** (wide dialog):
- Customer — "Choose customer", the till's picker; then what they owe.
- Date (today or earlier) · Tender (Cash, KHQR, Bank transfer) · Currency
  (USD or KHR) · Amount received · Reference · Note · Number ("Given on
  save").
- Riel: shown in dollars at the rate of the payment's date — the server
  converts it the same way.
- Open invoices: ☐ · Invoice · Date · Due (red when overdue) · Owes ·
  Applying · Leaves (Settled / $x left / Untouched). Typing the amount fills
  the oldest first; any line can then be changed, ticked or unticked.
- Received · Applied · **Left to apply**, which must reach zero; more than
  the customer owes is said before saving.

**A saved payment** opens read-only: its details and what it paid. An Admin
sees **Void payment…**, which asks why.

**Where it departs from the mockup**:
- No money tiles (Collected, Still owed, Unallocated) — counts only; nothing
  is ever unallocated anyway.
- No search (owner's choice) and no Export.
- "Save and print receipt" comes with the printing step.
- Void payment added, Admin only.

## Plan

- [x] Backend: a `payment.void` scope, Admin only, so the Void button follows
      the scope rule (owner's choice, added while building)
- [x] `features/payments/`: the list — filters, two count tiles, the table
- [x] Record a payment: customer via the till's picker, open invoices from
      the customer's account, oldest first, riel at the date's rate, Left to
      apply to zero
- [x] A saved payment's view, with Void payment… for an Admin
- [x] Menu and route: Customer payment `ready: true`
- [x] Tests: the list and filters; a dollar payment filled oldest first,
      then changed by hand; a riel payment at its date's rate; more than
      owed held back before saving; void for an Admin only
- [x] Run all tests and the build
- [x] Live check: dump and fingerprint; credit sales to pay; as Admin and
      Seller — a dollar payment across two invoices, a riel payment, a void;
      restore; fingerprint identical
- [x] Update `CLAUDE.md` and write the review below

## Review

- **Built**: Operations → Customer payment — the list (period, customer and
  status filters; two count tiles; riel tendered under the amount), Record a
  payment (customer through the till's picker, open invoices filled oldest
  first, riel at the date's rate, Left to apply to zero), and a saved
  payment's view with Void payment… for an Admin.
- **Backend**: a `payment.void` scope, Admin only, so the Void button
  follows the scope rule like every other one (owner's choice). The endpoint
  was already Admin only; a backend test checks only an Admin has the scope.
- **Tests**: 232 frontend (7 new for payments), 213 backend; build clean.
  Filling newest first, always taking the latest rate whatever the date, and
  showing Void to everyone each failed a test.
- **Live check**, database dumped first and restored after (all 39 tables
  identical after): Chipmong owed $41.80 on two credit sales; $20 cash
  settled the older ($12.80) and put $7.20 on the newer, leaving $21.80;
  ៛40,000 by KHQR came to $10.00 at ៛4,000; voiding the $20 payment
  reopened both invoices; a Seller recorded $5 and saw no Void. Every
  preview matched the server's figures.
- **Fixed after the live check**: the tick-box column of the invoice table
  took the line tables' 170px first column — it now stays narrow.
- `CLAUDE.md`: the payment decision and patterns; step 5c-3 done, 5c-4 next;
  5b's note now says posting and reversing were checked live. Backend
  `CLAUDE.md`: the scope under Customer payment.

---

# 5c-2 Sell (the till)

Both roles sell (`sell`). Owner's choices (2026-10-06): the sale stays in
the browser until Complete or Hold; scanning a product already on the sale
adds 1; a new sale starts on **Walk-in**; a sale in progress survives a
reload of its tab; the live check dumps and restores the database again.

## Design

The mockup's two-column till, as a page (Operations → Sell).

**Left — who and what**
- Buyer, three cards:
  - **Walk-in** (the default): name and phone optional, retail price, pays now.
  - **Store customer**: "Choose customer" — search by name, code or phone;
    each shows its price and credit. Once chosen: code, phone and what they
    owe of their limit. A customer on credit hold can still be chosen — cash
    only (the mockup greyed them out).
  - **From a quotation**: "Choose a quotation" — accepted quotes with what
    remains; an expired one warns but can be chosen; a sent one cannot. Its
    lines come in at the agreed prices with the quantities still to invoice;
    a quantity can be lowered, not raised; discounts are as quoted. Removing
    a line leaves it on the quote.
  - Changing buyer re-prices the lines (retail or wholesale); switching to or
    from a quotation replaces them, and asks first.
- The product picker; the same product again adds 1.
- Lines: # · Product · Unit · Qty · Price · Discount (% or $ off each unit,
  15% cap, price fixed locked) · Total · ×. A product asked for beyond what is
  on hand says "Only N on hand" — the server refuses a sale past zero.

**Right — money**
- Total: Subtotal · Discount given · **To pay** · In riel at today's rate
  (to the nearest ៛100).
- Payment: **Add payment** — Cash, KHQR or Credit; dollars or riel (credit in
  dollars only); the amount starts at what is still to cover; a reference for
  KHQR. Credit only for a store customer allowed it and not on hold, with the
  room left shown.
- Covered · Paid now · On credit · Change due · **Change given** — whole
  dollars plus riel to the nearest ៛100 ($38.55 → $38 + ៛2,300), worked out
  as the server will; a shortfall under ៛50 paid in riel is not a shortfall.
- **Complete sale** (once covered) · **Hold sale** (with a label) · **Cancel
  sale** (asks when there are lines).
- **Held sales (n)**: label, buyer, lines, total → Resume or Delete.
- **Sale completed**: invoice number, customer, total, in riel, paid now, on
  credit and its due date, change given — the server's figures — then New
  sale.

**How it talks to the server**
- Complete a new sale: create it as a held invoice and complete it with its
  payments, in one go. If completing is refused (stock, credit, a discount),
  that held invoice is deleted again and the sale stays on screen with the
  server's words — no stray held sale is left behind.
- Hold: saves it as a held invoice under its label; the till clears.
- A resumed held sale: Complete updates it, then completes it. (The server
  re-prices a held sale at today's list price when it is saved.)
- The sale in progress is kept in this tab's session storage and comes back
  after a reload; Complete, Hold and Cancel clear it.

**Where it departs from the mockup**
- No invoice discount — per line only, as the backend has it.
- Customers on credit hold can be chosen (cash only).
- Held sales can be found again — the mockup had Hold but no way back.
- Sale completed shows the change given.
- No Print receipt or Print later yet (the printing step).
- Payments are Cash, KHQR and Credit — no bank transfer at the till.

## Plan

- [x] `shared/sales/sales-common.ts`: the payment preview as the backend's
      `settle()` — riel to dollars, still to cover, change in whole dollars
      plus riel, the under-៛50 rounding; tests with the backend's own
      examples ($361.45 paid with $400 → $38 + ៛2,300)
- [x] `features/sell/sale.ts`: the sale as signals — buyer, lines, payments,
      totals — kept in session storage for the tab
- [x] The Sell page: buyer cards, line table with the picker, totals, payment
      panel — split into three parts (buyer, lines, money) after the single
      template twice failed to write
- [x] Dialogs: choose customer, choose quotation, add payment, hold, held
      sales, sale completed
- [x] Complete, Hold, Resume and Cancel against the API
- [x] Menu and route: Sell `ready: true`
- [x] Tests: previews against the backend's figures; each buyer; discounts;
      the stock hint; payments and change; credit only when allowed; a
      completed sale, and a refused one cleaned up; hold and resume; a
      reload keeps the sale
- [x] Run all tests and the build
- [x] Live check: dump and fingerprint; an opening balance so there is stock
      to sell; as Admin and Seller — walk-in cash with riel change, a store
      customer partly on credit, a sale from a quotation, a sale refused for
      stock, hold and resume; restore; fingerprint identical
- [x] Update `CLAUDE.md` and write the review below

## Review

- **Built**: Operations → Sell — the buyer cards (walk-in by default, store
  customer, from a quotation), the line table with the picker, the total in
  dollars and riel, payments with change, Complete, Hold, Held sales
  (resume, delete), Cancel, and Sale completed. The sale is kept for its tab
  through a reload.
- **Split into parts**: the single page template twice failed to write, so
  the page is three child components (buyer, lines, money) sharing the sale
  service — smaller and easier to follow.
- **Tests**: 225 in all (14 new for the till and its money), build clean.
  Breaking the clean-up after a refusal, allowing credit on hold, and not
  keeping the sale each failed a test.
- **Live check**, database dumped first and restored after (all 39 tables
  identical after): a walk-in paid ៛10,000 for $2.10 → change $0 + ៛1,600; a
  sale past the shelf warned, was refused, and left no held sale; Chipmong
  paid $5 + $7.80 on credit, due 5 Nov; a quote invoiced 2 of 3 by KHQR
  ($12.16), leaving 1; a held sale resumed and completed ($1 + ៛2,000
  change); a reload kept the sale; a Seller sold. Every preview matched the
  server's figures.
- **Fixed after the live check**: "Paid now" showed the total before anything
  was paid — it now shows what has been taken so far (the server's figure
  once covered); the line table overflowed the till's column — the # and
  Unit columns went (the unit joins the product's second line) and the cells
  are tighter.
- `CLAUDE.md`: the till's decisions and patterns; step 5c-2 done, 5c-3 next.

---

# Reversal figures turned by the backend; no focus warning on posted documents

Owner's answers (2026-10-06): fix the console warning; the **backend** sends a
reversal's figures with their sign turned.

## Design

**Focus warning** (frontend). A stock-in or adjustment dialog marks its
supplier / reason select as the field to focus first. Once posted the select
is disabled, the browser cannot focus it, and the dialog library logs a
warning. Mark it only while the document can be edited; a posted document
then focuses its first button, as other read-only dialogs do.

**Reversal figures** (backend). A reversal stores a copy of its original's
lines, and a stock-in line may not hold negative numbers (a database rule),
so the stored figures stay as they are. Instead the API turns them **when it
sends a reversal**, one rule in the shared document serializer:

| Document | Turned on a reversal |
|---|---|
| Stock in | `total`; each line's `quantity` (into stock) and `line_total` |
| Adjustment | `total`; each line's `value`; `direction` (a damage reversal reads IN) |
| Stock count | `total`; each line's `difference` and `value`; `counted_qty` and `expected_qty` swap, so a line still reads counted − expected = difference |

What a user typed (packs, pack cost, quantity, unit cost) is unchanged. The
stock ledger is untouched — it is already signed the way stock moved, and it
is what reports will read. The API's field types do not change, so the
generated client needs no regenerating.

The screens then read right with no change of their own, except one: a
negative stock-in value is shown in the warning colour, as adjustments and
counts already are.

## Plan

- [x] Frontend: `cdkFocusInitial` on the supplier / reason select only while
      editable (stock-in and adjustment dialogs); a test that opening a
      posted document logs no warning
- [x] Backend: turn a reversal's figures in `DocumentSerializer`
      (`inventory/serializers.py`); flip an adjustment reversal's direction
- [x] Backend tests: each document type's reversal, as the API sends it;
      zero stays "0.00", never "-0.00"
- [x] Frontend: a negative stock-in value in the warning colour (list and
      dialog), with a test
- [x] Backend `CLAUDE.md`: "a reversal carries its original's figures"
      becomes how the API turns them
- [x] Run all backend tests, all frontend tests and the build
- [x] Write the review below

No live check this time: posting and reversing would need another database
dump and restore. The backend tests post and reverse in their own throwaway
database, and the screens are checked by their specs.

## Review

- **Focus warning**: the stock-in and adjustment dialogs mark the supplier /
  reason select as the first field only while it can be edited
  (`[attr.cdkFocusInitial]`). A test opens a posted stock-in and checks no
  warning is logged; with the old markup it fails.
- **Reversal figures**: `DocumentSerializer.to_representation()` turns the
  fields each document names (`TURNED`, `TURNED_ON_LINES`,
  `SWAPPED_ON_LINES`), and an adjustment reversal's `direction` flips. Three
  new backend tests send a reversal of each type through the API; dropping
  the direction flip fails one. A zero difference comes back "0.00" — Python's
  Decimal never makes "-0.00", so the guard I first wrote did nothing and
  was removed.
- **Screens**: a negative stock-in value shows in the warning colour (list,
  line total, document total); the reversal fixture now carries the turned
  figures the API sends. Removing the colour fails the list test.
- **Schema**: unchanged. The first regeneration picked up my explanation from
  the serializer's docstring (the schema copies docstrings into the API's
  descriptions); it moved to a code comment, and regenerating now changes
  nothing.
- **Tests**: backend 212 (3 new), frontend 211, build clean.
- Backend `CLAUDE.md` describes how reversal figures are turned.

---

# Post and reverse stock documents against the real backend

Owner's go-ahead (2026-10-06): dump the whole database, test posting and
reversing through the screens, then restore the dump. Posting writes the
stock ledger, which refuses deletes — only a restore puts it back.

## Plan

- [x] Dump the whole database (`pg_dump`, custom format) into the scratchpad,
      check it lists back, and fingerprint every table (row count + checksum)
- [x] Make the two check users
- [x] In the browser, as Admin, on the Drill bits products (AC-0501, -0503):
  - [x] Opening balance — 10 × AC-0501 at $12.50, 5 × AC-0503 at $2.10 → post
  - [x] Stock in — 5 × AC-0501 at $13.10 → post (average moves to $12.70)
  - [x] Damage — 2 × AC-0501 → post (goes out at the average: −$25.40)
  - [x] A write-off larger than what is on hand → the server refuses
  - [x] Stock count of Drill bits — AC-0501 counted 12 (13 expected) → post
        (−1 at $12.70); AC-0502 left blank → skipped
  - [x] Reverse the stock-in, the damage and the count, each with a reason;
        each opens its reversal; the originals show Reversed; no second
        reverse is offered
  - [x] Read the products' on hand and average after each step
- [x] Restore: stop the backend, recreate the database from the dump, start it
- [x] Fingerprint again → identical to before; check users gone with it
- [x] Write the review below

While it runs (a few minutes), any change made in the app is lost by the
restore, and a session signed in during that time has to sign in again.

## Review

- Dumped the whole database (221 KB, 39 tables) and fingerprinted every table
  first. Your own stock work was in it — GRN-000001 and ADJ-000001/-000002 on
  TL-0130 posted, drafts by admin, Piseth's open count CNT-000001 on Power
  tools — so the test kept to Drill bits (AC-0501, -0503), which had never
  moved and were on no count.
- Posted through the screens, AC-0501 after each step: opening balance 10 @
  $12.50 → stock in +5 @ $13.10 = 15 @ $12.70 → damage −2 (−$25.40) = 13 →
  count 12 of 13 expected (−1, −$12.70) = 12. Writing off 50 of AC-0503's 5
  was refused: "Not enough AC-0503 …: 5.00 on hand, 50.00 needed."
- Reversed the stock-in, the damage, the count and the opening balance, each
  with a reason: 7 @ $12.4143 → 9 @ $12.4778 → 10 @ $12.5000 → 0. Each
  reversal opened by itself; originals read "Reversed by …", reversals
  "Reverses …"; neither offers a second Reverse.
- Restored: backend stopped, database recreated from the dump, backend
  started. Fingerprint after: all 39 tables identical; check users gone.
- Found, not fixed (owner to decide):
  - A posted stock-in or adjustment logs a console warning on opening:
    `cdkFocusInitial` sits on the supplier/reason select, which is disabled
    once posted.
  - A reversal shows its original's figures with the same sign — the damage
    reversal reads −$25.40 though it brought stock back in; the count
    reversal reads −1 / −$12.70. The banner explains it, the list does not.
- One script slip along the way, not the app's: "GRN-000005" first matched
  the reversal's row ("Reverses GRN-000005"); rows are now found by their
  own number.

---

# Step 5c — Operations

Owner's choices (2026-10-06):

- **One screen at a time**, each with its own plan here, an OK, the build,
  tests and a live check: **Quotations → Sell → Customer payment → Returns &
  voids → Warranty claims**. Quotations first, because the till invoices them.
- **Warranty claims**: the backend has nothing yet. Build its model and API
  first — the seven agreed fields plus **customer name and phone**.
- **Printing** (receipts, invoices, quotations, payment receipts) is its own
  step after the five screens; Print buttons stay hidden until then.
- **The till keeps a sale in the browser** until Complete or Hold; the server
  sees it only then.

---

# 5c-1 Quotations

A price offered to a store customer. Nothing moves until an accepted quote is
invoiced at the till, and it may be invoiced in parts. Sellers and Admins
both create and edit quotes (`quotation.view`, `quotation.edit`).

## Design

**List** (mockup's screen):
- Filters: status (**Open quotes** by default = draft, sent or accepted; All;
  Draft; Sent; Accepted; Invoiced; Rejected), customer, search by number.
- Tiles, counts only: Open quotes · Sent, waiting on the customer · Accepted,
  still to invoice.
- Table: Number · Date · Customer · Valid until · Total · Invoiced ·
  Remaining · Status · Open. An open quote past its date shows **Expired**.

**Dialog** (wide, like the stock documents; asks before unsaved lines are
lost):
- Header: Customer (store customers only, fixed once saved) · Price (Retail
  or Wholesale, from the customer) · Quote date · Valid until (blank = 30
  days on) · Number ("Given on first save") · Terms · Note.
- Lines while Draft or Sent: the product picker (services included), Qty,
  Price at the customer's tier, Discount (% or $ off each unit), Line total.
  Previews worked out exactly as the server will; **over 15%** and **price
  fixed** show on the line before saving.
- Accepted, Invoiced, Rejected: read-only, with Invoiced and Remaining.
- Buttons by status:
  - Draft: Save draft · Mark sent · Mark accepted · Delete draft
  - Sent: Save · Mark accepted · Reject…
  - Accepted: Reject… (closes what is left uninvoiced)
  - Invoiced, Rejected: Close
- Reject asks for a reason (required); the server keeps it as the note.
- "Invoice at the till" comes with the Sell step; Print with printing.

**Where it departs from the mockup**:
- No quote discount — the backend has per-line discounts only.
- "Expired" is not a status, so it is not a filter; an open quote past its
  date wears an Expired pill and a warning, and can still be accepted and
  invoiced (the till warns).
- Mark sent and Mark accepted added — the mockup had no way to move a quote on.
- Tiles count only; no money tiles, no Export, no Print yet.
- Saving a quote's lines re-prices them at today's list price (the server
  does this); the dialog says so.

## Plan

- [x] `shared/money/exact.ts`: half-to-even rounding for line totals (the
      server's `net × qty` rounds that way) and a `compare()`
- [x] `shared/sales/sales-common.ts` (shared: the till and returns reuse it): the 15% cap (mirrors the backend's
      `money.py`, preview only), net price and line total, quote status labels
- [x] `shared/dialog/reason-dialog.ts`: asks for a required reason — Reject
      now, voids later
- [x] `features/quotations/`: list screen and quotation dialog
- [x] Menu and route: Quotations `ready: true`
- [x] Tests: money previews against Python's own figures; the list, filters
      and tiles; create, save, mark sent, accept, reject, delete; the 15%
      and price-fixed refusals; read-only accepted quote
- [x] Run the tests and the build
- [x] Live check as Admin and Seller: snapshot first, restore after (quotes
      deleted, the quotation counter put back, check users removed)
- [x] Update `CLAUDE.md` (step table, patterns) and write the review below

## Review

- **Built**: Operations → Quotations — the list (filters, three count tiles,
  Expired and "part invoiced" marks) and the quotation dialog (draft and sent
  editing, Mark sent, Mark accepted, Reject with a reason, Delete draft,
  read-only once accepted with Invoiced and Remaining).
- **Shared pieces**: `exact.ts` rounds half to even on request and compares;
  `shared/sales/sales-common.ts` prices a sale line as the backend does — it
  sits in `shared/` rather than `features/sales/` (the plan's path), because
  `features/` is one folder per menu and the till and returns reuse it;
  `askReason()` asks for a required reason.
- **Tests**: 211 in all (22 new), build clean. Raising the cap to 20% and
  pricing every line at wholesale each failed a test.
- **Live check** against the real backend, as Admin and Seller, for the
  customer Chipmong: the preview matched the server's figures exactly ($0.58
  less 5% → $0.55; 3 → $1.65; total $85.65, then $86.20 after qty 4); draft →
  sent → accepted → rejected; 16% refused on the line; the fixed-price
  TL-0150 locked; Escape asked; a Seller made and deleted a draft. Data
  restored identical to the snapshot; check users removed.
- **Fixed along the way**: two pills side by side (Accepted, Expired) touched
  — `.pill + .pill` now spaces them; locked dates and text areas on an
  accepted quote looked editable — disabled inputs and text areas are greyed
  like read-only ones (this also fixes posted stock documents).
- **Known limit**: a reopened quote does not know which products have a
  fixed price, so "Price fixed" shows only on lines picked in that session;
  the server still refuses a discount on the others.
- `CLAUDE.md`: Operations decisions, the quotations patterns, and the step
  table (5c-1 to 5c-5, then 5d Printing).

---

# Download a template from "Import a list"

The import dialog (Stock in, Adjustments) explains its columns in a hint, but
gives the user nothing to start from. Add **Download template**: a CSV with
the header row the import reads, for the document being filled.

Owner's choices (2026-10-06): **CSV, made in the browser** (no backend
change; Excel opens it, and the import reads it back as CSV or .xlsx), and
**column names only** — nothing in it can be imported by mistake.

The backend matches headers loosely (lower case, spaces → `_`), so readable
names work: "Product code", "Quantity", "Unit cost", "Pack size", "Pack unit".
Any other column is ignored, so "Product name" can sit beside the code for
the user's own reference.

| Document | File | Columns |
|---|---|---|
| Stock in | `stock-in-template.csv` | Product code, Product name, Quantity, Unit cost, Pack size, Pack unit |
| Opening balance | `opening-balance-template.csv` | Product code, Product name, Quantity, Unit cost |
| Any other adjustment | `adjustment-template.csv` | Product code, Product name, Quantity |

## Plan

- [x] `importTemplate(kind, needsCost)` in
      `features/stock/import-dialog/import-template.ts`: the file name and
      the CSV text (header row, with a UTF-8 mark so Excel keeps Khmer names
      typed into it)
- [x] Import dialog: a **Download template** button under the File field, and
      the hint naming the same columns (what each means; Pack size and Pack
      unit optional; Product name is for reference and not read)
- [x] Tests: each document's header row and file name; the button downloads
      that file
- [x] Check the three header rows against the backend's own reader
      (`to_records()` in `inventory/imports.py`, via the Django shell —
      reads nothing from the database, writes nothing)
- [x] Run the tests and the build
- [x] Write the review below

Files: `import-template.ts` and its spec (new), `import-dialog.ts`,
`import-dialog.html`. No backend change.

## Review

- **Download template (file name)** now sits under the File field of the
  import dialog. It saves a CSV holding only the header row for the document
  open: stock-in, opening balance, or any other adjustment.
- `import-template.ts` (new) holds the three column lists and the CSV text;
  `import-dialog.ts` and `.html` gained the button and a hint naming the same
  columns. No backend change.
- Checked against the backend: the three files, as the button writes them
  with one row added, go through `read_table()` and `to_records()` with every
  column landing where it should, the UTF-8 mark dropped and Product name
  ignored.
- Tests: 4 new (193 in all), build clean. Renaming one column on purpose
  failed 2 tests, so the names are guarded.
- Not tried in a real browser: opening the import dialog needs a saved
  draft, which takes a document number. The click, the file name and the
  bytes are covered by the spec.

---

# Put the frontend on GitHub (FLL_pos_web)

The remote `origin` → `https://github.com/pisethprom-dk/FLL_pos_web.git` is
added (owner's command). GitHub answers with no branches: the repository
exists and is empty. Locally there is one commit (the scaffold) and 178
uncommitted files — everything from step 3 to step 5b.

## Plan

- [x] Add the remote, as given
- [x] Leave `mock-up/` out: add `/mock-up/` to `.gitignore`. It is a
      byte-identical copy of the mockup already in `FLL_pos_api`, which is
      where `CLAUDE.md` points
- [x] Run the tests and the build, so what goes up is known to work
- [x] Commit 1 — "Regenerate the API client from the backend schema":
      `src/app/api/` only. It builds on its own (the scaffold does not use it)
- [x] Commit 2 — "Build the back office through step 5b": everything else
      (core, shared, features, styles, config, `CLAUDE.md`), with the steps
      listed in the message
- [x] Push `main` and set it to track `origin/main` (`git push -u origin main`)
- [x] Check GitHub's `main` is the commit just pushed (`git ls-remote origin`)
- [x] Write the review below

Why two commits and not one per step: `app.routes.ts`, `screens.ts`, the
shell spec and the stylesheet each hold every step's changes together, so a
per-step split would mean staging hunk by hunk, and the commits in between
would not build.

Not in this task: the backend's uncommitted changes and its unpushed
`daily-numbering` branch — a separate task once this one is done.

## Review

- `main` is on GitHub (`pisethprom-dk/FLL_pos_web`) and tracks `origin/main`;
  GitHub's `main` is `d34507c`, the same as local.
- Three commits: the scaffold, `2dea451` the API client (12 files, all in
  `src/app/api/`), `d34507c` the back office through step 5b (163 files).
- 189 tests passed and the build was clean before committing.
- `mock-up/` is ignored; the mockup stays in `FLL_pos_api`.
- One correction along the way: four deletions (the scaffold's `app.scss`
  and three `.gitkeep` placeholders) were already staged before this task and
  first landed in the API-client commit, which would then not have built. The
  two commits were redone locally, before the push, with those deletions in
  the second; the files in the end are the same.
- This review is written after the push, so it is not on GitHub yet; it goes
  up with the next commit.
- Still to do, as a separate task: the backend's uncommitted changes and its
  unpushed `daily-numbering` branch.
