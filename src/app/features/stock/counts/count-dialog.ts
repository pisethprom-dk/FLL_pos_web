// v1.1.0 — one count: the sheet while counting, the differences once posted.
// Blind: the server sends no expected quantity until the count is posted, so
// the sheet has no column for it (the backend's known gap with the mockup).
// Each line is saved as it is entered — on Enter or on leaving the box —
// because the server reads the expected quantity at that moment; a sale made
// a minute later is then not mistaken for a shortage (owner's choice,
// 2026-10-05). A blank line is skipped when posting, never counted as zero.
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { StockCount } from '../../../api/models/stock-count';
import { StockCountLine } from '../../../api/models/stock-count-line';
import { InventoryService } from '../../../api/services/inventory.service';
import { SessionStore } from '../../../core/session/session-store';
import { readApiErrors } from '../../../shared/api-errors';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { onDismiss } from '../../../shared/dialog/guard-close';
import { Modal } from '../../../shared/dialog/modal';
import { plainDecimal } from '../../../shared/money/decimal';
import { QtyPipe, UsdPipe } from '../../../shared/money/money-pipes';
import { reverseDialog } from '../reverse-dialog/reverse-dialog';
import { DocResult, QTY, brandAndCategory, canReverse } from '../stock-common';

export type CountResult = DocResult<StockCount>;

/** One line's box: the count the server holds for it, and how its last save went. */
interface Entry {
  readonly saved: string;
  readonly state: 'idle' | 'saving' | 'saved' | 'failed';
  readonly message: string;
}

@Component({
  selector: 'app-count-dialog',
  imports: [DatePipe, QtyPipe, UsdPipe],
  templateUrl: './count-dialog.html',
})
export class CountDialog {
  private readonly api = inject(InventoryService);
  private readonly modal = inject(Modal);
  private readonly canPost = inject(SessionStore).hasAnyScope(['stock.post']);
  protected readonly ref = inject<DialogRef<CountResult>>(DialogRef);
  protected readonly brandAndCategory = brandAndCategory;

  protected readonly doc = signal(inject<StockCount>(DIALOG_DATA));
  protected readonly counting = computed(() => this.canPost && this.doc().status === 'DRAFT');
  protected readonly reversible = computed(() => this.canPost && canReverse(this.doc()));

  protected readonly entries = signal<Record<number, Entry>>(
    Object.fromEntries(
      this.doc().lines.map((line) => [
        line.id,
        {
          saved: line.counted_qty === null ? '' : plainDecimal(line.counted_qty),
          state: 'idle',
          message: '',
        } satisfies Entry,
      ]),
    ),
  );
  protected readonly find = signal('');
  protected readonly openOnly = signal(false);

  /** Counted so far, as the server holds it. */
  protected readonly counted = computed(
    () => Object.values(this.entries()).filter((e) => e.saved !== '').length,
  );
  protected readonly saving = computed(() =>
    Object.values(this.entries()).some((e) => e.state === 'saving'),
  );
  protected readonly failed = computed(() =>
    Object.values(this.entries()).some((e) => e.state === 'failed'),
  );
  protected readonly shown = computed(() => {
    const words = this.find().trim().toLowerCase();
    const entries = this.entries();
    return this.doc().lines.filter(
      (line) =>
        (!this.openOnly() || entries[line.id]?.saved === '') &&
        (!words ||
          [line.product_code, line.product_name, line.shelf_location].some((text) =>
            text.toLowerCase().includes(words),
          )),
    );
  });

  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  /** Counts were saved, or the count posted or abandoned: the list reloads. */
  private changed = false;

  constructor() {
    onDismiss(this.ref, () => this.close());
  }

  /** A shortage is below zero, a surplus above it. */
  protected sign(value: string | null): number {
    if (!value || !/[1-9]/.test(value)) return 0;
    return value.startsWith('-') ? -1 : 1;
  }

  protected entry(line: StockCountLine): Entry {
    return this.entries()[line.id];
  }

