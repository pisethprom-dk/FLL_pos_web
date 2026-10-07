// v1.0.0 — Operations → Warranty claims: a log of what customers have brought
// back under warranty and where each item has got to. No invoice, no money,
// no stock. Open claims show first; the tiles are counts of open claims.
// Both roles log and edit; only an Admin deletes (owner's choices, 2026-10-06).
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map } from 'rxjs';
import { WarrantyClaimsList$Params } from '../../api/fn/warranty/warranty-claims-list';
import { ClaimStatusEnum } from '../../api/models/claim-status-enum';
import { PaginatedWarrantyClaimList } from '../../api/models/paginated-warranty-claim-list';
import { WarrantyClaim } from '../../api/models/warranty-claim';
import { WarrantyService } from '../../api/services/warranty.service';
import { HasScope } from '../../core/session/has-scope';
import { Modal } from '../../shared/dialog/modal';
import { LoadError } from '../../shared/load-error/load-error';
import { Pager } from '../../shared/pager/pager';
import { ClaimDialog } from './claim-dialog';
import { STATUSES, stateOf } from './warranty-common';

type Shown = 'open' | 'all' | ClaimStatusEnum;

@Component({
  selector: 'app-claims',
  imports: [DatePipe, HasScope, LoadError, Pager],
  templateUrl: './claims.html',
})
export class Claims {
  private readonly api = inject(WarrantyService);
  private readonly modal = inject(Modal);
  protected readonly statuses = STATUSES;
  protected readonly stateOf = stateOf;

  protected readonly shownStatus = signal<Shown>('open');
  private readonly search = signal('');
  private readonly typed = new Subject<string>();
  protected readonly page = signal(1);

  private readonly query = computed<WarrantyClaimsList$Params>(() => {
    const shown = this.shownStatus();
    return {
      page: this.page(),
      search: this.search() || undefined,
      open: shown === 'open' ? 'true' : undefined,
      status: shown === 'open' || shown === 'all' ? undefined : shown,
    };
  });
  protected readonly claims = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.warrantyClaimsList(params),
  });
  /** The last page loaded, kept on screen while the next one comes. */
  protected readonly shown = linkedSignal<
    PaginatedWarrantyClaimList | undefined,
    PaginatedWarrantyClaimList | undefined
  >({
    // value() throws while the resource is in error; hasValue() does not.
    source: () => (this.claims.hasValue() ? this.claims.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly counts = rxResource({
    stream: () =>
      forkJoin({
        open: this.api.warrantyClaimsList({ open: 'true' }),
        sent: this.api.warrantyClaimsList({ status: 'SENT_FOR_REPAIR' }),
        ready: this.api.warrantyClaimsList({ status: 'READY' }),
        expired: this.api.warrantyClaimsList({ open: 'true', out_of_warranty: 'true' }),
      }).pipe(
        map((r) => ({
          open: r.open.count,
          sent: r.sent.count,
          ready: r.ready.count,
          expired: r.expired.count,
        })),
      ),
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

  protected setStatus(value: string): void {
    this.shownStatus.set(value as Shown);
    this.page.set(1);
  }

  protected open(claim: WarrantyClaim | null): void {
    this.modal
      .open<'saved', WarrantyClaim | null, ClaimDialog>(ClaimDialog, {
        data: claim,
        wide: true,
        labelledBy: 'claim-title',
      })
      .closed.subscribe((result) => {
        if (!result) return;
        this.claims.reload();
        this.counts.reload();
      });
  }
}
