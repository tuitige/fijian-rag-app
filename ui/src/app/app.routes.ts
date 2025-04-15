import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { TrainingComponent } from './pages/training/training.component';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'training', component: TrainingComponent },
  { path: 'verify-module/:title', component: VerifyModuleComponent },
  { path: '**', redirectTo: '/home' }  // Catch-all route for 404s
];
