// v1.1.0 — the mockup's "Import a product list", which nothing in the mockup
// opened (a known gap). Two calls with the same file: the first checks every
// row and adds nothing, the second adds the rows that passed. A row with a
// problem is never imported — the file is fixed and loaded again. "Download
// template" gives the header row to start from (owner's choice, 2026-10-06).
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ImportRequest } from '../../../api/models/import-request';
import { ImportResult } from '../../../api/models/import-result';
import { InventoryService } from '../../../api/services/inventory.service';
import { readApiErrors } from '../../../shared/api-errors';
import { QtyPipe, UsdPipe } from '../../../shared/money/money-pipes';
import { costPlaces } from '../stock-common';
import { importTemplate, templateCsv } from './import-template';

export interface ImportDialogData {
  readonly kind: 'stock-in' | 'adjustment';
  readonly id: number;
  readonly number: string;
  /** A stock-in or an opening balance: each row needs a cost. */
  readonly needsCost: boolean;
  /** Lines already on the draft, which the import can add to or replace. */
  readonly hasLines: boolean;
}

@Component({
  selector: 'app-import-dialog',
  imports: [QtyPipe, UsdPipe],
  templateUrl: './import-dialog.html',
})
export class ImportDialog {
  private readonly api = inject(InventoryService);
  protected readonly data = inject<ImportDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<'imported'>>(DialogRef);
  protected readonly costPlaces = costPlaces;
  protected readonly template = importTemplate(this.data.kind, this.data.needsCost);

  protected readonly file = signal<File | null>(null);
  protected readonly hasHeader = signal(true);
  protected readonly add = signal(true);
  /** The check's answer for the file and options as they are now. */
  protected readonly checked = signal<ImportResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly ready = computed(() => this.checked()?.ready ?? 0);

  /** Saves the template to the user's computer, as a link to a file would. */
  protected downloadTemplate(): void {
    const blob = new Blob([templateCsv(this.template)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.template.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  protected pickFile(input: HTMLInputElement): void {
    this.file.set(input.files?.[0] ?? null);
    this.forget();
  }

  protected setHeader(on: boolean): void {
    this.hasHeader.set(on);
    this.forget();
  }

  protected setAdd(on: boolean): void {
    this.add.set(on);
    this.forget();
  }

  protected check(): void {
    if (!this.file() || this.busy()) return;
    this.run(false, (result) => this.checked.set(result));
  }

  protected importRows(): void {
    if (!this.checked() || this.ready() === 0 || this.busy()) return;
    this.run(true, () => this.ref.close('imported'));
  }

  /** A changed file or option needs checking again. */
  private forget(): void {
    this.checked.set(null);
    this.errors.set([]);
  }

  private run(commit: boolean, done: (result: ImportResult) => void): void {
    const body: ImportRequest = {
      file: this.file()!,
      has_header: this.hasHeader(),
      replace: this.data.hasLines && !this.add(),
      commit,
    };
    const request: Observable<ImportResult> =
      this.data.kind === 'stock-in'
        ? this.api.inventoryStockInsImportCreate({ id: this.data.id, body })
        : this.api.inventoryAdjustmentsImportCreate({ id: this.data.id, body });
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
