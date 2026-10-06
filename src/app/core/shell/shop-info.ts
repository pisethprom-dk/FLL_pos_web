// v1.0.0 — what the shell shows about the shop: the profile (name, address)
// and today's exchange rate. Kept in one place so a save on the Profile or
// Exchange rate screen shows in the sidebar and top bar at once.
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { CompanyProfile } from '../../api/models/company-profile';
import { CurrentRate } from '../../api/models/current-rate';
import { CompanyService } from '../../api/services/company.service';

@Injectable({ providedIn: 'root' })
export class ShopInfo {
  private readonly api = inject(CompanyService);
  private readonly profileState = signal<CompanyProfile | null>(null);
  private readonly rateState = signal<CurrentRate | null>(null);

  readonly profile = this.profileState.asReadonly();
  readonly rate = this.rateState.asReadonly();

  /** Reads both from the server. A failure leaves what was there: the shell does without. */
  load(): void {
    this.api
      .companyProfileRetrieve()
      .pipe(catchError(() => of(null)))
      .subscribe((profile) => profile && this.profileState.set(profile));
    this.reloadRate();
  }

  /** After a rate is set or changed — it may be today's. */
  reloadRate(): void {
    this.api
      .companyRateRetrieve()
      .pipe(catchError(() => of(null)))
      .subscribe((rate) => rate && this.rateState.set(rate));
  }

  /** What the server returned from a profile save. */
  setProfile(profile: CompanyProfile): void {
    this.profileState.set(profile);
  }
}
