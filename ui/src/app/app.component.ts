import { Component } from '@angular/core';
import { AuthenticatorService } from '@aws-amplify/ui-angular';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [
    AmplifyAuthenticatorModule, 
    RouterOutlet,
    CommonModule,
    HeaderComponent
  ]
})
export class AppComponent {
  constructor(public authenticator: AuthenticatorService) {
    console.log('AppComponent initialized'); // Debug log
  }
}
