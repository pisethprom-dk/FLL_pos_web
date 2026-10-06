// v1.0.1 — Stock → Adjustments: any change in quantity that is not a
// purchase, a sale or a count, grouped by reason. Admin only (stock.view;
// stock.post to change anything). The tiles are counts the list can answer;
// the mockup's money tiles wait for the reports API (owner's choice,
// 2026-10-05).
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { InventoryAdjustmentsList$Params } from '../../../api/fn/inventory/inventory-adjustments-list';
import { Adjustment } from '../../../api/models/adjustment';
import { PaginatedAdjustmentList } from '../../../api/models/paginated-adjustment-list';
import { ReasonEnum } from '../../../api/models/reason-enum';
import { InventoryService } from '../../../api/services/inventory.service';
import { HasScope } from '../../../core/session/has-scope';
import { Modal } from '../../../shared/dialog/modal';
import { LoadError } from '../../../shared/load-error/load-error';
import { UsdPipe } from '../../../shared/money/money-pipes';
import { Pager } from '../../../shared/pager/pager';
import {
  PERIODS,
  Period,
  REASONS,
  StatusFilter,
  docState,
  periodStart,
  reasonOf,
} from '../stock-common';
import { AdjustmentDialog, AdjustmentResult } from './adjustment-dialog';

@Component({
  selector: 'app-adjustments',
  imports: [DatePipe, HasScope, LoadError, Pager, UsdPipe],
  templateUrl: './adjustments.html',
})
export class Adjustments {
  private readonly api = inject(InventoryService);
  private readonly modal = inject(Modal);

  protected readonly periods = PERIODS;
  protected readonly reasons = REASONS;
  protected readonly docState = docState;
  protected readonly reasonOf = reasonOf;

  protected readonly period = signal<Period>('month');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly reason = signal<ReasonEnum | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  private readonly typed = new Subject<string>();

  private readonly query = computed<InventoryAdjustmentsList$Params>(() => ({
    page: this.page(),
    search: this.search() || undefined,
    status: this.status() === 'all' ? undefined : (this.status() as 'DRAFT' | 'POSTED'),
    reason: this.reason() ?? undefined,
    date_from: periodStart(this.period()),
  }));
  protected readonly docs = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.inventoryAdjustmentsList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedAdjustmentList | undefined,
    PaginatedAdjustmentList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.docs.hasValue() ? this.docs.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        posted: this.api.inventoryAdjustmentsList({
          status: 'POSTED',
          date_from: periodStart('month'),
        }),
        drafts: this.api.inventoryAdjustmentsList({ status: 'DRAFT' }),
      }).pipe(map((r) => ({ posted: r.posted.count, drafts: r.drafts.count }))),
  });

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

  protected setPeriod(value: string): void {
    this.period.set(value as Period);
    this.page.set(1);
  }

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
    this.page.set(1);
  }

  protected setReason(value: string): void {
    this.reason.set(value ? (value as ReasonEnum) : null);
    this.page.set(1);
  }

  protected open(doc: Adjustment | null): void {
    this.modal
      .open<AdjustmentResult, Adjustment | null, AdjustmentDialog>(AdjustmentDialog, {
        data: doc,
        document: true,
        labelledBy: 'adj-title',
        guarded: true,
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.docs.reload();
        this.counts.reload();
        if (result !== 'saved') this.open(result.open);
      });
  }
}
