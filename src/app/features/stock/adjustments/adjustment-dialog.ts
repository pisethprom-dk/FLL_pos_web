// v1.0.0 — one adjustment: any change in quantity that is not a purchase, a
// sale or a count. The reason fixes the direction, so a quantity is always
// typed above zero. Unit cost is the current average, stamped at posting —
// except on an opening balance, which types its own, and only for a product
// the ledger has never moved. The values shown on a draft are a preview at
// today's average; the posted document keeps the cost it was stamped with.
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Observable, of, switchMap, tap } from 'rxjs';
import { Adjustment } from '../../../api/models/adjustment';
import { AdjustmentRequest } from '../../../api/models/adjustment-request';
import { ProductLookup } from '../../../api/models/product-lookup';
import { ReasonEnum } from '../../../api/models/reason-enum';
import { CatalogueService } from '../../../api/services/catalogue.service';
import { InventoryService } from '../../../api/services/inventory.service';
import { PartnersService } from '../../../api/services/partners.service';
import { SessionStore } from '../../../core/session/session-store';
import { readApiErrors } from '../../../shared/api-errors';
import { today } from '../../../shared/dates';
import { confirm } from '../../../shared/dialog/confirm-dialog';
import { confirmDiscard, onDismiss } from '../../../shared/dialog/guard-close';
import { Modal } from '../../../shared/dialog/modal';
import { fetchAll } from '../../../shared/fetch-all';
import { plainDecimal } from '../../../shared/money/decimal';
import { negate, sum, times } from '../../../shared/money/exact';
import { QtyPipe, UsdPipe, formatMoney } from '../../../shared/money/money-pipes';
import { ProductPicker } from '../../../shared/product-picker/product-picker';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';
import { ImportDialog, ImportDialogData } from '../import-dialog/import-dialog';
import { reverseDialog } from '../reverse-dialog/reverse-dialog';
import {
  COST,
  DocResult,
  QTY,
  REASONS,
  canReverse,
  costPlaces,
  notFuture,
  positive,
  reasonOf,
} from '../stock-common';

export type AdjustmentResult = DocResult<Adjustment>;

type LineForm = FormGroup<{
  quantity: FormControl<string>;
  unit_cost: FormControl<string>;
}>;

interface LineRow {
  readonly key: number;
  readonly product: number;
  readonly code: string;
  readonly name: string;
  readonly shelf: string;
  /** On hand now — not what it will be when posted. */
  readonly onHand: string;
  /** The current average; null when this user may not see cost. */
  readonly avgCost: string | null;
  readonly form: LineForm;
}

const OPENING: ReasonEnum = 'OPENING_BALANCE';
const SHOWN = ['reason', 'doc_date', 'supplier', 'note', 'lines'];

