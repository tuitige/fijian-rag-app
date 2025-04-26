// src/app/app.routes.ts

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './pages/home/home.component';
import { TrainingComponent } from './pages/training/training.component';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';
import { PagesComponent } from './pages/pages/pages.component';
import { ArticleReviewComponent } from './pages/article-review/article-review.component';
import { ArticleListComponent } from './pages/article-list/article-list.component';
import { ModuleReviewComponent } from './pages/module-review/module-review.component';
import { ModuleListComponent } from './pages/module-list/module-list.component';
import { LearnComponent } from './pages/learn/learn.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'training', component: TrainingComponent },
  { path: 'learn', component: LearnComponent },
  { path: 'article-review', component: ArticleReviewComponent },
  { path: 'article-list', component: ArticleListComponent },
  { path: 'module-review', component: ModuleReviewComponent },
  { path: 'module-list', component: ModuleListComponent },
  { path: 'verify-module/:title', component: VerifyModuleComponent },
  { path: 'pages/:title', component: PagesComponent },
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
