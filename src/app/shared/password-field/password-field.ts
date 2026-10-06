// v1.0.0 — wraps a password <input>: a Show/Hide button inside its right
// edge, and a warning while Caps Lock is on.
//   <app-password-field><input type="password" formControlName="password" /></app-password-field>
import { Component, ElementRef, inject, signal } from '@angular/core';

@Component({
  selector: 'app-password-field',
  templateUrl: './password-field.html',
  host: {
    '(keydown)': 'readCapsLock($event)',
    '(keyup)': 'readCapsLock($event)',
    '(focusout)': 'capsLock.set(false)',
  },
})
export class PasswordField {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly shown = signal(false);
  protected readonly capsLock = signal(false);

  protected toggle(): void {
    const input = this.host.nativeElement.querySelector('input');
    if (!input) return;
    this.shown.update((shown) => !shown);
    input.type = this.shown() ? 'text' : 'password';
    input.focus();
  }

  protected readCapsLock(event: KeyboardEvent): void {
    // Some keys, and some synthetic events, carry no modifier state.
    if (typeof event.getModifierState === 'function') {
      this.capsLock.set(event.getModifierState('CapsLock'));
    }
  }
}
