import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app.routes';

import { AppComponent } from './app.component';
import { HomeComponent } from './pages/home/home.component';
import { PagesComponent } from './pages/pages/pages.component';
import { ArticleReviewComponent } from './pages/article-review/article-review.component';
import { TrainingComponent } from './pages/training/training.component';
import { ModuleListComponent } from './pages/module-list/module-list.component';
import { LearnComponent } from './pages/learn/learn.component'; // ✅ Critical: LearnComponent explicitly imported

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    PagesComponent,
    ArticleReviewComponent,
    TrainingComponent,
    ModuleListComponent,
    LearnComponent   // ✅ Critical: LearnComponent explicitly declared
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,     // ✅ Needed for [(ngModel)]
    CommonModule     // ✅ Needed for [ngClass]
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
