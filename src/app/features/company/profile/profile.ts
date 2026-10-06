// v1.0.0 — Company → Profile: the shop's details and how its receipts look.
// One record; each panel saves only its own fields, so an unsaved edit in one
// survives a save in the other.
import {
  Component,
  DestroyRef,
  WritableSignal,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { CompanyProfile } from '../../../api/models/company-profile';
import { ReceiptLanguageEnum } from '../../../api/models/receipt-language-enum';
import { ReceiptPaperWidthEnum } from '../../../api/models/receipt-paper-width-enum';
import { CompanyService } from '../../../api/services/company.service';
import { HasScope } from '../../../core/session/has-scope';
import { ShopInfo } from '../../../core/shell/shop-info';
import { readApiErrors } from '../../../shared/api-errors';
import { ImageChoice, ImageField, KEEP } from '../../../shared/image-field/image-field';
import { LoadError } from '../../../shared/load-error/load-error';
import { clearOnEdit, dropFieldError } from '../../../shared/server-errors';

type Panel = 'shop' | 'receipt';

interface PanelState {
  readonly busy: boolean;
  readonly saved: boolean;
  readonly form: string[];
}

const IDLE: PanelState = { busy: false, saved: false, form: [] };

/** Filling in the server's values is not the user changing them. */
const QUIET = { emitEvent: false };

@Component({
  selector: 'app-company-profile',
  imports: [ReactiveFormsModule, HasScope, ImageField, LoadError],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly api = inject(CompanyService);
  private readonly shopInfo = inject(ShopInfo);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly profile = rxResource({ stream: () => this.api.companyProfileRetrieve() });
  /** The record as last loaded or saved — what Cancel goes back to. */
  protected readonly current = signal<CompanyProfile | null>(null);

  protected readonly shop = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    name_kh: ['', Validators.maxLength(150)],
    address: ['', Validators.maxLength(250)],
    phone: ['', Validators.maxLength(30)],
    vat_tin: ['', Validators.maxLength(50)],
  });
  protected readonly logo = signal<ImageChoice>(KEEP);

  protected readonly receipt = this.fb.group({
    receipt_header: ['', Validators.maxLength(150)],
    receipt_footer: [''],
    receipt_paper_width: this.fb.control<ReceiptPaperWidthEnum>('80mm'),
    receipt_language: this.fb.control<ReceiptLanguageEnum>('EN'),
    receipt_show_riel_total: [true],
    receipt_show_rate_used: [true],
    receipt_show_seller: [false],
  });

  protected readonly paperWidths: readonly { value: ReceiptPaperWidthEnum; label: string }[] = [
    { value: '80mm', label: '80 mm' },
    { value: '58mm', label: '58 mm' },
    { value: 'A5', label: 'A5' },
  ];
  protected readonly languages: readonly { value: ReceiptLanguageEnum; label: string }[] = [
    { value: 'EN', label: 'English' },
    { value: 'KH', label: 'Khmer' },
    { value: 'BOTH', label: 'Both' },
  ];

  protected readonly state: Record<Panel, WritableSignal<PanelState>> = {
    shop: signal(IDLE),
    receipt: signal(IDLE),
  };
  /** The server's refusals, per field; each goes when its field is edited. */
  private readonly fieldErrors: Record<Panel, WritableSignal<Record<string, string[]>>> = {
    shop: signal({}),
    receipt: signal({}),
  };

  constructor() {
    // Each load fills both panels with what the server holds. Untracked, so the
    // panels' own state does not make this run again and undo a save.
    effect(() => {
      // value() throws while the resource is in error; hasValue() does not.
      if (!this.profile.hasValue()) return;
      const loaded = this.profile.value();
      untracked(() => {
        this.current.set(loaded);
        this.fillShop(loaded);
        this.fillReceipt(loaded);
      });
    });
    // "Saved." goes once the user changes something again.
    const destroyRef = inject(DestroyRef);
    this.shop.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.edited('shop'));
    this.receipt.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.edited('receipt'));
    clearOnEdit(this.shop.controls, this.fieldErrors.shop, destroyRef);
    clearOnEdit(this.receipt.controls, this.fieldErrors.receipt, destroyRef);
  }

  protected errorsFor(panel: Panel, field: string): string[] {
    return this.fieldErrors[panel]()[field] ?? [];
  }

  protected pickLogo(choice: ImageChoice): void {
    this.logo.set(choice);
    dropFieldError(this.fieldErrors.shop, 'logo');
    this.edited('shop');
  }

  protected saveShop(): void {
    if (this.shop.invalid) {
      this.shop.markAllAsTouched();
      return;
    }
    const body = this.shop.getRawValue();
    const logo = this.logo();
    // A file has to go as multipart; taking the logo away is a plain null.
    const request =
      logo.kind === 'replace'
        ? this.api.companyProfilePartialUpdate$FormData({ body: { ...body, logo: logo.file } })
        : this.api.companyProfilePartialUpdate$Json({
            body: logo.kind === 'remove' ? { ...body, logo: null } : body,
          });
    this.save('shop', request, (saved) => this.fillShop(saved));
  }

  protected saveReceipt(): void {
    if (this.receipt.invalid) {
      this.receipt.markAllAsTouched();
      return;
    }
    const request = this.api.companyProfilePartialUpdate$Json({ body: this.receipt.getRawValue() });
    this.save('receipt', request, (saved) => this.fillReceipt(saved));
  }

  protected cancelShop(): void {
    const current = this.current();
    if (current) this.fillShop(current);
    this.state.shop.set(IDLE);
    this.fieldErrors.shop.set({});
  }

  protected cancelReceipt(): void {
    const current = this.current();
    if (current) this.fillReceipt(current);
    this.state.receipt.set(IDLE);
    this.fieldErrors.receipt.set({});
  }

  private save(
    panel: Panel,
    request: Observable<CompanyProfile>,
    refill: (saved: CompanyProfile) => void,
  ): void {
    const state = this.state[panel];
    state.set({ ...IDLE, busy: true });
    this.fieldErrors[panel].set({});
    request.subscribe({
      next: (saved) => {
        this.current.set(saved);
        refill(saved);
        this.shopInfo.setProfile(saved);
        state.set({ ...IDLE, saved: true });
      },
      error: (error: unknown) => {
        const { form, fields } = readApiErrors(error);
        state.set({ ...IDLE, form });
        this.fieldErrors[panel].set(fields);
      },
    });
  }

  private edited(panel: Panel): void {
    const state = this.state[panel];
    if (state().saved) state.set({ ...state(), saved: false });
  }

  private fillShop(profile: CompanyProfile): void {
    this.shop.reset(
      {
        name: profile.name,
        name_kh: profile.name_kh ?? '',
        address: profile.address ?? '',
        phone: profile.phone ?? '',
        vat_tin: profile.vat_tin ?? '',
      },
      QUIET,
    );
    this.logo.set(KEEP);
  }

  private fillReceipt(profile: CompanyProfile): void {
    this.receipt.reset(
      {
        receipt_header: profile.receipt_header ?? '',
        receipt_footer: profile.receipt_footer ?? '',
        receipt_paper_width: profile.receipt_paper_width ?? '80mm',
        receipt_language: profile.receipt_language ?? 'EN',
        receipt_show_riel_total: profile.receipt_show_riel_total ?? true,
        receipt_show_rate_used: profile.receipt_show_rate_used ?? true,
        receipt_show_seller: profile.receipt_show_seller ?? false,
      },
      QUIET,
    );
  }
}
