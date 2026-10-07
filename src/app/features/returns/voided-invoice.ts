// v1.0.0 — a voided invoice, read only: what was sold, and who voided it, when
// and why. The number stays, marked Void; its stock went back.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Invoice } from '../../api/models/invoice';
import { QtyPipe, UsdPipe } from '../../shared/money/money-pipes';

@Component({
  selector: 'app-voided-invoice',
  imports: [DatePipe, QtyPipe, UsdPipe],
  templateUrl: './voided-invoice.html',
})
export class VoidedInvoice {
  protected readonly invoice = inject<Invoice>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
}
