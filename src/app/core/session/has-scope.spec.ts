// v1.0.0
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import { HasScope } from './has-scope';
import { SessionStore } from './session-store';
import { ADMIN, SELLER, signIn } from './session-testing';

@Component({
  imports: [HasScope],
  template: `
    <span *hasScope="'stock.view'">stock </span>
    <span *hasScope="['report.sales.all', 'report.sales.own']">daily </span>
    <span *hasScope="'sell'">sell</span>
  `,
})
class Host {}

describe('*hasScope', () => {
  let store: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
  });

  /** Renders the host and returns a reader for its text, after each change settles. */
  async function render(): Promise<() => Promise<string>> {
    const fixture = TestBed.createComponent(Host);
    return async () => {
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
    };
  }

  it('shows content only for a scope the user holds', async () => {
    signIn(store, http, SELLER);
    const text = await render();
    expect(await text()).toBe('daily sell');
  });

  it('follows the session as it changes', async () => {
    const text = await render();
    expect(await text()).toBe('');

    signIn(store, http, ADMIN);
    expect(await text()).toBe('stock daily sell');
  });
});
