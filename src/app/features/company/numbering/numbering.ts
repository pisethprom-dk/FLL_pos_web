// v1.0.0 — Company → Rules & numbering: the prefix in front of quotation and
// invoice numbers. The backend keeps counters for other documents and partner
// codes too; this screen shows only these two (owner's choice). The number
// itself is the system's and is never typed.
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { DocTypeEnum } from '../../../api/models/doc-type-enum';
import { DocumentCounter } from '../../../api/models/document-counter';
import { CompanyService } from '../../../api/services/company.service';
import { HasScope } from '../../../core/session/has-scope';
import { readApiErrors } from '../../../shared/api-errors';
import { LoadError } from '../../../shared/load-error/load-error';
import { clearOnEdit } from '../../../shared/server-errors';

type Shown = Extract<DocTypeEnum, 'QUOTATION' | 'INVOICE'>;

const SHOWN: readonly { type: Shown; label: string }[] = [
  { type: 'QUOTATION', label: 'Quotation prefix' },
  { type: 'INVOICE', label: 'Invoice prefix' },
];

const PREFIX = [Validators.required, Validators.maxLength(10)];

@Component({
  selector: 'app-numbering',
  imports: [ReactiveFormsModule, HasScope, LoadError],
  templateUrl: './numbering.html',
})
export class Numbering {
  private readonly api = inject(CompanyService);

  protected readonly counters = rxResource({ stream: () => this.api.companyNumberingList() });
  protected readonly rows = computed(() => {
    // value() throws while the resource is in error; hasValue() does not.
    const all = this.counters.hasValue() ? this.counters.value().results : [];
    return SHOWN.flatMap(({ type, label }) => {
      const counter = all.find((c) => c.doc_type === type);
      return counter ? [{ type, label, counter }] : [];
    });
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    QUOTATION: ['', PREFIX],
    INVOICE: ['', PREFIX],
  });
  protected readonly busy = signal(false);
  protected readonly saved = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  /** The server's refusals, per document type; each goes when its prefix is edited. */
  protected readonly fieldErrors = signal<Record<string, string[]>>({});

  constructor() {
    // Each load fills the form — unless the user has typed something not yet saved.
    effect(() => {
      const rows = this.rows();
      untracked(() => {
        if (!this.form.dirty) this.fill(rows.map((row) => row.counter));
      });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.saved.set(false));
    clearOnEdit(this.form.controls, this.fieldErrors);
  }

  /** The next number as it will print with the prefix typed now. */
  protected preview(type: Shown, counter: DocumentCounter): string {
    const number = counter.next_value.slice(counter.prefix.length);
    return this.form.controls[type].value + number;
  }

  protected errorsFor(type: Shown): string[] {
    return this.fieldErrors()[type] ?? [];
  }

  protected save(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const changed = this.rows().filter(
      ({ type, counter }) => this.form.controls[type].value !== counter.prefix,
    );
    if (changed.length === 0) {
      this.saved.set(true);
      return;
    }
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    // Each prefix is its own row: one failing leaves the others saved.
    forkJoin(
      changed.map(({ type, counter }) =>
        this.api
          .companyNumberingPartialUpdate$Json({
            id: counter.id,
            body: { prefix: this.form.controls[type].value },
          })
          .pipe(
            map((saved) => ({ type, saved, error: null })),
            catchError((error: unknown) => of({ type, saved: null, error })),
          ),
      ),
    ).subscribe((results) => {
      this.busy.set(false);
      const failed = results.filter((r) => r.error !== null);
      const savedCounters = results.flatMap((r) => (r.saved ? [r.saved] : []));
      this.counters.update((page) =>
        page
          ? {
              ...page,
              results: page.results.map((c) => savedCounters.find((s) => s.id === c.id) ?? c),
            }
          : page,
      );
      if (failed.length === 0) {
        this.form.markAsPristine();
        this.saved.set(true);
        return;
      }
      const fields: Record<string, string[]> = {};
      for (const { type, error } of failed) {
        const { form, fields: byField } = readApiErrors(error);
        fields[type] = [...(byField['prefix'] ?? []), ...form];
      }
      this.fieldErrors.set(fields);
    });
  }

  protected cancel(): void {
    this.form.markAsPristine();
    this.fill(this.rows().map((row) => row.counter));
    this.fieldErrors.set({});
    this.formErrors.set([]);
  }

  private fill(counters: readonly DocumentCounter[]): void {
    const values: Partial<Record<Shown, string>> = {};
    for (const counter of counters) values[counter.doc_type as Shown] = counter.prefix;
    // Quietly: filling in the server's values is not the user changing them.
    this.form.reset({ ...this.form.getRawValue(), ...values }, { emitEvent: false });
  }
}
