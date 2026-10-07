// v1.0.0 — Operations → Sell: the till, as the mockup lays it out. Who is
// buying on the left with the lines; the money on the right. The sale lives
// in the browser (sale.ts) until Complete or Hold; on Complete it is created
// as a held invoice and completed with its payments in one go, and if the
// server refuses, that held invoice is deleted again so nothing stray is left
// (owner's choices, 2026-10-06). Both roles sell; nobody may discount past
// 15% or sell past zero — the server holds both lines.
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { CustomerLookup } from '../../api/models/customer-lookup';
import { Invoice } from '../../api/models/invoice';
import { Quotation } from '../../api/models/quotation';
import { PartnersService } from '../../api/services/partners.service';
import { SalesService } from '../../api/services/sales.service';
import { readApiErrors } from '../../shared/api-errors';
import { daysBefore, today } from '../../shared/dates';
import { confirm } from '../../shared/dialog/confirm-dialog';
import { Modal } from '../../shared/dialog/modal';
import { plainDecimal } from '../../shared/money/decimal';
import { compare, sum } from '../../shared/money/exact';
import { formatMoney } from '../../shared/money/money-pipes';
import { CustomerPicker } from './customer-picker';
import { HeldResult, HeldSales } from './held-sales';
import { HoldDialog } from './hold-dialog';
import { QuotePicker } from './quote-picker';
import { BuyerKind, QuoteBuyer, Sale, SaleLine, SaleTender, StoreBuyer } from './sale';
import { SaleBuyer } from './sale-buyer';
import { SaleDone } from './sale-done';
import { SaleLines } from './sale-lines';
import { CreditNote, SaleMoney } from './sale-money';
import { TenderDialog, TenderDialogData } from './tender-dialog';

type NewLine = Omit<SaleLine, 'key'>;

function storeBuyer(c: {
  id: number;
  code?: string;
  name: string;
  phone?: string;
  price_tier?: StoreBuyer['tier'];
  credit_status: StoreBuyer['creditStatus'];
}): StoreBuyer {
  return {
    id: c.id,
    code: c.code ?? '',
    name: c.name,
    phone: c.phone ?? '',
    tier: c.price_tier ?? 'RETAIL',
    creditStatus: c.credit_status,
  };
}

function quoteBuyer(q: Quotation): QuoteBuyer {
  return {
    id: q.id,
    number: q.number,
    customer: q.customer,
    customerName: q.customer_name,
    tier: q.price_tier,
    validUntil: q.valid_until ?? null,
    expired: q.is_expired,
  };
}

/** A discount as typed: blank when there is none. */
function typedDiscount(value: string | undefined): string {
  return value && compare(value, '0') !== 0 ? plainDecimal(value) : '';
}

/** A quotation's lines with something left to invoice, at the agreed prices. */
function quoteLines(q: Quotation): NewLine[] {
  return (q.lines ?? [])
    .filter((l) => compare(l.remaining, '0') === 1)
    .map((l) => ({
      product: l.product,
      code: l.product_code,
      name: l.product_name,
      detail: '',
      unit: l.unit_name,
      retail: l.unit_price,
      wholesale: l.unit_price,
      fixed: false,
      tracked: false,
      onHand: null,
      quantity: plainDecimal(l.remaining),
      discountType: l.discount_type === 'AMOUNT' ? 'AMOUNT' : 'PERCENT',
      discountValue: typedDiscount(l.discount_value),
      quoteLine: l.id,
      remaining: l.remaining,
    }));
}

@Component({
  selector: 'app-sell',
  imports: [SaleBuyer, SaleLines, SaleMoney],
  templateUrl: './sell.html',
  providers: [Sale],
})
export class Sell {
  protected readonly sale = inject(Sale);
  private readonly api = inject(SalesService);
  private readonly partners = inject(PartnersService);
  private readonly modal = inject(Modal);

  /** Every anonymous sale is recorded against the walk-in customer; the lookup lists it first. */
  private readonly customers = rxResource({
    stream: () => this.partners.partnersCustomersLookupList({}),
  });
  protected readonly walkInId = computed(() =>
    this.customers.hasValue()
      ? (this.customers.value().find((c) => c.is_system)?.id ?? null)
      : null,
  );
  /** The buyer's account: what they owe, their limit and the room left. */
  protected readonly account = rxResource({
    params: () => this.sale.customerId() ?? undefined,
    stream: ({ params: id }) => this.api.salesCustomersAccountRetrieve({ id }),
  });
  protected readonly heldCount = rxResource({
    stream: () => this.api.salesInvoicesList({ status: 'HELD' }).pipe(map((r) => r.count)),
  });

  protected readonly creditAllowed = computed(
    () =>
      this.sale.kind() !== 'walkin' &&
      this.account.hasValue() &&
      this.account.value().credit_status === 'YES',
  );

  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly notice = signal('');

