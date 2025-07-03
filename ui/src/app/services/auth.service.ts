// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  isAuthenticated$ = new BehaviorSubject<boolean>(false);
  userData$ = new BehaviorSubject<any>(null);

  constructor(private oidcSecurityService: OidcSecurityService) {
    this.oidcSecurityService.checkAuth().subscribe(({ isAuthenticated, userData }) => {
      this.isAuthenticated$.next(isAuthenticated);
      this.userData$.next(userData);
      console.log('✅ AuthService state:', isAuthenticated, userData);
    });
  }

  login(): void {
    this.oidcSecurityService.authorize();
  }

  logout(): void {
    this.oidcSecurityService.logoff();
  }

  async getAccessToken(): Promise<string | null> {
    const token = await this.oidcSecurityService.getAccessToken().toPromise();
    return token || null;
  }

  async getIdToken(): Promise<string | null> {
    const token = await this.oidcSecurityService.getIdToken().toPromise();
    return token || null;
  }
}
