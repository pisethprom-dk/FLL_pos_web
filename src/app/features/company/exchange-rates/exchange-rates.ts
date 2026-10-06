// v1.0.0 — Company → Exchange rate: riel per US dollar, one row per effective
// date. A rate with sales against it is frozen; a correction is a new rate.
import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ExchangeRate } from '../../../api/models/exchange-rate';
import { CompanyService } from '../../../api/services/company.service';
import { HasScope } from '../../../core/session/has-scope';
import { SessionStore } from '../../../core/session/session-store';
import { ShopInfo } from '../../../core/shell/shop-info';
import { dayBefore, today } from '../../../shared/dates';
import { Modal } from '../../../shared/dialog/modal';
import { LoadError } from '../../../shared/load-error/load-error';
import { RatePipe } from '../../../shared/money/money-pipes';
import { RateDetailDialog, RateDetailResult } from './rate-detail-dialog';
import { RateDialog, RateDialogData } from './rate-dialog';

export type RateStatus = 'In use' | 'Scheduled' | 'Past';

export interface RateRow {
  readonly rate: ExchangeRate;
  /** The day before the next rate starts; null while nothing has replaced it. */
  readonly effectiveTo: string | null;
  readonly status: RateStatus;
}

@Component({
  selector: 'app-exchange-rates',
  imports: [DatePipe, HasScope, LoadError, RatePipe],
  templateUrl: './exchange-rates.html',
})
export class ExchangeRates {
  private readonly api = inject(CompanyService);
  private readonly modal = inject(Modal);
  private readonly shopInfo = inject(ShopInfo);
  private readonly session = inject(SessionStore);
  private readonly today = today();

  protected readonly rates = rxResource({ stream: () => this.api.companyExchangeRatesList() });
  protected readonly canEdit = this.session.hasAnyScope(['company.edit']);

  /** Newest first, each with the day it stopped applying and where it stands today. */
  protected readonly rows = computed<readonly RateRow[]>(() => {
    // value() throws while the resource is in error; hasValue() does not.
    const loaded = this.rates.hasValue() ? this.rates.value().results : [];
    const list = [...loaded].sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    // The rate a sale today would stamp: the latest one dated today or earlier.
    const inUse = list.find((rate) => rate.effective_date <= this.today);
    return list.map((rate, index) => ({
      rate,
      effectiveTo: index === 0 ? null : dayBefore(list[index - 1].effective_date),
      status: rate.effective_date > this.today ? 'Scheduled' : rate === inUse ? 'In use' : 'Past',
    }));
  });

  protected readonly tiles = computed(() => {
    const rows = this.rows();
    const at = rows.findIndex((row) => row.status === 'In use');
    const year = this.today.slice(0, 4);
    return {
      current: at >= 0 ? rows[at] : null,
      previous: at >= 0 ? (rows[at + 1] ?? null) : null,
      // Scheduled rows sit at the top, newest first: the nearest is the last of them.
      next: rows.filter((row) => row.status === 'Scheduled').at(-1) ?? null,
      year,
      changesThisYear: rows.filter((row) => row.rate.effective_date.startsWith(year)).length,
    };
  });

  /** How many rates there are in all, when more than one page came back. */
  protected readonly total = computed(() => {
    if (!this.rates.hasValue()) return 0;
    const page = this.rates.value();
    return page.count > page.results.length ? page.count : 0;
  });

  protected add(): void {
    this.openEditor(null);
  }

  protected open(row: RateRow): void {
    if (this.canEdit && !row.rate.is_in_use) {
      this.openEditor(row.rate);
      return;
    }
    this.modal
      .open<RateDetailResult, ExchangeRate, RateDetailDialog>(RateDetailDialog, {
        data: row.rate,
        labelledBy: 'rate-detail-title',
      })
      .closed.subscribe((result) => {
        if (result === 'new') this.openEditor(null);
      });
  }

  private openEditor(rate: ExchangeRate | null): void {
    this.modal
      .open<ExchangeRate, RateDialogData, RateDialog>(RateDialog, {
        data: { rate },
        labelledBy: 'rate-title',
      })
      .closed.subscribe((saved) => {
        if (!saved) return;
        this.rates.reload();
        // It may be today's rate: the top bar shows that.
        this.shopInfo.reloadRate();
      });
  }
}
