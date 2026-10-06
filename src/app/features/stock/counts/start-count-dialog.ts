// v1.0.0 — starting a count: one category, its sub-categories included. The
// server puts every stock-tracked product in it on the sheet, and refuses a
// product that is already on another open count. Counted by is whoever starts
// it, as in the mockup.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../../api/models/category';
import { StockCount } from '../../../api/models/stock-count';
import { InventoryService } from '../../../api/services/inventory.service';
import { SessionStore } from '../../../core/session/session-store';
import { readApiErrors } from '../../../shared/api-errors';
import { today } from '../../../shared/dates';
import { clearOnEdit } from '../../../shared/server-errors';
import { asTree } from '../../catalogue/categories/categories';
import { notFuture } from '../stock-common';

@Component({
  selector: 'app-start-count-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './start-count-dialog.html',
})
export class StartCountDialog {
  private readonly api = inject(InventoryService);
  protected readonly ref = inject<DialogRef<StockCount>>(DialogRef);
  protected readonly counter = inject(SessionStore).user()?.full_name ?? '';
  protected readonly today = today();
  protected readonly categories = asTree(inject<readonly Category[]>(DIALOG_DATA))
    .filter((c) => c.is_active !== false)
    .map((c) => ({ id: c.id, label: c.parent == null ? c.name : `— ${c.name}` }));

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    category: this.fb.control<number | null>(null, Validators.required),
    doc_date: [today(), [Validators.required, notFuture]],
    note: [''],
  });
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected start(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    this.api
      .inventoryCountsCreate$Json({
        body: { category: v.category!, doc_date: v.doc_date, note: v.note },
      })
      .subscribe({
        next: (count) => this.ref.close(count),
        error: (error: unknown) => {
          const { form, fields } = readApiErrors(error);
          this.formErrors.set(form);
          this.fieldErrors.set(fields);
          this.busy.set(false);
        },
      });
  }
}
