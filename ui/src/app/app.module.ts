// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { TrainingComponent } from './pages/training/training.component';
import { HeaderComponent } from './components/header/header.component';
import { TranslationService } from './services/translation.service';

@NgModule({
  declarations: [
    AppComponent,
    TrainingComponent,
    HeaderComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule  // Make sure this is included
  ],
  providers: [TranslationService],
  bootstrap: [AppComponent]
})
export class AppModule { }
