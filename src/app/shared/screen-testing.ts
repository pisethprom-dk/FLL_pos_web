// v1.0.0 — for specs that open a real screen: the app's providers and routes,
// a way to open a screen with its calls answered, and small DOM helpers.
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../core/session/auth-interceptor';
import { answer, answerShell } from '../core/session/session-testing';
import { PageTitle } from '../core/shell/page-title';

export const APP_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideHttpClient(withInterceptors([authInterceptor])),
  provideHttpClientTesting(),
  provideRouter(routes),
  { provide: TitleStrategy, useExisting: PageTitle },
];

export interface Answer {
  readonly url: string;
  readonly body: object | null;
  /** How many calls to wait for — two when the shell asks for the same thing. */
  readonly count?: number;
}

/** Opens `url` in the shell, answers the screen's calls, then the shell's. */
export async function openScreen(
  http: HttpTestingController,
  url: string,
  answers: readonly Answer[],
): Promise<RouterTestingHarness> {
  const created = RouterTestingHarness.create(url);
  for (const a of answers) await answer(http, a.url, a.body, { count: a.count });
  const harness = await created;
  answerShell(http);
  await harness.fixture.whenStable();
  return harness;
}

/** The dialog on top. CDK puts dialogs at the end of the page, not inside the screen. */
export function dialog(): HTMLElement {
  const cards = document.querySelectorAll<HTMLElement>('.modal-card');
  const top = cards[cards.length - 1];
  if (!top) throw new Error('No dialog is open');
  return top;
}

export function dialogCount(): number {
  return document.querySelectorAll('.modal-card').length;
}

export function find<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  return element;
}

export function type(root: ParentNode, selector: string, value: string): void {
  const input = find<HTMLInputElement | HTMLTextAreaElement>(root, selector);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

export function choose(root: ParentNode, selector: string, value: string): void {
  const select = find<HTMLSelectElement>(root, selector);
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

/** Clicks the button (or link) whose text is `text`. */
export function press(root: ParentNode, text: string, selector = 'button'): void {
  const target = Array.from(root.querySelectorAll<HTMLElement>(selector)).find(
    (el) => el.textContent!.trim() === text,
  );
  if (!target) throw new Error(`No ${selector} reads "${text}"`);
  target.click();
}

/** Puts `file` in a file input, as the browser's picker would. */
export function pickFile(root: ParentNode, selector: string, file: File): void {
  const input = find<HTMLInputElement>(root, selector);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

export function texts(root: ParentNode, selector: string): string[] {
  return Array.from(root.querySelectorAll(selector), (el) =>
    el.textContent!.replace(/\s+/g, ' ').trim(),
  );
}
