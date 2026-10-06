// v1.0.0 — a rate that cannot be changed here, read-only: either sales already
// carry it, or the user may not edit rates. Closes with 'new' when the user
// asks to set a new rate instead.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ExchangeRate } from '../../../api/models/exchange-rate';
import { SessionStore } from '../../../core/session/session-store';
import { RatePipe } from '../../../shared/money/money-pipes';

export type RateDetailResult = 'new';

@Component({
  selector: 'app-rate-detail-dialog',
  imports: [DatePipe, RatePipe],
  templateUrl: './rate-detail-dialog.html',
})
export class RateDetailDialog {
  protected readonly rate = inject<ExchangeRate>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<RateDetailResult>>(DialogRef);
  protected readonly canEdit = inject(SessionStore).hasAnyScope(['company.edit']);
}
