// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { TrainingComponent } from './pages/training/training.component';
import { TranslationService } from './services/translation.service';
import { VerifyModuleComponent } from './pages/verify-module/verify-module.component';
import { PagesComponent } from './pages/pages/pages.component';

@NgModule({
  declarations: [
    AppComponent,
    VerifyModuleComponent,
    PagesComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AmplifyAuthenticatorModule,
    TrainingComponent,
    FormsModule
  ],
  providers: [TranslationService],
  bootstrap: [AppComponent]
})
export class AppModule { }