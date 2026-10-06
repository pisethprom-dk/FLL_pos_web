// v1.0.0 — what a screen shows when its data did not load: the server's words
// and a way to ask again.
import { Component, computed, input, output } from '@angular/core';
import { readApiErrors } from '../api-errors';

@Component({
  selector: 'app-load-error',
  templateUrl: './load-error.html',
})
export class LoadError {
  readonly error = input.required<unknown>();
  readonly retry = output<void>();

  protected readonly messages = computed(() => readApiErrors(this.error()).form);
}
