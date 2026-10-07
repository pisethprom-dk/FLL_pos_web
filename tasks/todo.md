<!-- v1.12.6 -->
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
