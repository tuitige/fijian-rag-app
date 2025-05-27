import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { VerificationReviewComponent } from './pages/verification-review/verification-review.component';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'verify',
    loadComponent: () => import('./pages/verification-review/verification-review.component').then(m => m.VerificationReviewComponent),
    canActivate: [AuthGuard]
  },
  { path: '**', redirectTo: '' }
];
