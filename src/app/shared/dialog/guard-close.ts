// v1.0.0 — for a dialog that holds work not yet saved (a stock document's
// lines). Opened with `guarded: true`, Escape and the veil call the dialog's
// own close, which asks before throwing the work away.
import { DialogRef } from '@angular/cdk/dialog';
import { hasModifierKey } from '@angular/cdk/keycodes';
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, filter, merge } from 'rxjs';
import { confirm } from './confirm-dialog';
import { Modal } from './modal';

/** Runs `close` when the user presses Escape or clicks the veil. Call from a constructor. */
export function onDismiss<R>(
  ref: DialogRef<R>,
  close: () => void,
  destroyRef: DestroyRef = inject(DestroyRef),
): void {
  merge(
    ref.backdropClick,
    ref.keydownEvents.pipe(filter((e) => e.key === 'Escape' && !hasModifierKey(e))),
  )
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe((event) => {
      event.preventDefault();
      close();
    });
}

/** Asks before unsaved changes are lost; true means close anyway. */
export function confirmDiscard(modal: Modal): Observable<boolean | undefined> {
  return confirm(modal, {
    title: 'Close without saving?',
    message: 'The changes since this was last saved will be lost.',
    confirmLabel: 'Close without saving',
    danger: true,
  }).closed;
}
