import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  isAuthenticated = false;
  userEmail: string | null = null;

  private authService = inject(AuthService);

  constructor() {
    this.authService.isAuthenticated$.subscribe((auth) => (this.isAuthenticated = auth));
    this.authService.userData$.subscribe((userData) => {
      this.userEmail = userData?.given_name || userData?.email || 'User';
    });
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
  }
  
}
