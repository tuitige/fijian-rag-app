import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { TrainingComponent } from './pages/training/training.component';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';
import { PagesComponent } from './pages/pages/pages.component';
import { ArticleReviewComponent } from './pages/article-review/article-review.component';

export const routes: Routes = [
  { path: '', redirectTo: '/training', pathMatch: 'full' },
  { path: 'training', component: TrainingComponent },
  { path: 'article-review', component: ArticleReviewComponent },
  { path: 'verify-module/:title', component: VerifyModuleComponent },
  { path: 'pages/:title', component: PagesComponent },
  { path: '**', redirectTo: '/training' } // optional fallback
];