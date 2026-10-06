// v1.0.0 — the server's refusal about a field stays only until the user edits
// that field; after that it would describe a value no longer there.
import { DestroyRef, WritableSignal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';

/** Drops `field` from `errors`, if it is there. */
export function dropFieldError(
  errors: WritableSignal<Record<string, string[]>>,
  field: string,
): void {
  if (!(field in errors())) return;
  const rest = { ...errors() };
  delete rest[field];
  errors.set(rest);
}

/**
 * Wires every control in `controls` to drop its own server error when edited.
 * Call from a constructor (or pass a DestroyRef).
 */
export function clearOnEdit(
  controls: Record<string, AbstractControl>,
  errors: WritableSignal<Record<string, string[]>>,
  destroyRef: DestroyRef = inject(DestroyRef),
): void {
  for (const [field, control] of Object.entries(controls)) {
    control.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => dropFieldError(errors, field));
  }
}
