// v1.1.0 — one stock-in (GRN). A draft is filled in and posted here; a posted
// one is read, and reversed if it was wrong. Each new line starts with the
// supplier's usual pack (Partners → Supplier products). The figures on a line
// are a preview worked out exactly as the server will (shared/money/exact.ts),
// and the server's own replace them once saved (owner's choice, 2026-10-05).
// A new stock-in is created on its first save, which takes its number, so a
// dialog opened and cancelled leaves no gap in the sequence.
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
import { ProductLookup } from '../../../api/models/product-lookup';
import { StockIn } from '../../../api/models/stock-in';
import { StockInRequest } from '../../../api/models/stock-in-request';
import { Unit } from '../../../api/models/unit';
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
import { over, sum, times } from '../../../shared/money/exact';
import { QtyPipe, UsdPipe, formatMoney } from '../../../shared/money/money-pipes';
import { ProductPicker } from '../../../shared/product-picker/product-picker';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';
import { ImportDialog, ImportDialogData } from '../import-dialog/import-dialog';
import { reverseDialog } from '../reverse-dialog/reverse-dialog';
import {
  COST,
  DocResult,
  QTY,
  brandAndCategory,
  canReverse,
  costPlaces,
  notFuture,
  positive,
} from '../stock-common';

export type StockInResult = DocResult<StockIn>;

type LineForm = FormGroup<{
  pack_unit: FormControl<number | null>;
  packs: FormControl<string>;
  pack_size: FormControl<string>;
  pack_cost: FormControl<string>;
}>;

interface LineRow {
  readonly key: number;
  readonly product: number;
  readonly code: string;
  readonly name: string;
  /** "Makita · Drills", under the code. */
  readonly brandCategory: string;
  /** The product's own unit — what its stock is counted in. */
  readonly unit: string;
  readonly form: LineForm;
}

interface LineStart {
  readonly product: number;
  readonly code: string;
  readonly name: string;
  readonly brandCategory: string;
  readonly unit: string;
  readonly pack_unit: number | null;
  readonly packs: string;
  readonly pack_size: string;
  readonly pack_cost: string;
}

/** What a line comes to; null while what it needs is missing or not a number. */
interface LinePreview {
  readonly into: string | null;
  readonly unitCost: string | null;
  readonly total: string | null;
}

/** Field errors shown beside their field; any other goes with the form's. */
const SHOWN = ['supplier', 'doc_date', 'supplier_ref', 'note', 'lines'];

@Component({
  selector: 'app-stock-in-dialog',
  imports: [DatePipe, ReactiveFormsModule, ProductPicker, QtyPipe, UsdPipe],
  templateUrl: './stock-in-dialog.html',
})
export class StockInDialog {
  private readonly api = inject(InventoryService);
  private readonly partners = inject(PartnersService);
  private readonly catalogue = inject(CatalogueService);
  private readonly modal = inject(Modal);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canPost = inject(SessionStore).hasAnyScope(['stock.post']);
  protected readonly ref = inject<DialogRef<StockInResult>>(DialogRef);
  protected readonly costPlaces = costPlaces;
  protected readonly brandAndCategory = brandAndCategory;
  protected readonly today = today();

  protected readonly doc = signal<StockIn | null>(inject<StockIn | null>(DIALOG_DATA));
  protected readonly editable = computed(() => this.canPost && this.doc()?.status !== 'POSTED');
  protected readonly reversible = computed(() => {
    const doc = this.doc();
    return this.canPost && doc !== null && canReverse(doc);
  });

  private readonly suppliers = rxResource({
    stream: () => fetchAll((page) => this.partners.partnersSuppliersList({ page, active: 'true' })),
  });
  /** Active suppliers; a draft's own supplier stays listed if it has since been retired. */
  protected readonly supplierOptions = computed(() => {
    const active = (this.suppliers.hasValue() ? this.suppliers.value() : []).map((s) => ({
      id: s.id,
      name: s.name,
    }));
    const doc = this.doc();
    if (!doc || active.some((s) => s.id === doc.supplier)) return active;
    return [{ id: doc.supplier, name: `${doc.supplier_name} (inactive)` }, ...active];
  });
  private readonly units = rxResource({
    stream: () => fetchAll((page) => this.catalogue.catalogueUnitsList({ page })),
  });

