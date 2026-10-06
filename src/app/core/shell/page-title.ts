// v1.0.0 — each route's title goes to the browser tab and to the top bar.
import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const APP_NAME = 'POS back office';

@Injectable({ providedIn: 'root' })
export class PageTitle extends TitleStrategy {
  private readonly browserTitle = inject(Title);
  private readonly title = signal('');

  /** The current route's title, for the top bar. */
  readonly current = this.title.asReadonly();

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot) ?? '';
    this.title.set(title);
    this.browserTitle.setTitle(title ? `${title} · ${APP_NAME}` : APP_NAME);
  }
}
