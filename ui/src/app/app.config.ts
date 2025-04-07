import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApiService } from './services/api.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withFetch()),
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideAnimations(),
    ApiService
  ]
};