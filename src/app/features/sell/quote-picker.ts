// v1.0.0 — "Choose a quotation" at the till: accepted quotations, with what
// is left to invoice. Only an accepted quote can be invoiced; an expired one
// still can — the till warns, it does not block. A quote that has only been
// sent is not listed.
import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Quotation } from '../../api/models/quotation';
import { SalesService } from '../../api/services/sales.service';
import { LoadError } from '../../shared/load-error/load-error';
import { UsdPipe } from '../../shared/money/money-pipes';

@Component({
  selector: 'app-quote-picker',
  imports: [DatePipe, LoadError, UsdPipe],
  templateUrl: './quote-picker.html',
})
export class QuotePicker {
  private readonly api = inject(SalesService);
  protected readonly ref = inject<DialogRef<Quotation>>(DialogRef);

  private readonly search = signal('');
  private readonly typed = new Subject<string>();
  protected readonly quotes = rxResource({
    params: () => this.search(),
    stream: ({ params }) =>
      this.api.salesQuotationsList({ status: 'ACCEPTED', search: params || undefined }),
  });

  constructor() {
    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((words) => this.search.set(words.trim()));
  }

  protected type(words: string): void {
    this.typed.next(words);
  }
}