  /** Saves what is in a line's box, unless the server already has it. */
  protected commit(line: StockCountLine, box: HTMLInputElement): void {
    const text = box.value.trim();
    const entry = this.entry(line);
    if (text === entry.saved) {
      this.setEntry(line.id, { ...entry, state: entry.state === 'failed' ? 'idle' : entry.state });
      return;
    }
    if (text !== '' && !QTY.test(text)) {
      this.setEntry(line.id, {
        ...entry,
        state: 'failed',
        message: 'A number, zero or more, up to two decimals.',
      });
      return;
    }
    this.setEntry(line.id, { ...entry, state: 'saving', message: '' });
    this.api
      .inventoryCountsRecordCreate$Json({
        id: this.doc().id,
        body: { lines: [{ line: line.id, counted_qty: text === '' ? null : text }] },
      })
      .subscribe({
        next: () => {
          this.changed = true;
          this.setEntry(line.id, { saved: text, state: 'saved', message: '' });
        },
        error: (error: unknown) => {
          const { form, fields } = readApiErrors(error);
          this.setEntry(line.id, {
            ...this.entry(line),
            state: 'failed',
            message: [...form, ...Object.values(fields).flat()][0] ?? 'Not saved.',
          });
        },
      });
  }

  /** Enter moves to the next box; leaving this one saves it. */
  protected next(event: Event, line: StockCountLine): void {
    event.preventDefault();
    const lines = this.shown();
    const after = lines[lines.findIndex((l) => l.id === line.id) + 1];
    const box = after && document.getElementById(`count-${after.id}`);
    if (box) box.focus();
    else (event.target as HTMLInputElement).blur();
  }

  protected post(): void {
    if (this.busy() || this.saving()) return;
    const count = this.doc();
    const counted = this.counted();
    if (counted === 0) {
      this.errors.set(['Nothing has been counted yet.']);
      return;
    }
    const skipped = count.lines_total - counted;
    confirm(this.modal, {
      title: `Post ${count.number}?`,
      message:
        `${counted} of ${count.lines_total} lines counted. ` +
        (skipped > 0 ? `The ${skipped} left blank are skipped, not counted as zero. ` : '') +
        'Each difference goes in or out at the current average cost. A posted count cannot be ' +
        'changed — only reversed.',
      confirmLabel: 'Post differences',
    }).closed.subscribe((yes) => {
      if (yes) {
        this.run(this.api.inventoryCountsPostCreate({ id: count.id }), (posted) => {
          this.changed = true;
          this.doc.set(posted);
        });
      }
    });
  }

  protected abandon(): void {
    const count = this.doc();
    if (this.busy()) return;
    confirm(this.modal, {
      title: `Abandon ${count.number}?`,
      message:
        'The sheet and everything counted on it are thrown away, and no stock moves. Its ' +
        'products can then go on a new count.',
      confirmLabel: 'Abandon count',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes)
        this.run(this.api.inventoryCountsDestroy({ id: count.id }), () => this.ref.close('saved'));
    });
  }

  protected reverse(): void {
    const count = this.doc();
    if (this.busy()) return;
    reverseDialog<StockCount>(this.modal, {
      number: count.number,
      effect:
        `This posts a new count that undoes every difference of ${count.number}: a shortage ` +
        'comes back and a surplus goes out again, at the cost stamped on each line. It is ' +
        'refused if that stock has already gone out.',
      send: (note) => this.api.inventoryCountsReverseCreate$Json({ id: count.id, body: { note } }),
    }).closed.subscribe((reversal) => {
      if (reversal) this.ref.close({ open: reversal });
    });
  }

  /** Counts save as they are entered, so only one still in flight, or refused, asks first. */
  protected close(): void {
    if (this.busy()) return;
    const result = this.changed ? 'saved' : undefined;
    if (!this.saving() && !this.failed()) {
      this.ref.close(result);
      return;
    }
    confirm(this.modal, {
      title: 'Close the sheet?',
      message: this.saving()
        ? 'A count is still being saved and may be lost.'
        : 'Some counts were not saved — they are marked on the sheet.',
      confirmLabel: 'Close anyway',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) this.ref.close(result);
    });
  }

  private setEntry(id: number, entry: Entry): void {
    this.entries.update((all) => ({ ...all, [id]: entry }));
  }

  private run<T>(request: Observable<T>, done: (result: T) => void): void {
    this.busy.set(true);
    this.errors.set([]);
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        done(result);
      },
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.errors.set([...form, ...Object.values(fields).flat()]);
        this.busy.set(false);
      },
    });
  }
}
