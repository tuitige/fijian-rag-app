import { Component } from '@angular/core';
//import { AuthenticatorService } from '@aws-amplify/ui-angular';
//import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';

import { OidcSecurityService } from 'angular-auth-oidc-client';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [ 
    RouterOutlet,
    CommonModule,
    HeaderComponent
  ]
})
export class AppComponent {
constructor(private oidcSecurityService: OidcSecurityService) {}

ngOnInit(): void {
  this.oidcSecurityService.checkAuth().subscribe(({ isAuthenticated, userData }) => {
    console.log('Auth state:', isAuthenticated, userData);
  });
}
}
