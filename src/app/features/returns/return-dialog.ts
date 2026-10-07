// v1.0.1 — one return: goods taken back against one invoice. A draft is filled
// in and posted here; a posted one is read only, and cannot be undone. Its
// lines are the invoice's own, each up to what was sold less what has come
// back already. The value is previewed as the server works it out — each line
// is its net price × quantity, rounded half to even — and so is how it
// settles: first off what the invoice still owes, the rest refunded by cash or
// KHQR. A new return is created on its first save, which takes its number.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap, tap } from 'rxjs';
import { BlankEnum } from '../../api/models/blank-enum';
import { Invoice } from '../../api/models/invoice';
import { InvoiceLine } from '../../api/models/invoice-line';
import { RefundMethodEnum } from '../../api/models/refund-method-enum';
import { SalesReturn } from '../../api/models/sales-return';
import { SalesReturnRequest } from '../../api/models/sales-return-request';
import { SalesService } from '../../api/services/sales.service';
import { SessionStore } from '../../core/session/session-store';
import { readApiErrors } from '../../shared/api-errors';
import { today } from '../../shared/dates';
import { confirm } from '../../shared/dialog/confirm-dialog';
import { confirmDiscard, onDismiss } from '../../shared/dialog/guard-close';
import { Modal } from '../../shared/dialog/modal';
import { plainDecimal } from '../../shared/money/decimal';
import { compare, sum, times } from '../../shared/money/exact';
import { QtyPipe, UsdPipe, formatMoney } from '../../shared/money/money-pipes';
import { QTY, notFuture } from '../stock/stock-common';
import { InvoicePicker, InvoicePickerData } from './invoice-picker';
import { REFUNDS, split, stillReturnable } from './returns-common';

/** One line of the invoice, and what of it is coming back. */
export interface ReturnRow {
  readonly line: InvoiceLine;
  /** Sold, less what posted returns have already brought back. */
  readonly left: string;
  readonly ticked: boolean;
  /** As typed. */
  readonly qty: string;
  readonly fit: boolean;
}

/** The invoice's lines, with what a draft already holds ticked in. */
function rowsFor(invoice: Invoice | null, draft: SalesReturn | null): ReturnRow[] {
  return (invoice?.lines ?? []).map((line) => {
    const held = draft?.lines?.find((l) => l.invoice_line === line.id);
    return {
      line,
      left: stillReturnable(line),
      ticked: !!held,
      qty: held ? plainDecimal(held.quantity) : '',
      fit: held?.fit_to_sell ?? true,
    };
  });
}

@Component({
  selector: 'app-return-dialog',
  imports: [DatePipe, ReactiveFormsModule, QtyPipe, UsdPipe],
  templateUrl: './return-dialog.html',
})
export class ReturnDialog {
  private readonly api = inject(SalesService);
  private readonly modal = inject(Modal);
  private readonly canCreate = inject(SessionStore).hasAnyScope(['return.create']);
  protected readonly ref = inject<DialogRef<'saved'>>(DialogRef);
  protected readonly refunds = REFUNDS;
  protected readonly today = today();

  /** What the dialog was opened on: nothing for a new return. */
  private readonly opened = inject<SalesReturn | null>(DIALOG_DATA);
  protected readonly doc = signal<SalesReturn | null>(this.opened);
  protected readonly editable = computed(() => this.canCreate && this.doc()?.status !== 'POSTED');

  /** A new return's invoice, as chosen. */
  private readonly picked = signal<Invoice | null>(null);
  /** A draft's invoice, for its lines as they stand today. */
  private readonly draftInvoice = rxResource({
    params: () =>
      this.canCreate && this.opened?.status === 'DRAFT' ? this.opened.invoice : undefined,
    stream: ({ params: id }) => this.api.salesInvoicesRetrieve({ id }),
  });
  protected readonly invoice = computed(
    () => this.picked() ?? (this.draftInvoice.hasValue() ? this.draftInvoice.value() : null),
  );
  protected readonly invoiceError = computed(() => this.draftInvoice.error());

  protected readonly rows = linkedSignal<Invoice | null, ReturnRow[]>({
    source: this.invoice,
    computation: (invoice) => rowsFor(invoice, this.opened),
  });