@Component({
  selector: 'app-adjustment-dialog',
  imports: [DatePipe, ReactiveFormsModule, ProductPicker, QtyPipe, UsdPipe],
  templateUrl: './adjustment-dialog.html',
})
export class AdjustmentDialog {
  private readonly api = inject(InventoryService);
  private readonly partners = inject(PartnersService);
  private readonly catalogue = inject(CatalogueService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canPost = inject(SessionStore).hasAnyScope(['stock.post']);
  protected readonly ref = inject<DialogRef<AdjustmentResult>>(DialogRef);
  protected readonly reasons = REASONS;
  protected readonly costPlaces = costPlaces;
  protected readonly today = today();

  protected readonly doc = signal<Adjustment | null>(inject<Adjustment | null>(DIALOG_DATA));
  protected readonly editable = computed(() => this.canPost && this.doc()?.status !== 'POSTED');
  protected readonly reversible = computed(() => {
    const doc = this.doc();
    return this.canPost && doc !== null && canReverse(doc);
  });

  private readonly suppliers = rxResource({
    stream: () => fetchAll((page) => this.partners.partnersSuppliersList({ page, active: 'true' })),
  });
  protected readonly supplierOptions = computed(() => {
    const active = (this.suppliers.hasValue() ? this.suppliers.value() : []).map((s) => ({
      id: s.id,
      name: s.name,
    }));
    const doc = this.doc();
    if (!doc?.supplier || active.some((s) => s.id === doc.supplier)) return active;
    return [{ id: doc.supplier, name: `${doc.supplier_name} (inactive)` }, ...active];
  });

  protected readonly form = this.fb.group({
    reason: this.fb.control<ReasonEnum | null>(null, Validators.required),
    doc_date: [today(), [Validators.required, notFuture]],
    supplier: this.fb.control<number | null>(null, Validators.required),
    note: [''],
  });
  private readonly reasonValue = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: null,
  });
  protected readonly reason = computed(() => reasonOf(this.reasonValue()));
  protected readonly opening = computed(() => this.reasonValue() === OPENING);

  protected readonly rows = signal<LineRow[]>([]);
  private nextKey = 1;
  private linesChanged = false;
  private changed = false;

  protected readonly adding = signal(false);
  protected readonly busy = signal(false);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly fieldErrors = signal<Record<string, string[]>>({});
  protected readonly otherErrors = computed(() =>
    Object.entries(this.fieldErrors())
      .filter(([field]) => !SHOWN.includes(field))
      .flatMap(([, messages]) => messages),
  );

  constructor() {
    clearOnEdit(this.form.controls, this.fieldErrors);
    onDismiss(this.ref, () => this.close());
    this.form.controls.reason.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((reason) => this.applyReason(reason));
    this.load(this.doc());
  }

  protected errorsFor(field: string): string[] {
    return this.fieldErrors()[field] ?? [];
  }

  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  protected bad(control: FormControl<string>): boolean {
    return control.touched && control.invalid;
  }

  /** The value a line moves: below zero for stock going out. Null until it can be worked out. */
  protected value(row: LineRow): string | null {
    const reason = this.reason();
    const c = row.form.controls;
    if (!reason || c.quantity.invalid) return null;
    const cost = this.opening() ? (c.unit_cost.invalid ? null : c.unit_cost.value) : row.avgCost;
    if (!cost) return null;
    const value = times(c.quantity.value, cost, 2);
    return value && reason.direction === 'OUT' ? negate(value) : value;
  }

  protected total(): string | null {
    const values = this.rows().map((row) => this.value(row));
    return values.every((v) => v !== null) ? sum(values as string[], 2) : null;
  }

  /** Adds a line, reading the product's average cost and what is on hand now. */
  protected add(product: ProductLookup): void {
    const existing = this.rows().find((r) => r.product === product.id);
    if (existing) {
      this.focus(existing.key);
      return;
    }
    this.adding.set(true);
    this.catalogue.catalogueProductsRetrieve({ id: product.id }).subscribe({
      next: (full) => {
        this.adding.set(false);
        const row = this.makeRow({
          product: full.id,
          code: full.code,
          name: full.name,
          shelf: full.shelf_location ?? '',
          onHand: full.qty_on_hand,
          avgCost: full.avg_cost ?? null,
          quantity: '',
          unit_cost: '',
        });
        this.rows.update((rows) => [...rows, row]);
        this.linesChanged = true;
        dropFieldError(this.fieldErrors, 'lines');
        this.focus(row.key);
      },
      error: (error: unknown) => {
        this.adding.set(false);
        this.formErrors.set(readApiErrors(error).form);
      },
    });
  }

  protected remove(row: LineRow): void {
    this.rows.update((rows) => rows.filter((r) => r !== row));
    this.linesChanged = true;
    dropFieldError(this.fieldErrors, 'lines');
  }

  protected saveDraft(): void {
    if (this.busy() || !this.check()) return;
    this.run(this.persist(), () => this.ref.close('saved'));
  }

  protected post(): void {
    if (this.busy() || !this.check()) return;
    const count = this.rows().length;
    if (count === 0) {
      this.formErrors.set(['Add at least one line before posting.']);
      return;
    }
    const reason = this.reason()!;
    const effect =
      reason.value === OPENING
        ? 'The stock comes in at the costs typed.'
        : reason.direction === 'OUT'
          ? 'The stock goes out at the average cost at the moment of posting.'
          : 'The stock comes back in at the average cost at the moment of posting.';
    confirm(this.modal, {
      title: `Post ${this.doc()?.number ?? 'this adjustment'} to stock?`,
      message:
        `${reason.label}: ${count} ${count === 1 ? 'line' : 'lines'}, about ` +
        `${formatMoney(this.total(), '$', 2)}. ${effect} A posted adjustment cannot be ` +
        'changed — only reversed.',
      confirmLabel: 'Post to stock',
    }).closed.subscribe((yes) => {
      if (!yes) return;
      this.run(
        this.saved().pipe(
          switchMap((doc) => this.api.inventoryAdjustmentsPostCreate({ id: doc.id })),
        ),
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
        'The draft and its lines are removed; no stock had moved. Its number is not used again.',
      confirmLabel: 'Delete draft',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes) {
        this.run(this.api.inventoryAdjustmentsDestroy({ id: doc.id }), () =>
          this.ref.close('saved'),
        );
      }
    });
  }

  /** An import adds to a saved draft, so the draft is saved first. */
  protected importList(): void {
    if (this.busy() || !this.check()) return;
    this.run(this.saved(), (doc) => {
      this.modal
        .open<'imported', ImportDialogData, ImportDialog>(ImportDialog, {
          data: {
            kind: 'adjustment',
            id: doc.id,
            number: doc.number,
            needsCost: doc.reason === OPENING,
            hasLines: (doc.lines?.length ?? 0) > 0,
          },
          wide: true,
          labelledBy: 'import-title',
        })
        .closed.subscribe((result) => {
          if (!result) return;
          this.run(this.api.inventoryAdjustmentsRetrieve({ id: doc.id }), (fresh) => {
            this.changed = true;
            this.doc.set(fresh);
            this.load(fresh);
          });
        });
    });
  }

  protected reverse(): void {
    const doc = this.doc();
    if (!doc || this.busy()) return;
    const back =
      doc.direction === 'OUT'
        ? 'brings the stock it took out back in, at the cost it went out at'
        : 'takes the stock it brought in back out, with the value it came in at';
    reverseDialog<Adjustment>(this.modal, {
      number: doc.number,
      effect:
        `This posts a new adjustment that ${back}.` +
        (doc.direction === 'IN' ? ' It is refused if that stock has already gone out.' : ''),
      send: (note) =>
        this.api.inventoryAdjustmentsReverseCreate$Json({ id: doc.id, body: { note } }),
    }).closed.subscribe((reversal) => {
      if (reversal) this.ref.close({ open: reversal });
    });
  }

  protected close(): void {
    if (this.busy()) return;
    const result = this.changed ? 'saved' : undefined;
    if (!this.editable() || !this.unsaved()) {
      this.ref.close(result);
      return;
    }
    confirmDiscard(this.modal).subscribe((yes) => {
      if (yes) this.ref.close(result);
    });
  }

  /** A supplier only for a return or a replacement; a typed cost only for an opening balance. */
  private applyReason(value: ReasonEnum | null): void {
    if (!this.editable()) return;
    const supplier = this.form.controls.supplier;
    if (reasonOf(value)?.supplier) {
      supplier.enable({ emitEvent: false });
    } else {
      supplier.setValue(null, { emitEvent: false });
      supplier.disable({ emitEvent: false });
    }
    for (const row of this.rows()) this.applyCost(row.form, value === OPENING);
  }

  private applyCost(form: LineForm, opening: boolean): void {
    const cost = form.controls.unit_cost;
    if (opening) {
      cost.enable({ emitEvent: false });
    } else {
      cost.setValue('', { emitEvent: false });
      cost.disable({ emitEvent: false });
    }
  }

  private load(doc: Adjustment | null): void {
    this.form.reset({
      reason: doc?.reason ?? null,
      doc_date: doc?.doc_date ?? today(),
      supplier: doc?.supplier ?? null,
      note: doc?.note ?? '',
    });
    this.rows.set(
      (doc?.lines ?? []).map((line) =>
        this.makeRow({
          product: line.product,
          code: line.product_code,
          name: line.product_name,
          shelf: line.shelf_location,
          onHand: line.on_hand,
          avgCost: line.current_avg_cost,
          quantity: plainDecimal(line.quantity),
          unit_cost: line.unit_cost ? plainDecimal(line.unit_cost) : '',
        }),
      ),
    );
    this.linesChanged = false;
    if (this.editable()) this.applyReason(this.form.controls.reason.value);
    else this.form.disable({ emitEvent: false });
  }

  private makeRow(start: {
    product: number;
    code: string;
    name: string;
    shelf: string;
    onHand: string;
    avgCost: string | null;
    quantity: string;
    unit_cost: string;
  }): LineRow {
    const form: LineForm = this.fb.group({
      quantity: [start.quantity, positive(QTY)],
      unit_cost: [start.unit_cost, positive(COST)],
    });
    this.applyCost(form, this.form.controls.reason.value === OPENING);
    if (!this.editable()) form.disable({ emitEvent: false });
    return {
      key: this.nextKey++,
      product: start.product,
      code: start.code,
      name: start.name,
      shelf: start.shelf,
      onHand: start.onHand,
      avgCost: start.avgCost,
      form,
    };
  }

  private focus(key: number): void {
    afterNextRender(() => document.getElementById(`qty-${key}`)?.focus(), {
      injector: this.injector,
    });
  }

  private unsaved(): boolean {
    return this.form.dirty || this.linesChanged || this.rows().some((r) => r.form.dirty);
  }

  private check(): boolean {
    if (!this.form.invalid && !this.rows().some((r) => r.form.invalid)) return true;
    this.form.markAllAsTouched();
    for (const row of this.rows()) row.form.markAllAsTouched();
    return false;
  }

  private body(): AdjustmentRequest {
    const v = this.form.getRawValue();
    const opening = v.reason === OPENING;
    return {
      reason: v.reason!,
      doc_date: v.doc_date,
      supplier: reasonOf(v.reason)?.supplier ? v.supplier : null,
      note: v.note,
      lines: this.rows().map((row) => ({
        product: row.product,
        quantity: row.form.controls.quantity.value,
        unit_cost: opening ? row.form.controls.unit_cost.value : null,
      })),
    };
  }

  private persist(): Observable<Adjustment> {
    const doc = this.doc();
    const request = doc
      ? this.api.inventoryAdjustmentsPartialUpdate$Json({ id: doc.id, body: this.body() })
      : this.api.inventoryAdjustmentsCreate$Json({ body: this.body() });
    return request.pipe(
      tap((saved) => {
        this.changed = true;
        this.doc.set(saved);
        this.load(saved);
      }),
    );
  }

  private saved(): Observable<Adjustment> {
    const doc = this.doc();
    return doc && !this.unsaved() ? of(doc) : this.persist();
  }

  private run<T>(request: Observable<T>, done: (result: T) => void): void {
    this.busy.set(true);
    this.formErrors.set([]);
    this.fieldErrors.set({});
    request.subscribe({
      next: (result) => {
        this.busy.set(false);
        done(result);
      },
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        this.formErrors.set(form);
        this.fieldErrors.set(fields);
        this.busy.set(false);
      },
    });
  }
}