  protected readonly form = this.fb.group({
    supplier: this.fb.control<number | null>(null, Validators.required),
    doc_date: [today(), [Validators.required, notFuture]],
    supplier_ref: ['', Validators.maxLength(50)],
    note: [''],
  });
  protected readonly rows = signal<LineRow[]>([]);
  private nextKey = 1;
  /** A line added or removed since the last save. */
  private linesChanged = false;
  /** Something was saved, posted or deleted: the list reloads when this closes. */
  private changed = false;

  private readonly supplierId = toSignal(this.form.controls.supplier.valueChanges, {
    initialValue: null,
  });
  /** The chosen supplier's links: their usual pack for each product they carry. */
  private readonly links = rxResource({
    params: () => (this.editable() ? (this.supplierId() ?? undefined) : undefined),
    stream: ({ params: supplier }) =>
      fetchAll((page) => this.partners.partnersProductSuppliersList({ supplier, page })),
  });
  protected readonly pickerHint = computed(() => {
    if (this.supplierId() == null)
      return 'Choose the supplier first — their usual packs fill the lines in.';
    if (this.links.isLoading()) return 'Loading their usual packs…';
    return '';
  });

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

  /** What a pack can be bought as: any unit but the product's own, which is the first choice. */
  protected packUnits(row: LineRow): readonly Unit[] {
    const chosen = row.form.controls.pack_unit.value;
    return (this.units.hasValue() ? this.units.value() : []).filter(
      (u) => u.name !== row.unit && (u.is_active !== false || u.id === chosen),
    );
  }

  protected preview(row: LineRow): LinePreview {
    const c = row.form.controls;
    const packs = c.packs.invalid ? null : c.packs.value;
    const size = c.pack_size.invalid ? null : c.pack_size.value;
    const cost = c.pack_cost.invalid ? null : c.pack_cost.value;
    return {
      into: packs && size ? times(packs, size, 2) : null,
      unitCost: cost && size ? over(cost, size, 4) : null,
      total: packs && cost ? times(packs, cost, 2) : null,
    };
  }

  /** The footer: units into stock and the document's total, once every line has its figures. */
  protected totals(): { units: string | null; total: string | null } {
    const previews = this.rows().map((row) => this.preview(row));
    const add = (values: (string | null)[]) =>
      values.every((v) => v !== null) ? sum(values as string[], 2) : null;
    return {
      units: add(previews.map((p) => p.into)),
      total: add(previews.map((p) => p.total)),
    };
  }

