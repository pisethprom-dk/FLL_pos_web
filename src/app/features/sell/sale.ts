// v1.0.0 — the sale being rung up at the till: who is buying, the lines and
// the payments, held in the browser until it is completed or held (owner's
// choice, 2026-10-06). Every figure here is a preview worked out as the
// backend will (shared/sales/sales-common.ts); the server prices and settles
// the sale again on Complete, and what prints is what it returned. The sale
// survives a reload of its tab — kept in session storage, for the signed-in
// user only — and is cleared on Complete, Hold or Cancel.
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CreditStatusEnum } from '../../api/models/credit-status-enum';
import { InvoiceRequest } from '../../api/models/invoice-request';
import { PriceTierEnum } from '../../api/models/price-tier-enum';
import { ProductLookup } from '../../api/models/product-lookup';
import { TenderInputRequest } from '../../api/models/tender-input-request';
import { SessionStore } from '../../core/session/session-store';
import { ShopInfo } from '../../core/shell/shop-info';
import { compare, negate, sum, times } from '../../shared/money/exact';
import {
  DiscountType,
  PricedLine,
  Settlement,
  TenderInput,
  priceLine,
  settle,
  usdToKhr,
} from '../../shared/sales/sales-common';
import { QTY } from '../stock/stock-common';

export type BuyerKind = 'walkin' | 'store' | 'quote';

export interface StoreBuyer {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly phone: string;
  readonly tier: PriceTierEnum;
  readonly creditStatus: CreditStatusEnum;
}

export interface QuoteBuyer {
  readonly id: number;
  readonly number: string;
  readonly customer: number;
  readonly customerName: string;
  readonly tier: PriceTierEnum;
  readonly validUntil: string | null;
  readonly expired: boolean;
}

export interface SaleLine {
  readonly key: number;
  readonly product: number;
  readonly code: string;
  readonly name: string;
  /** Brand and model, for the muted second line. */
  readonly detail: string;
  readonly unit: string;
  /** List prices; a line from a quotation carries its agreed price in both. */
  readonly retail: string;
  readonly wholesale: string;
  readonly fixed: boolean;
  readonly tracked: boolean;
  /** On hand when the line was added; null when not known (a resumed sale). */
  readonly onHand: string | null;
  /** As typed. */
  readonly quantity: string;
  readonly discountType: DiscountType;
  readonly discountValue: string;
  /** A line from a quotation: its id, and how much of it is left to invoice. */
  readonly quoteLine: number | null;
  readonly remaining: string | null;
}

export interface SaleTender extends TenderInput {
  readonly key: number;
  readonly reference: string;
}

/** What is kept for the tab between reloads. */
interface Kept {
  readonly user: number;
  readonly kind: BuyerKind;
  readonly walkInName: string;
  readonly walkInPhone: string;
  readonly store: StoreBuyer | null;
  readonly quote: QuoteBuyer | null;
  readonly lines: readonly SaleLine[];
  readonly tenders: readonly SaleTender[];
  readonly heldId: number | null;
  readonly heldLabel: string;
}

const KEPT = 'pos-sale';
/** A discount: dollars and cents, or a percent to two places. Empty means none. */
const DISCOUNT = /^\d{1,8}(\.\d{1,2})?$/;

export interface SaleFigures {
  /** At list price, before discounts. */
  readonly subtotal: string;
  readonly discount: string;
  /** What the server will make the invoice total. */
  readonly total: string;
  /** The total in riel at today's rate; null without a rate. */
  readonly totalKhr: string | null;
  readonly items: string;
}

@Injectable()
export class Sale {
  private readonly rate = inject(ShopInfo).rate;
  private readonly user = inject(SessionStore).user;

  readonly kind = signal<BuyerKind>('walkin');
  readonly walkInName = signal('');
  readonly walkInPhone = signal('');
  readonly store = signal<StoreBuyer | null>(null);
  readonly quote = signal<QuoteBuyer | null>(null);
  readonly lines = signal<readonly SaleLine[]>([]);
  readonly tenders = signal<readonly SaleTender[]>([]);
  /** A held sale resumed here: Complete and Hold update it rather than make another. */
  readonly heldId = signal<number | null>(null);
  readonly heldLabel = signal('');
  private nextKey = 1;

  /** Today's rate, riel per dollar; null until the shell has it. */
  readonly rateValue = computed(() => this.rate()?.rate ?? null);

  readonly tier = computed<PriceTierEnum>(() => {
    switch (this.kind()) {
      case 'walkin':
        return 'RETAIL';
      case 'store':
        return this.store()?.tier ?? 'RETAIL';
      case 'quote':
        return this.quote()?.tier ?? 'WHOLESALE';
    }
  });

