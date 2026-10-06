// v1.0.0 — "1–50 of 87" with Previous and Next, for a list the API pages.
import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pager',
  templateUrl: './pager.html',
})
export class Pager {
  /** Rows in the whole list, from the API's `count`. */
  readonly count = input.required<number>();
  readonly page = input.required<number>();
  /** The API's page size. */
  readonly size = input(50);
  readonly pageChange = output<number>();

  protected readonly first = computed(() =>
    this.count() === 0 ? 0 : (this.page() - 1) * this.size() + 1,
  );
  protected readonly last = computed(() => Math.min(this.page() * this.size(), this.count()));
}
