// v1.0.0
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/session/auth-interceptor';
import { SessionStore } from './core/session/session-store';
import { PageTitle } from './core/shell/page-title';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: PageTitle },
    // Before the first screen: a live refresh cookie signs the user back in.
    provideAppInitializer(() => inject(SessionStore).restore()),
  ],
};
