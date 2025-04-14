// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';

import { AppComponent } from './app.component';
import { TrainingComponent } from './pages/training/training.component';
import { TranslationService } from './services/translation.service';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    AmplifyAuthenticatorModule,
    TrainingComponent  // Import standalone component here
  ],
  providers: [TranslationService],
  bootstrap: [AppComponent]
})
export class AppModule { }