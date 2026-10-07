// v1.0.0 — "Hold this sale": a label to find it again by. A held sale keeps
// no stock and takes no number until it is completed; any till can resume it.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-hold-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './hold-dialog.html',
})
export class HoldDialog {
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  /** The label the sale was held under before, when a resumed sale is held again. */
  protected readonly label = inject(NonNullableFormBuilder).control(
    inject<string>(DIALOG_DATA) ?? '',
    Validators.maxLength(60),
  );

  protected hold(): void {
    if (this.label.invalid) {
      this.label.markAsTouched();
      return;
    }
    this.ref.close(this.label.value.trim());
  }
}