  /** The customer whose account a sale on credit would go to; null for a walk-in. */
  readonly customerId = computed(() =>
    this.kind() === 'store'
      ? (this.store()?.id ?? null)
      : this.kind() === 'quote'
        ? (this.quote()?.customer ?? null)
        : null,
  );

  readonly figures = computed<SaleFigures | null>(() => {
    const lines = this.lines();
    const priced = lines.map((line) => ({ line, p: this.priced(line) }));
    if (priced.some(({ p }) => p.total === null)) return null;
    const total = sum(
      priced.map(({ p }) => p.total!),
      2,
    )!;
    // As the server's discount_total: Σ (price − net) × qty, kept to cents half to even.
    const exact = sum(
      priced.map(({ line, p }) =>
        times(sum([this.price(line), negate(p.net!)!], 2)!, line.quantity, 4)!,
      ),
      4,
    )!;
    const discount = times(exact, '1', 2, 'half-even')!;
    const rate = this.rateValue();
    return {
      subtotal: sum([total, discount], 2)!,
      discount,
      total,
      totalKhr: rate ? usdToKhr(total, rate) : null,
      items: sum(
        lines.map((l) => l.quantity),
        2,
      )!,
    };
  });

  readonly settlement = computed<Settlement | null>(() => {
    const figures = this.figures();
    const rate = this.rateValue();
    return figures && rate ? settle(figures.total, this.tenders(), rate) : null;
  });

  constructor() {
    this.restore();
    effect(() => this.keep());
  }

  /** The unit price before discount: the customer's tier, or what the quote agreed. */
  price(line: SaleLine): string {
    if (line.quoteLine !== null) return line.retail;
    return this.tier() === 'WHOLESALE' ? line.wholesale : line.retail;
  }

  priced(line: SaleLine): PricedLine {
    return priceLine(
      this.price(line),
      this.qtyProblem(line) ? null : line.quantity,
      line.discountType,
      DISCOUNT.test(line.discountValue) || line.discountValue === '' ? line.discountValue : 'x',
      line.fixed,
    );
  }

  /** Why the quantity cannot be sold as typed; null when it can. */
  qtyProblem(line: SaleLine): string | null {
    if (!QTY.test(line.quantity) || compare(line.quantity, '0') !== 1) {
      return 'A quantity above zero, up to two decimals.';
    }
    if (line.remaining !== null && compare(line.quantity, line.remaining) === 1) {
      return `Only ${line.remaining.replace(/\.?0+$/, '')} left on the quotation.`;
    }
    return null;
  }

  /** More than the shelf holds: the server refuses a sale past zero. */
  short(line: SaleLine): boolean {
    return (
      line.tracked &&
      line.onHand !== null &&
      QTY.test(line.quantity) &&
      compare(line.quantity, line.onHand) === 1
    );
  }

  /** Any line that the server would refuse as it stands. */
  readonly blocked = computed(() =>
    this.lines().some(
      (line) =>
        this.qtyProblem(line) !== null ||
        this.priced(line).problem !== null ||
        (line.discountValue !== '' && !DISCOUNT.test(line.discountValue)),
    ),
  );

  setKind(kind: BuyerKind): void {
    if (kind === this.kind()) return;
    // A quotation's lines are only its own; leaving or joining one starts the lines again.
    if (kind === 'quote' || this.kind() === 'quote') this.lines.set([]);
    if (kind !== 'quote') this.quote.set(null);
    this.kind.set(kind);
    this.tenders.set([]);
  }

  chooseStore(buyer: StoreBuyer): void {
    this.store.set(buyer);
    this.tenders.set([]);
  }

  /** A quotation's outstanding lines, at the prices agreed on it. */
  chooseQuote(buyer: QuoteBuyer, lines: readonly Omit<SaleLine, 'key'>[]): void {
    this.quote.set(buyer);
    this.lines.set(lines.map((line) => ({ ...line, key: this.nextKey++ })));
    this.tenders.set([]);
  }

  /** Adds a product; one already on the sale gains one more instead. */
  add(product: ProductLookup): void {
    const existing = this.lines().find((l) => l.product === product.id && l.quoteLine === null);
    if (existing) {
      const qty = QTY.test(existing.quantity) ? sum([existing.quantity, '1'], 2)! : '1';
      this.update(existing.key, { quantity: qty.replace(/\.00$/, '') });
      return;
    }
    const line: SaleLine = {
      key: this.nextKey++,
      product: product.id,
      code: product.code,
      name: product.name,
      detail: [product.brand_name, product.model_no].filter(Boolean).join(' '),
      unit: product.unit_name,
      retail: product.retail_price ?? '0.00',
      wholesale: product.wholesale_price ?? '0.00',
      fixed: product.is_price_fixed ?? false,
      tracked: product.track_stock !== false,
      onHand: product.qty_on_hand,
      quantity: '1',
      discountType: 'PERCENT',
      discountValue: '',
      quoteLine: null,
      remaining: null,
    };
    this.lines.update((lines) => [...lines, line]);
  }

