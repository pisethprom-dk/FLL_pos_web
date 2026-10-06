// v1.0.0 — shows its content only to a user holding one of the scopes:
//   <button *hasScope="'catalogue.edit'">Add product</button>
//   <a *hasScope="['report.sales.all', 'report.sales.own']">Daily sales</a>
// Scopes come from /api/auth/ (users/scopes.py in the backend). No role names.
import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { SessionStore } from './session-store';

@Directive({ selector: '[hasScope]' })
export class HasScope {
  private readonly session = inject(SessionStore);
  private readonly template = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);

  readonly hasScope = input.required<string | readonly string[]>();

  constructor() {
    effect(() => {
      const wanted = this.hasScope();
      const allowed = this.session.hasAnyScope(typeof wanted === 'string' ? [wanted] : wanted);
      if (allowed && this.container.length === 0) {
        this.container.createEmbeddedView(this.template);
      } else if (!allowed) {
        this.container.clear();
      }
    });
  }
}
