// v1.0.0 — the held sales, which any till may resume or delete. The mockup
// had Hold sale but no way back to one; this is it. Resuming closes with the
// invoice for the till to load.
import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Invoice } from '../../api/models/invoice';
import { SalesService } from '../../api/services/sales.service';
import { readApiErrors } from '../../shared/api-errors';
import { confirm } from '../../shared/dialog/confirm-dialog';
import { Modal } from '../../shared/dialog/modal';
import { LoadError } from '../../shared/load-error/load-error';
import { UsdPipe } from '../../shared/money/money-pipes';

/** The invoice to resume, or 'changed' when one was deleted. */
export type HeldResult = Invoice | 'changed';

@Component({
  selector: 'app-held-sales',
  imports: [LoadError, UsdPipe],
  templateUrl: './held-sales.html',
})
export class HeldSales {
  private readonly api = inject(SalesService);
  private readonly modal = inject(Modal);
  protected readonly ref = inject<DialogRef<HeldResult>>(DialogRef);
  protected readonly held = rxResource({
    stream: () => this.api.salesInvoicesList({ status: 'HELD' }),
  });
  protected readonly errors = signal<string[]>([]);
  private changed = false;

  /** Who it is for: the walk-in's name, or the customer. */
  protected buyer(sale: Invoice): string {
    return sale.walk_in_name ? `${sale.customer_name} — ${sale.walk_in_name}` : sale.customer_name;
  }

  protected remove(sale: Invoice): void {
    confirm(this.modal, {
      title: `Delete ${sale.hold_label || 'this held sale'}?`,
      message: 'It took no stock and no number, so nothing else changes.',
      confirmLabel: 'Delete held sale',
      danger: true,
    }).closed.subscribe((yes) => {
      if (!yes) return;
      this.errors.set([]);
      this.api.salesInvoicesDestroy({ id: sale.id }).subscribe({
        next: () => {
          this.changed = true;
          this.held.reload();
        },
        error: (error: unknown) => this.errors.set(readApiErrors(error).form),
      });
    });
  }

  protected close(): void {
    this.ref.close(this.changed ? 'changed' : undefined);
  }
}
