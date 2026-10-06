// v1.1.0 — the frame of the sign-in and change-password pages: design A,
// "Workbench" (agreed 2026-10-05). The shop on the dark pegboard panel, the
// form on paper. The shop comes from the public /api/company/brand/, so it
// shows before anyone signs in.
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CompanyService } from '../../api/services/company.service';

@Component({
  selector: 'app-auth-frame',
  templateUrl: './auth-frame.html',
  host: { class: 'signin' },
})
export class AuthFrame {
  private readonly api = inject(CompanyService);

  private readonly brand = rxResource({ stream: () => this.api.companyBrandRetrieve() });
  // value() throws while the resource is in error; hasValue() does not.
  protected readonly shop = computed(() => (this.brand.hasValue() ? this.brand.value() : null));
  /** No shop to show: the page names the app instead. */
  protected readonly unknown = computed(() => this.brand.error() !== undefined);
}
