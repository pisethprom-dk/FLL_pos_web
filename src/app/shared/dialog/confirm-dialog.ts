// v1.0.0 — "are you sure?" for anything that cannot be undone. Closes with
// true when confirmed; Cancel, Escape and the veil all close it with nothing.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { Modal } from './modal';

export interface ConfirmData {
  readonly title: string;
  readonly message: string;
  /** The button that goes ahead, e.g. "Delete note". */
  readonly confirmLabel: string;
  /** Styles the button as a warning. */
  readonly danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}

/** Opens the confirm dialog; the result is true only when confirmed. */
export function confirm(modal: Modal, data: ConfirmData): DialogRef<boolean, ConfirmDialog> {
  return modal.open<boolean, ConfirmData, ConfirmDialog>(ConfirmDialog, {
    data,
    labelledBy: 'confirm-title',
  });
}
