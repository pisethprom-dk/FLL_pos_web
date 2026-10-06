// v1.0.0 — Company → Payment notes: how-to-pay text and images printed at the
// foot of an invoice, with a preview of how the shown ones print.
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PaymentNote } from '../../../api/models/payment-note';
import { CompanyService } from '../../../api/services/company.service';
import { HasScope } from '../../../core/session/has-scope';
import { ShopInfo } from '../../../core/shell/shop-info';
import { Modal } from '../../../shared/dialog/modal';
import { LoadError } from '../../../shared/load-error/load-error';
import { PaymentNoteData, PaymentNoteDialog, PaymentNoteResult } from './payment-note-dialog';

@Component({
  selector: 'app-payment-notes',
  imports: [HasScope, LoadError],
  templateUrl: './payment-notes.html',
})
export class PaymentNotes {
  private readonly api = inject(CompanyService);
  private readonly modal = inject(Modal);

  protected readonly notes = rxResource({ stream: () => this.api.companyPaymentNotesList() });
  /** In the server's order: row order, then type. */
  // value() throws while the resource is in error; hasValue() does not.
  protected readonly list = computed(() =>
    this.notes.hasValue() ? this.notes.value().results : [],
  );
  /** What a new invoice prints. */
  protected readonly shown = computed(() => this.list().filter((note) => note.is_active !== false));
  protected readonly profile = inject(ShopInfo).profile;

  protected add(): void {
    this.openEditor(null);
  }

  protected edit(note: PaymentNote): void {
    this.openEditor(note);
  }

  private openEditor(note: PaymentNote | null): void {
    // A new note goes to the bottom unless the user says otherwise.
    const nextOrder = Math.max(0, ...this.list().map((n) => n.row_order ?? 0)) + 1;
    this.modal
      .open<PaymentNoteResult, PaymentNoteData, PaymentNoteDialog>(PaymentNoteDialog, {
        data: { note, nextOrder },
        labelledBy: 'note-title',
      })
      .closed.subscribe((result) => {
        if (result) this.notes.reload();
      });
  }
}
