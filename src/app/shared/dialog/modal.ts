// v1.2.0 — opens a CDK dialog dressed as the mockup's modal card: top of the
// screen, 580px wide (780px when wide, 1040px for a stock document), on the dark veil. A dialog component
// renders .modal-head, .form and .form-foot itself, and gets its input through
// DIALOG_DATA and closes through DialogRef.
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { Injectable, Injector, inject } from '@angular/core';

export interface ModalOptions<D> {
  readonly data?: D;
  readonly wide?: boolean;
  /**
   * Wider still, for a document whose lines have several inputs each (a
   * stock-in's nine columns do not fit the mockup's 780px).
   */
  readonly document?: boolean;
  /** The id of the dialog's own heading, which names it for screen readers. */
  readonly labelledBy?: string;
  /**
   * Escape and the veil no longer close it on their own; the dialog decides,
   * through onDismiss() in guard-close.ts — e.g. to ask about unsaved lines.
   */
  readonly guarded?: boolean;
}

@Injectable({ providedIn: 'root' })
export class Modal {
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);

  open<R, D = unknown, C = unknown>(
    component: ComponentType<C>,
    options: ModalOptions<D> = {},
  ): DialogRef<R, C> {
    const width = options.document ? 1040 : options.wide ? 780 : 580;
    return this.dialog.open<R, D, C>(component, {
      data: options.data,
      ariaLabelledBy: options.labelledBy,
      panelClass: options.wide || options.document ? ['modal-card', 'wide'] : 'modal-card',
      backdropClass: 'modal-veil',
      width: '100%',
      maxWidth: `min(${width}px, calc(100vw - 32px))`,
      maxHeight: 'calc(100vh - 88px)',
      positionStrategy: createGlobalPositionStrategy(this.injector)
        .centerHorizontally()
        .top('44px'),
      // The first field marked cdkFocusInitial, or else the first thing that takes focus.
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      disableClose: options.guarded ?? false,
    });
  }
}