  protected add(product: ProductLookup): void {
    const existing = this.rows().find((r) => r.product === product.id);
    if (existing) {
      this.focus(existing.key);
      return;
    }
    const link = this.links.hasValue()
      ? this.links.value().find((l) => l.product === product.id)
      : undefined;
    const row = this.makeRow({
      product: product.id,
      code: product.code,
      name: product.name,
      brandCategory: brandAndCategory(product),
      unit: product.unit_name,
      pack_unit: link?.pack_unit ?? null,
      packs: '',
      pack_size: plainDecimal(link?.pack_size ?? '1'),
      pack_cost: '',
    });
    this.rows.update((rows) => [...rows, row]);
    this.linesChanged = true;
    dropFieldError(this.fieldErrors, 'lines');
    this.focus(row.key);
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
    confirm(this.modal, {
      title: `Post ${this.doc()?.number ?? 'this stock-in'} to stock?`,
      message:
        `${count} ${count === 1 ? 'line' : 'lines'}, ${formatMoney(this.totals().total, '$', 2)}. ` +
        'The goods go into stock and average cost is updated. A posted stock-in cannot be ' +
        'changed — only reversed.',
      confirmLabel: 'Post to stock',
    }).closed.subscribe((yes) => {
      if (!yes) return;
      this.run(
        this.saved().pipe(switchMap((doc) => this.api.inventoryStockInsPostCreate({ id: doc.id }))),
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
        'The draft and its lines are removed; nothing had entered stock. Its number is not ' +
        'used again.',
      confirmLabel: 'Delete draft',
      danger: true,
    }).closed.subscribe((yes) => {
      if (yes)
        this.run(this.api.inventoryStockInsDestroy({ id: doc.id }), () => this.ref.close('saved'));
    });
  }

  /** An import adds to a saved draft, so the draft is saved first. */
  protected importList(): void {
    if (this.busy() || !this.check()) return;
    this.run(this.saved(), (doc) => {
      this.modal
        .open<'imported', ImportDialogData, ImportDialog>(ImportDialog, {
          data: {
            kind: 'stock-in',
            id: doc.id,
            number: doc.number,
            needsCost: true,
            hasLines: (doc.lines?.length ?? 0) > 0,
          },
          wide: true,
          labelledBy: 'import-title',
        })
        .closed.subscribe((result) => {
          if (!result) return;
          this.run(this.api.inventoryStockInsRetrieve({ id: doc.id }), (fresh) => {
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
    const count = doc.lines?.length ?? 0;
    reverseDialog<StockIn>(this.modal, {
      number: doc.number,
      effect:
        `This posts a new stock-in that takes the ${count} ${count === 1 ? 'line' : 'lines'} ` +
        `of ${doc.number} back out of stock, at the cost they came in at. It is refused if ` +
        'any of the goods have already gone out.',
      send: (note) => this.api.inventoryStockInsReverseCreate$Json({ id: doc.id, body: { note } }),
    }).closed.subscribe((reversal) => {
      if (reversal) this.ref.close({ open: reversal });
    });
  }

  /** The ×, Escape and the veil all come here: unsaved lines are not lost without asking. */
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

  private load(doc: StockIn | null): void {
    this.form.reset({
      supplier: doc?.supplier ?? null,
      doc_date: doc?.doc_date ?? today(),
      supplier_ref: doc?.supplier_ref ?? '',
      note: doc?.note ?? '',
    });
    if (!this.editable()) this.form.disable({ emitEvent: false });
    this.rows.set(
      (doc?.lines ?? []).map((line) =>
        this.makeRow({
          product: line.product,
          code: line.product_code,
          name: line.product_name,
          brandCategory: brandAndCategory(line),
          unit: line.unit_name,
          pack_unit: line.pack_unit ?? null,
          packs: plainDecimal(line.packs),
          pack_size: plainDecimal(line.pack_size ?? '1'),
          pack_cost: plainDecimal(line.pack_cost),
        }),
      ),
    );
    this.linesChanged = false;
  }

  private makeRow(start: LineStart): LineRow {
    const form: LineForm = this.fb.group({
      pack_unit: this.fb.control<number | null>(start.pack_unit),
      packs: [start.packs, positive(QTY)],
      pack_size: [start.pack_size, positive(QTY)],
      pack_cost: [start.pack_cost, positive(COST)],
    });
    // Bought in the product's own unit means a pack of one. A line saved
    // otherwise (an import can give a size without a unit) is left as it is.
    const size = form.controls.pack_size;
    if (start.pack_unit === null && start.pack_size === '1') size.disable({ emitEvent: false });
    form.controls.pack_unit.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unit) => {
        if (unit === null) {
          size.setValue('1');
          size.disable();
        } else {
          size.enable();
        }
      });
    return {
      key: this.nextKey++,
      product: start.product,
      code: start.code,
      name: start.name,
      brandCategory: start.brandCategory,
      unit: start.unit,
      form,
    };
  }

  private focus(key: number): void {
    afterNextRender(() => document.getElementById(`packs-${key}`)?.focus(), {
      injector: this.injector,
    });
  }

  private unsaved(): boolean {
    return this.form.dirty || this.linesChanged || this.rows().some((r) => r.form.dirty);
  }

  /** True when the header and every line are fit to send; otherwise marks what is not. */
  private check(): boolean {
    if (!this.form.invalid && !this.rows().some((r) => r.form.invalid)) return true;
    this.form.markAllAsTouched();
    for (const row of this.rows()) row.form.markAllAsTouched();
    return false;
  }

  private body(): StockInRequest {
    const v = this.form.getRawValue();
    return {
      supplier: v.supplier!,
      doc_date: v.doc_date,
      supplier_ref: v.supplier_ref.trim(),
      note: v.note,
      lines: this.rows().map((row) => ({ product: row.product, ...row.form.getRawValue() })),
    };
  }

  /** Saves the draft — creating it on the first save — and shows the server's figures. */
  private persist(): Observable<StockIn> {
    const doc = this.doc();
    const request = doc
      ? this.api.inventoryStockInsPartialUpdate$Json({ id: doc.id, body: this.body() })
      : this.api.inventoryStockInsCreate$Json({ body: this.body() });
    return request.pipe(
      tap((saved) => {
        this.changed = true;
        this.doc.set(saved);
        this.load(saved);
      }),
    );
  }

  /** The draft as saved, saving it first if anything changed. */
  private saved(): Observable<StockIn> {
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