  /** Why the sale cannot be completed yet, in a sentence; empty when it can. */
  protected readonly blocker = computed(() => {
    const sale = this.sale;
    if (sale.kind() === 'store' && !sale.store()) return 'Choose the customer.';
    if (sale.kind() === 'quote' && !sale.quote()) return 'Choose the quotation.';
    if (sale.lines().length === 0) return 'Add a product.';
    if (sale.blocked() || !sale.figures()) return 'Put right the lines marked in red.';
    if (!sale.rateValue()) return 'There is no exchange rate yet — set one under Company.';
    const settled = sale.settlement();
    if (settled?.problem) return settled.problem;
    if (sale.tenders().some((t) => t.kind === 'CREDIT') && !this.creditAllowed()) {
      return 'This customer cannot buy on credit — remove the credit payment.';
    }
    if (settled && compare(settled.stillToCover, '0') === 1) {
      return `${formatMoney(settled.stillToCover, '$', 2)} still to cover.`;
    }
    return '';
  });

  /** What a credit payment does to the account, as the mockup's note says it. */
  protected readonly creditNote = computed<CreditNote | null>(() => {
    const settled = this.sale.settlement();
    if (!settled || compare(settled.onCredit, '0') !== 1 || !this.account.hasValue()) return null;
    const account = this.account.value();
    return {
      name: account.name,
      onCredit: settled.onCredit,
      after: sum([account.balance, settled.onCredit], 2)!,
      limit: account.credit_limit,
      due: daysBefore(today(), -account.payment_terms_days),
    };
  });

  protected readonly canHold = computed(
    () =>
      this.sale.lines().length > 0 &&
      this.walkInId() !== null &&
      !(this.sale.kind() === 'store' && !this.sale.store()) &&
      !(this.sale.kind() === 'quote' && !this.sale.quote()),
  );

  /** Changing buyer to or from a quotation replaces the lines, so it asks first. */
  protected chooseKind(kind: BuyerKind): void {
    const sale = this.sale;
    if (kind === sale.kind()) return;
    const go = () => {
      sale.setKind(kind);
      this.errors.set([]);
      if (kind === 'store' && !sale.store()) this.pickCustomer();
      if (kind === 'quote') this.pickQuote();
    };
    if (sale.lines().length === 0 || (kind !== 'quote' && sale.kind() !== 'quote')) {
      go();
      return;
    }
    confirm(this.modal, {
      title: kind === 'quote' ? 'Sell from a quotation?' : 'Leave the quotation?',
      message:
        'The lines on the till now are cleared — a sale from a quotation takes only its own lines.',
      confirmLabel: 'Clear the lines',
    }).closed.subscribe((yes) => yes && go());
  }

  protected pickCustomer(): void {
    this.modal
      .open<CustomerLookup, unknown, CustomerPicker>(CustomerPicker, {
        wide: true,
        labelledBy: 'pick-customer-title',
      })
      .closed.subscribe((c) => c && this.sale.chooseStore(storeBuyer(c)));
  }

  protected pickQuote(): void {
    this.modal
      .open<Quotation, unknown, QuotePicker>(QuotePicker, {
        wide: true,
        labelledBy: 'pick-quote-title',
      })
      .closed.subscribe((q) => q && this.sale.chooseQuote(quoteBuyer(q), quoteLines(q)));
  }

  protected addPayment(): void {
    const settled = this.sale.settlement();
    const rate = this.sale.rateValue();
    if (!settled || !rate) return;
    const account = this.account.hasValue() ? this.account.value() : null;
    this.modal
      .open<Omit<SaleTender, 'key'>, TenderDialogData, TenderDialog>(TenderDialog, {
        data: {
          stillToCover: settled.stillToCover,
          rate,
          credit:
            this.creditAllowed() && account
              ? { name: account.name, roomLeft: account.room_left }
              : null,
        },
        labelledBy: 'tender-title',
      })
      .closed.subscribe((tender) => tender && this.sale.addTender(tender));
  }

  /**
   * Creates the sale as a held invoice — or updates the resumed one — and
   * completes it. A refused new sale's held invoice is deleted again.
   */
  protected complete(): void {
    const walkIn = this.walkInId();
    if (this.busy() || this.blocker() || walkIn === null) return;
    const held = this.sale.heldId();
    const tenders = this.sale.tenderRequests();
    this.run(
      this.save(walkIn).pipe(
        switchMap((invoice) =>
          this.api.salesInvoicesCompleteCreate$Json({ id: invoice.id, body: { tenders } }).pipe(
            catchError((error: unknown) => {
              if (held === null) {
                this.api
                  .salesInvoicesDestroy({ id: invoice.id })
                  .subscribe({ error: () => undefined });
              }
              return throwError(() => error);
            }),
          ),
        ),
      ),
      (invoice) => {
        this.sale.clear();
        this.heldCount.reload();
        this.modal.open<void, Invoice, SaleDone>(SaleDone, {
          data: invoice,
          labelledBy: 'done-title',
        });
      },
    );
  }

