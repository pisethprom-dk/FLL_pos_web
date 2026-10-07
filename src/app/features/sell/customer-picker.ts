// v1.0.0 — "Choose customer" at the till: active store customers, searched by
// name, code or phone, with their price and credit. A customer on credit hold
// can still be chosen — the sale is then cash only (the mockup greyed them
// out). The walk-in is not listed: it has its own card.
import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CustomerLookup } from '../../api/models/customer-lookup';
import { PartnersService } from '../../api/services/partners.service';
import { LoadError } from '../../shared/load-error/load-error';
import { creditPill, tierLabel } from '../partners/partner-labels';

@Component({
  selector: 'app-customer-picker',
  imports: [LoadError],
  templateUrl: './customer-picker.html',
})
export class CustomerPicker {
  private readonly api = inject(PartnersService);
  protected readonly ref = inject<DialogRef<CustomerLookup>>(DialogRef);
  protected readonly creditPill = creditPill;
  protected readonly tierLabel = tierLabel;

  private readonly search = signal('');
  private readonly typed = new Subject<string>();
  protected readonly found = rxResource({
    params: () => this.search(),
    stream: ({ params }) =>
      this.api.partnersCustomersLookupList({ search: params || undefined, active: 'true' }),
  });
  protected readonly customers = computed(() =>
    (this.found.hasValue() ? this.found.value() : []).filter((c) => !c.is_system),
  );

  constructor() {
    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((words) => this.search.set(words.trim()));
  }

  protected type(words: string): void {
    this.typed.next(words);
  }
}
