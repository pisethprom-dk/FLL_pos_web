// v1.0.0 — Partners → Customers: store customers the shop knows by name, and
// the one walk-in row. What a customer owes is not on the list — it is worked
// out from invoices and payments, and shows in the customer's own dialog.
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { PartnersCustomersList$Params } from '../../../api/fn/partners/partners-customers-list';
import { Customer } from '../../../api/models/customer';
import { PaginatedCustomerList } from '../../../api/models/paginated-customer-list';
import { PartnersService } from '../../../api/services/partners.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { Modal } from '../../../shared/dialog/modal';
import { LoadError } from '../../../shared/load-error/load-error';
import { UsdPipe } from '../../../shared/money/money-pipes';
import { Pager } from '../../../shared/pager/pager';
import { creditPill, tierLabel } from '../partner-labels';
import { CustomerDialog } from './customer-dialog';
import { WalkInDialog } from './walk-in-dialog';

type CreditFilter = 'all' | 'yes' | 'no' | 'hold';
type TierFilter = 'all' | 'RETAIL' | 'WHOLESALE';
type StatusFilter = 'active' | 'inactive' | 'all';

@Component({
  selector: 'app-customers',
  imports: [HasScope, LoadError, Pager, UsdPipe],
  templateUrl: './customers.html',
})
export class Customers {
  private readonly api = inject(PartnersService);
  private readonly modal = inject(Modal);

  protected readonly canEdit = inject(SessionStore).hasAnyScope(['partner.edit']);

  protected readonly search = signal('');
  protected readonly credit = signal<CreditFilter>('all');
  protected readonly tier = signal<TierFilter>('all');
  protected readonly status = signal<StatusFilter>('active');
  protected readonly page = signal(1);
  private readonly typed = new Subject<string>();

  private readonly query = computed<PartnersCustomersList$Params>(() => ({
    page: this.page(),
    search: this.search() || undefined,
    credit: this.credit() === 'all' ? undefined : (this.credit() as 'yes' | 'no' | 'hold'),
    price_tier: this.tier() === 'all' ? undefined : (this.tier() as 'RETAIL' | 'WHOLESALE'),
    active: this.status() === 'all' ? undefined : this.status() === 'active' ? 'true' : 'false',
  }));
  protected readonly customers = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.partnersCustomersList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedCustomerList | undefined,
    PaginatedCustomerList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.customers.hasValue() ? this.customers.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        active: this.api.partnersCustomersList({ active: 'true' }),
        credit: this.api.partnersCustomersList({ active: 'true', credit: 'yes' }),
        hold: this.api.partnersCustomersList({ active: 'true', credit: 'hold' }),
      }).pipe(map((r) => ({ active: r.active.count, credit: r.credit.count, hold: r.hold.count }))),
  });

  protected readonly tierLabel = tierLabel;
  protected readonly creditPill = creditPill;

  constructor() {
    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((words) => {
        this.search.set(words.trim());
        this.page.set(1);
      });
  }

  protected type(words: string): void {
    this.typed.next(words);
  }

  protected setCredit(value: string): void {
    this.credit.set(value as CreditFilter);
    this.page.set(1);
  }

  protected setTier(value: string): void {
    this.tier.set(value as TierFilter);
    this.page.set(1);
  }

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
    this.page.set(1);
  }

  protected open(customer: Customer | null): void {
    if (customer?.is_system) {
      this.modal.open(WalkInDialog, { data: customer, labelledBy: 'walk-in-title' });
      return;
    }
    this.modal
      .open<'saved', Customer | null, CustomerDialog>(CustomerDialog, {
        data: customer,
        wide: true,
        labelledBy: 'customer-title',
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.customers.reload();
        this.counts.reload();
      });
  }
}