  protected hold(): void {
    const walkIn = this.walkInId();
    if (this.busy() || !this.canHold() || walkIn === null) return;
    this.modal
      .open<string, string, HoldDialog>(HoldDialog, {
        data: this.sale.heldLabel(),
        labelledBy: 'hold-title',
      })
      .closed.subscribe((label) => {
        if (label === undefined) return;
        this.sale.heldLabel.set(label);
        this.run(this.save(walkIn), () => {
          this.sale.clear();
          this.heldCount.reload();
          this.notice.set(
            `Sale held${label ? ` as “${label}”` : ''}. Find it again under Held sales.`,
          );
        });
      });
  }

  protected cancel(): void {
    const sale = this.sale;
    if (sale.lines().length === 0 && sale.heldId() === null) {
      sale.clear();
      return;
    }
    confirm(this.modal, {
      title: 'Cancel this sale?',
      message:
        sale.heldId() !== null
          ? 'The till is cleared. The held sale stays under Held sales, as it was last held.'
          : 'Its lines and payments are cleared. Nothing has been saved.',
      confirmLabel: 'Cancel sale',
      danger: true,
    }).closed.subscribe((yes) => {
      if (!yes) return;
      sale.clear();
      this.errors.set([]);
    });
  }

  protected openHeld(): void {
    this.modal
      .open<HeldResult, unknown, HeldSales>(HeldSales, { wide: true, labelledBy: 'held-title' })
      .closed.subscribe((result) => {
        if (!result) return;
        this.heldCount.reload();
        if (result === 'changed') return;
        if (this.sale.lines().length === 0) {
          this.resume(result);
          return;
        }
        confirm(this.modal, {
          title: 'Put the held sale on the till?',
          message: 'The sale on the till now is cleared — hold it first to keep it.',
          confirmLabel: 'Resume',
        }).closed.subscribe((yes) => yes && this.resume(result));
      });
  }

  /** Loads a held sale back onto the till, finding its buyer again. */
  private resume(invoice: Invoice): void {
    const lines: NewLine[] = (invoice.lines ?? []).map((l) => ({
      product: l.product!,
      code: l.product_code,
      name: l.product_name,
      detail: '',
      unit: l.unit_name,
      // The server re-prices a held sale when it is saved; until then, its own prices.
      retail: l.unit_price,
      wholesale: l.unit_price,
      fixed: false,
      tracked: false,
      onHand: null,
      quantity: plainDecimal(l.quantity),
      discountType: l.discount_type === 'AMOUNT' ? 'AMOUNT' : 'PERCENT',
      discountValue: typedDiscount(l.discount_value),
      quoteLine: l.quote_line ?? null,
      remaining: null,
    }));
    const base = {
      walkInName: invoice.walk_in_name ?? '',
      walkInPhone: invoice.walk_in_phone ?? '',
      heldId: invoice.id,
      heldLabel: invoice.hold_label ?? '',
    };
    this.errors.set([]);
    this.notice.set('');
    if (invoice.quotation) {
      this.run(this.api.salesQuotationsRetrieve({ id: invoice.quotation }), (q) => {
        const left = new Map((q.lines ?? []).map((l) => [l.id, l.remaining]));
        this.sale.resume({
          ...base,
          kind: 'quote',
          store: null,
          quote: quoteBuyer(q),
          lines: lines.map((l) => ({ ...l, remaining: left.get(l.quoteLine!) ?? null })),
        });
      });
    } else if (invoice.customer === this.walkInId()) {
      this.sale.resume({ ...base, kind: 'walkin', store: null, quote: null, lines });
    } else {
      this.run(this.partners.partnersCustomersRetrieve({ id: invoice.customer }), (c) =>
        this.sale.resume({ ...base, kind: 'store', store: storeBuyer(c), quote: null, lines }),
      );
    }
  }

  /** The sale as a held invoice: a new one, or the resumed one updated. */
  private save(walkIn: number): Observable<Invoice> {
    const body = this.sale.request(walkIn);
    const held = this.sale.heldId();
    return held === null
      ? this.api.salesInvoicesCreate$Json({ body })
      : this.api.salesInvoicesPartialUpdate$Json({ id: held, body });
  }

  private run<T>(request: Observable<T>, done: (result: T) => void): void {
    this.busy.set(true);
    this.errors.set([]);
    this.notice.set('');
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        done(result);
      },
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.errors.set([...form, ...Object.values(fields).flat()]);
        this.busy.set(false);
      },
    });
  }
}
