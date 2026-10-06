// v1.0.0 — an image on a form: shows the one saved now, and lets the user pick
// a replacement or remove it. Nothing is sent from here; the form reads
// `choice` and sends the file, a null, or nothing.
import { Component, ElementRef, effect, input, model, viewChild } from '@angular/core';

export type ImageChoice =
  | { readonly kind: 'keep' }
  | { readonly kind: 'replace'; readonly file: File }
  | { readonly kind: 'remove' };

export const KEEP: ImageChoice = { kind: 'keep' };

@Component({
  selector: 'app-image-field',
  templateUrl: './image-field.html',
})
export class ImageField {
  /** For the label's `for`. */
  readonly inputId = input.required<string>();
  /** The URL of the image saved now, if there is one. */
  readonly current = input<string | null | undefined>(null);
  readonly choice = model<ImageChoice>(KEEP);

  private readonly file = viewChild<ElementRef<HTMLInputElement>>('file');

  constructor() {
    // The form resetting to KEEP (Cancel, or a different record) clears the picked file too.
    effect(() => {
      const input = this.file()?.nativeElement;
      if (input && this.choice().kind !== 'replace') input.value = '';
    });
  }

  protected pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.choice.set(file ? { kind: 'replace', file } : KEEP);
  }

  protected remove(): void {
    this.choice.set({ kind: 'remove' });
  }

  protected undo(): void {
    this.choice.set(KEEP);
  }
}
