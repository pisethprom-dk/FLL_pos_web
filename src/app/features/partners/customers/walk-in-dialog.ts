// v1.0.0 — the walk-in customer, read-only. Every sale without a named
// customer is recorded against it, so the backend refuses to rename it, give
// it credit or deactivate it.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { Customer } from '../../../api/models/customer';

@Component({
  selector: 'app-walk-in-dialog',
  templateUrl: './walk-in-dialog.html',
})
export class WalkInDialog {
  protected readonly customer = inject<Customer>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
}