  update(
    key: number,
    change: Partial<Pick<SaleLine, 'quantity' | 'discountType' | 'discountValue'>>,
  ): void {
    this.lines.update((lines) => lines.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }

  remove(key: number): void {
    this.lines.update((lines) => lines.filter((l) => l.key !== key));
  }

  addTender(tender: Omit<SaleTender, 'key'>): void {
    this.tenders.update((tenders) => [...tenders, { ...tender, key: this.nextKey++ }]);
  }

  removeTender(key: number): void {
    this.tenders.update((tenders) => tenders.filter((t) => t.key !== key));
  }

  /** A fresh sale: a walk-in, no lines, no payments. */
  clear(): void {
    this.kind.set('walkin');
    this.walkInName.set('');
    this.walkInPhone.set('');
    this.store.set(null);
    this.quote.set(null);
    this.lines.set([]);
    this.tenders.set([]);
    this.heldId.set(null);
    this.heldLabel.set('');
  }

  /** Puts a held sale back on the till. */
  resume(
    state: Omit<Kept, 'user' | 'tenders' | 'lines'> & {
      readonly lines: readonly Omit<SaleLine, 'key'>[];
    },
  ): void {
    this.kind.set(state.kind);
    this.walkInName.set(state.walkInName);
    this.walkInPhone.set(state.walkInPhone);
    this.store.set(state.store);
    this.quote.set(state.quote);
    this.lines.set(state.lines.map((line) => ({ ...line, key: this.nextKey++ })));
    this.tenders.set([]);
    this.heldId.set(state.heldId);
    this.heldLabel.set(state.heldLabel);
  }

  /** The invoice as the API takes it. `walkIn` is the walk-in customer's id. */
  request(walkIn: number): InvoiceRequest {
    const kind = this.kind();
    return {
      customer: kind === 'walkin' ? walkIn : this.customerId()!,
      quotation: kind === 'quote' ? this.quote()!.id : null,
      hold_label: this.heldLabel(),
      walk_in_name: kind === 'walkin' ? this.walkInName().trim() : '',
      walk_in_phone: kind === 'walkin' ? this.walkInPhone().trim() : '',
      lines: this.lines().map((line) => {
        // A quotation's line keeps the price and discount agreed on it; the server copies them.
        if (line.quoteLine !== null) return { quote_line: line.quoteLine, quantity: line.quantity };
        const discounted = !!line.discountValue && compare(line.discountValue, '0') !== 0;
        return {
          product: line.product,
          quantity: line.quantity,
          discount_type: discounted ? line.discountType : '',
          discount_value: discounted ? line.discountValue : '0',
        };
      }),
    };
  }

  tenderRequests(): TenderInputRequest[] {
    return this.tenders().map((t) => ({
      kind: t.kind,
      currency: t.currency,
      amount: t.amount,
      ...(t.reference ? { reference: t.reference } : {}),
    }));
  }

  private keep(): void {
    const user = this.user();
    const kept: Kept | null = user
      ? {
          user: user.id,
          kind: this.kind(),
          walkInName: this.walkInName(),
          walkInPhone: this.walkInPhone(),
          store: this.store(),
          quote: this.quote(),
          lines: this.lines(),
          tenders: this.tenders(),
          heldId: this.heldId(),
          heldLabel: this.heldLabel(),
        }
      : null;
    try {
      if (!kept || (kept.lines.length === 0 && kept.kind === 'walkin' && !kept.heldId)) {
        sessionStorage.removeItem(KEPT);
      } else {
        sessionStorage.setItem(KEPT, JSON.stringify(kept));
      }
    } catch {
      // No storage (a private window): the sale simply does not outlive the page.
    }
  }

  private restore(): void {
    let kept: Kept | null = null;
    try {
      kept = JSON.parse(sessionStorage.getItem(KEPT) ?? 'null') as Kept | null;
    } catch {
      kept = null;
    }
    if (!kept || kept.user !== this.user()?.id) return;
    this.kind.set(kept.kind);
    this.walkInName.set(kept.walkInName);
    this.walkInPhone.set(kept.walkInPhone);
    this.store.set(kept.store);
    this.quote.set(kept.quote);
    this.lines.set(kept.lines);
    this.tenders.set(kept.tenders);
    this.heldId.set(kept.heldId);
    this.heldLabel.set(kept.heldLabel);
    this.nextKey =
      Math.max(0, ...kept.lines.map((l) => l.key), ...kept.tenders.map((t) => t.key)) + 1;
  }
}
