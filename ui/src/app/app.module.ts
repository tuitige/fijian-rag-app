// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { TrainingComponent } from './pages/training/training.component';
import { TranslationService } from './services/translation.service';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';
import { PagesComponent } from './pages/pages/pages.component';
import { ArticleReviewComponent } from './pages/article-review/article-review.component';
import { LearnComponent } from './pages/learn/learn.component';


@NgModule({
  declarations: [
    AppComponent,
    VerifyModuleComponent,
    PagesComponent,
    LearnComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AmplifyAuthenticatorModule,
    ArticleReviewComponent,
    TrainingComponent,
    CommonModule,
    FormsModule
  ],
  providers: [TranslationService],
  bootstrap: [AppComponent]
})
export class AppModule { }