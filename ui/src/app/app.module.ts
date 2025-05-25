// src/app/app.module.ts

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';

import { HomeComponent } from './pages/home/home.component';
import { PagesComponent } from './pages/pages/pages.component';
import { ArticleReviewComponent } from './pages/article-review/article-review.component';
import { TrainingComponent } from './pages/training/training.component';
import { ModuleListComponent } from './pages/module-list/module-list.component';
import { LearnComponent } from './pages/learn/learn.component';
import { ArticleListComponent } from './pages/article-list/article-list.component';
import { ModuleReviewComponent } from './pages/module-review/module-review.component';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';

import { VerificationReviewComponent } from './pages/verification-review/verification-review.component';


import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';



@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    PagesComponent,
    ArticleReviewComponent,
    TrainingComponent,
    ModuleListComponent,
    LearnComponent,
    ArticleListComponent,
    ModuleReviewComponent,
    VerifyModuleComponent,
    VerificationReviewComponent
  ],
  imports: [
    FormsModule,
    HttpClientModule,
    MatTabsModule,
    MatTableModule,
    MatInputModule,
    MatButtonModule,
    BrowserModule,
    AppRoutingModule, // <-- Needed for [(ngModel)]
    CommonModule      // <-- Needed for [ngClass]
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