  /** The customer's account: what is still owed on this invoice, if anything. */
  private readonly account = rxResource({
    params: () => (this.editable() ? this.invoice()?.customer : undefined),
    stream: ({ params: id }) => this.api.salesCustomersAccountRetrieve({ id }),
  });
  protected readonly owed = computed(() => {
    const invoice = this.invoice();
    if (!invoice || !this.account.hasValue()) return null;
    return this.account.value().open_invoices.find((i) => i.id === invoice.id)?.balance ?? '0.00';
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    return_date: [today(), [Validators.required, notFuture]],
    reason: ['', [Validators.required, Validators.pattern(/\S/)]],
    refund_method: ['' as RefundMethodEnum | BlankEnum],
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly total = computed(() => {
    const values: string[] = [];
    for (const row of this.rows()) {
      if (!row.ticked) continue;
      const value = this.lineValue(row);
      if (value === null) return null;
      values.push(value);
    }
    return sum(values, 2);
  });
  protected readonly settles = computed(() => {
    const total = this.total();
    const owed = this.owed();
    return total !== null && owed !== null ? split(total, owed) : null;
  });
  protected readonly refunding = computed(
    () => compare(this.settles()?.refunded ?? '0', '0') === 1,
  );
  protected readonly ticked = computed(() => this.rows().filter((r) => r.ticked).length);

  /** Why the return cannot be posted yet, or null when it can. */
  protected readonly blocker = computed(() => {
    if (!this.invoice()) return 'Choose the invoice the goods were sold on.';
    if (this.rows().some((r) => this.problem(r))) return 'Put right the lines marked in red.';
    if (this.ticked() === 0) return 'Tick at least one line that is coming back.';
    const v = this.value();
    if (!/\S/.test(v.reason ?? '')) return 'Say why the goods came back.';
    if (!v.return_date || v.return_date > this.today) return 'A date, today or earlier.';
    if (this.refunding() && !v.refund_method) return 'Choose how the refund is paid.';
    return null;
  });

  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  /** A line changed, or the invoice chosen, since the last save. */
  private linesChanged = false;
  /** Something was saved or deleted: the list reloads when this closes. */
  private changed = false;

  constructor() {
    onDismiss(this.ref, () => this.close());
    const doc = this.doc();
    this.form.reset({
      return_date: doc?.return_date ?? today(),
      reason: doc?.reason ?? '',
      refund_method: doc?.refund_method ?? '',
    });
    if (!this.editable()) this.form.disable();
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected lineValue(row: ReturnRow): string | null {
    if (!row.ticked || this.problem(row)) return null;
    // The backend quantizes price × quantity with Decimal's default, half to even.
    return times(row.line.net_price, row.qty, 2, 'half-even');
  }

  protected problem(row: ReturnRow): string | null {
    if (!row.ticked) return null;
    if (!QTY.test(row.qty) || !/[1-9]/.test(row.qty)) return 'A quantity above zero.';
    if (compare(row.qty, row.left) === 1) return `Only ${plainDecimal(row.left)} can come back.`;
    return null;
  }

  protected chooseInvoice(): void {
    this.modal
      .open<Invoice, InvoicePickerData, InvoicePicker>(InvoicePicker, {
        data: { purpose: 'return', ownToday: false },
        wide: true,
        labelledBy: 'pick-invoice-title',
      })
      .closed.subscribe((invoice) => {
        if (!invoice) return;
        this.picked.set(invoice);
        this.linesChanged = true;
      });
  }

  /** Ticking a line puts in all that can still come back; it can then be lowered. */
  protected tick(index: number, on: boolean): void {
    this.edit(index, (row) => ({ ...row, ticked: on, qty: on ? plainDecimal(row.left) : '' }));
  }

  protected setQty(index: number, qty: string): void {
    this.edit(index, (row) => ({ ...row, qty: qty.trim() }));
  }

  protected setFit(index: number, fit: string): void {
    this.edit(index, (row) => ({ ...row, fit: fit === 'yes' }));
  }

  protected saveDraft(): void {
    if (this.busy() || !this.fitToSave()) return;
    this.run(this.persist(), () => this.ref.close('saved'));
  }

  protected post(): void {
    if (this.busy() || this.blocker()) return;
    const s = this.settles()!;
    const count = this.ticked();
    const method = REFUNDS.find((r) => r.value === this.value().refund_method)?.label;
    const back = this.rows().filter((r) => r.ticked);
    const fit = back.some((r) => r.fit);
    const faulty = back.some((r) => !r.fit);
    const parts = [
      `${count} ${count === 1 ? 'line' : 'lines'}, ${formatMoney(this.total(), '$', 2)}.`,
      fit && faulty
        ? 'Goods marked fit to sell go back into stock; faulty ones do not.'
        : fit
          ? 'The goods go back into stock.'
          : 'Faulty goods do not go back into stock.',
      compare(s.credited, '0') === 1
        ? `${formatMoney(s.credited, '$', 2)} comes off what ${this.invoice()!.number} still owes.`
        : '',
      this.refunding() ? `${formatMoney(s.refunded, '$', 2)} is refunded by ${method}.` : '',
      'A posted return cannot be undone.',
    ];
    confirm(this.modal, {
      title: `Post ${this.doc()?.number ?? 'this return'}?`,
      message: parts.filter(Boolean).join(' '),
      confirmLabel: 'Post return',
    }).closed.subscribe((yes) => {
      if (!yes) return;
      this.run(
        this.saved().pipe(switchMap((doc) => this.api.salesReturnsPostCreate({ id: doc.id }))),
        () => this.ref.close('saved'),
      );
    });
  }

  protected deleteDraft(): void {
    const doc = this.doc();
    if (!doc || this.busy()) return;
    confirm(this.modal, {
      title: `Delete ${doc.number}?`,
      message:
        'The draft is removed; nothing had come back into stock. Its number is not used again.',
      confirmLabel: 'Delete draft',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes)
        this.run(this.api.salesReturnsDestroy({ id: doc.id }), () => this.ref.close('saved'));
    });
  }

  /** The ×, Escape and the veil all come here: unsaved work is not lost without asking. */
  protected close(): void {
    if (this.busy()) return;
    const result = this.changed ? 'saved' : undefined;
    if (!this.editable() || !(this.form.dirty || this.linesChanged)) {
      this.ref.close(result);
      return;
    }
    confirmDiscard(this.modal).subscribe((yes) => {
      if (yes) this.ref.close(result);
    });
  }

  private edit(index: number, change: (row: ReturnRow) => ReturnRow): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? change(row) : row)));
    this.linesChanged = true;
  }

  /** A draft needs its invoice and a reason, and no line in error. */
  private fitToSave(): boolean {
    if (!this.invoice()) {
      this.errors.set(['Choose the invoice the goods were sold on.']);
      return false;
    }
    if (this.form.invalid || this.rows().some((r) => this.problem(r))) {
      this.form.markAllAsTouched();
      this.errors.set(this.form.invalid ? [] : ['Put right the lines marked in red.']);
      return false;
    }
    return true;
  }

  private body(): SalesReturnRequest {
    const v = this.form.getRawValue();
    return {
      invoice: this.invoice()!.id,
      return_date: v.return_date,
      reason: v.reason.trim(),
      refund_method: v.refund_method,
      lines: this.rows()
        .filter((r) => r.ticked)
        .map((r) => ({ invoice_line: r.line.id, quantity: r.qty, fit_to_sell: r.fit })),
    };
  }

  /** Saves the draft, creating it on the first save. */
  private persist(): Observable<SalesReturn> {
    const doc = this.doc();
    const request = doc
      ? this.api.salesReturnsPartialUpdate$Json({ id: doc.id, body: this.body() })
      : this.api.salesReturnsCreate$Json({ body: this.body() });
    return request.pipe(
      tap((saved) => {
        this.changed = true;
        this.doc.set(saved);
        this.form.markAsPristine();
        this.linesChanged = false;
      }),
    );
  }

  /** The draft as saved, saving it first if anything changed. */
  private saved(): Observable<SalesReturn> {
    const doc = this.doc();
    return doc && !this.form.dirty && !this.linesChanged ? of(doc) : this.persist();
  }

  private run<T>(request: Observable<T>, done: (result: T) => void): void {
    this.busy.set(true);
    this.errors.set([]);
    this.fieldErrors.set({});
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        done(result);
      },
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        const shown = ['return_date', 'reason', 'refund_method'];
        this.errors.set([
          ...form,
          ...Object.entries(fields)
            .filter(([field]) => !shown.includes(field))
            .flatMap(([, messages]) => messages),
        ]);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }
}
