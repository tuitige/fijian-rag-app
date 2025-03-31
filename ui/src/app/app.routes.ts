import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { TrainingComponent } from './pages/training/training.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'training', component: TrainingComponent }
];
